import fs from 'fs'
import PDFDocument from 'pdfkit'
import { calculateOrderTotals, type PartsOrderDraft } from '@/lib/partsOrder'
import { getPartsImagePath } from '@/lib/partsImagePaths'

export const formatCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

/** A4 content width ~515pt; image column + text columns */
const colImg = 40
const imgW = 36
const colPart = 80
const colSpec = 200
const colQty = 350
const colUnit = 388
const colAmount = 468
const tableRight = 555
const tableLeft = colImg

export async function buildPartsOrderPdf(
  draft: PartsOrderDraft,
  orderNo: string,
  nowText: string,
  documentTitle = 'FUJIMAK PARTS ORDER SHEET'
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    compress: true,
  })
  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const { totalUnits, totalAmount } = calculateOrderTotals(draft.items)

  doc.font('Helvetica-Bold').fontSize(18).text(documentTitle, { align: 'center' })
  doc.moveDown(0.5)
  doc.font('Helvetica').fontSize(10).text(`Order No: ${orderNo}`)
  doc.text(`Order Date: ${nowText}`)
  doc.text(`From Store: ${draft.storeName} (${draft.storeId})`)
  doc.text(
    `Machine: ${draft.machineName || draft.machineModel || '-'}${
      draft.machineSerial ? ` / ${draft.machineSerial}` : ''
    }`
  )
  doc.text(`To: ${draft.recipient || 'Fujimak'}`)
  doc.text(`Currency: ${draft.currency}`)
  doc.moveDown(0.8)

  let y = doc.y

  const drawHeader = () => {
    doc.font('Helvetica-Bold').fontSize(9)
    doc.text('Photo', colImg, y, { width: colPart - colImg - 4 })
    doc.text('Part', colPart, y, { width: colSpec - colPart - 6 })
    doc.text('Spec', colSpec, y, { width: colQty - colSpec - 6 })
    doc.text('Qty', colQty, y, { width: colUnit - colQty - 6, align: 'right' })
    doc.text('Unit Price', colUnit, y, { width: colAmount - colUnit - 6, align: 'right' })
    doc.text('Amount', colAmount, y, { width: tableRight - colAmount, align: 'right' })
    y += 14
    doc.moveTo(tableLeft, y).lineTo(tableRight, y).strokeColor('#d4d4d8').lineWidth(1).stroke()
    y += 8
  }

  drawHeader()

  for (const item of draft.items) {
    if (y > 720) {
      doc.addPage()
      y = 44
      drawHeader()
    }
    const rowTop = y
    const imgPath = getPartsImagePath(item.imageId)
    if (imgPath && fs.existsSync(imgPath)) {
      try {
        doc.image(imgPath, colImg, rowTop, { width: imgW, height: imgW })
      } catch {
        /* skip broken file */
      }
    }

    doc.font('Helvetica').fontSize(9)
    const specs = item.specs.join(' / ')
    const wPart = colSpec - colPart - 6
    const wSpec = colQty - colSpec - 6
    const hName = doc.heightOfString(item.name, { width: wPart })
    const hSpec = doc.heightOfString(specs, { width: wSpec })
    const textH = Math.max(hName, hSpec, 12)
    const rowHeight = Math.max(imgW, textH)

    doc.text(item.name, colPart, rowTop, { width: wPart })
    doc.text(specs, colSpec, rowTop, { width: wSpec })
    doc.text(String(item.quantity), colQty, rowTop, { width: colUnit - colQty - 6, align: 'right' })
    doc.text(formatCurrency(item.unitPrice, draft.currency), colUnit, rowTop, {
      width: colAmount - colUnit - 6,
      align: 'right',
    })
    doc.text(formatCurrency(item.quantity * item.unitPrice, draft.currency), colAmount, rowTop, {
      width: tableRight - colAmount,
      align: 'right',
    })

    y = rowTop + rowHeight + 6
    doc.moveTo(tableLeft, y).lineTo(tableRight, y).strokeColor('#e4e4e7').lineWidth(0.8).stroke()
    y += 6
  }

  y += 6
  doc.font('Helvetica-Bold').fontSize(10)
  doc.text(`Total Units: ${totalUnits}`, colUnit - 80, y, { width: 160, align: 'right' })
  y += 16
  doc.text(`Total Amount: ${formatCurrency(totalAmount, draft.currency)}`, colUnit - 80, y, {
    width: 160,
    align: 'right',
  })

  y += 24
  doc.font('Helvetica-Bold').fontSize(10).text('Notes', tableLeft, y)
  y += 14
  doc.font('Helvetica').fontSize(9).text(draft.notes || '-', tableLeft, y, { width: tableRight - tableLeft })

  doc.end()
  return done
}
