import fs from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'
import type { MaintenanceRequestRecord } from '@/lib/maintenance'
import {
  MAINTENANCE_CHECKLIST_LABELS,
  buildMaintenanceReportFormState,
  rankLabel,
  type MaintenanceReportFormSnapshot,
} from '@/lib/maintenanceReportForm'

type ReportAttachment = {
  name: string
  type: 'image' | 'video'
  source: string
  url: string
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseAttachments(input: unknown): ReportAttachment[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as { name?: unknown; type?: unknown; source?: unknown; url?: unknown }
      const url = asText(row.url)
      if (!url) return null
      const typeRaw = asText(row.type)
      const type: 'image' | 'video' = typeRaw === 'video' ? 'video' : 'image'
      return {
        name: asText(row.name) || `attachment_${index + 1}`,
        type,
        source: asText(row.source) || 'unknown',
        url,
      } satisfies ReportAttachment
    })
    .filter((v): v is ReportAttachment => v !== null)
}

async function imageBufferFromUrl(url: string): Promise<Buffer | null> {
  const trimmed = asText(url)
  if (!trimmed) return null

  const dataMatch = trimmed.match(/^data:image\/[\w+.-]+;base64,(.+)$/i)
  if (dataMatch?.[1]) {
    try {
      return Buffer.from(dataMatch[1], 'base64')
    } catch {
      return null
    }
  }

  try {
    const res = await fetch(trimmed)
    if (!res.ok) return null
    const contentType = asText(res.headers.get('content-type'))
    if (!contentType.startsWith('image/')) return null
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch {
    return null
  }
}

function logoPathCandidates() {
  return [
    path.join(process.cwd(), 'public', 'images', 'fujimak-rogo.png'),
    path.join(process.cwd(), 'public', 'images', 'fujimak-logo.png'),
  ]
}

export async function buildMechanicWorkReportPdf(params: {
  request: MaintenanceRequestRecord
  reportNo: string
  issuedAtText: string
  signatureDataUrl?: string
  reportTitle?: string
  invoiceAmount?: number
  invoiceWorkDescription?: string
  maintenanceReport?: MaintenanceReportFormSnapshot | null
}) {
  const {
    request,
    reportNo,
    issuedAtText,
    signatureDataUrl,
    reportTitle,
    invoiceAmount,
    invoiceWorkDescription,
    maintenanceReport,
  } = params

  const form = maintenanceReport ?? buildMaintenanceReportFormState(request, null)
  const isInvoice = asText(reportTitle).toUpperCase() === 'INVOICE'

  const attachments = parseAttachments(request.attachments)
  const overviewImages = attachments.filter((i) => i.source === 'mechanic_overview' && i.type === 'image').slice(0, 2)
  const beforeImages = attachments.filter((i) => i.source === 'mechanic_before' && i.type === 'image').slice(0, 4)
  const afterImages = attachments.filter((i) => i.source === 'mechanic_after' && i.type === 'image').slice(0, 4)

  const doc = new PDFDocument({
    size: 'A4',
    margin: 36,
    compress: true,
  })
  const chunks: Buffer[] = []
  doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const pageBottom = () => doc.page.height - doc.page.margins.bottom
  const pageTop = doc.page.margins.top
  const marginLeft = doc.page.margins.left
  const marginRight = doc.page.width - doc.page.margins.right
  const contentW = marginRight - marginLeft

  const ensureSpace = (needed: number) => {
    if (doc.y + needed <= pageBottom()) return
    doc.addPage()
    doc.x = marginLeft
    doc.y = pageTop
  }

  const drawHeaderBand = () => {
    const bandTop = doc.y
    const logoH = 26
    let logoDrawn = false
    for (const pth of logoPathCandidates()) {
      if (!fs.existsSync(pth)) continue
      try {
        doc.image(pth, marginLeft, bandTop, { height: logoH })
        logoDrawn = true
        break
      } catch {
        /* skip */
      }
    }
    if (!logoDrawn) {
      doc.font('Helvetica-Bold').fontSize(11).text('fujimak', marginLeft, bandTop + 6)
    }

    const title = isInvoice ? 'Maintenance Report / INVOICE' : 'Maintenance Report'
    doc.font('Helvetica-Bold').fontSize(13).text(title, marginLeft, bandTop, {
      width: contentW,
      align: 'center',
    })

    const metaX = marginLeft + contentW - 148
    doc.font('Helvetica').fontSize(8).fillColor('#374151')
    doc.text(`Operation Date: ${form.operationDateText}`, metaX, bandTop, { width: 140, align: 'right' })
    doc.text(`Report No: ${reportNo}`, metaX, bandTop + 11, { width: 140, align: 'right' })
    doc.text(`Issued: ${issuedAtText}`, metaX, bandTop + 22, { width: 140, align: 'right' })
    doc.fillColor('#111111')

    doc.y = bandTop + Math.max(logoH, 38)
    doc.moveDown(0.35)
  }

  const drawLabelValueRows = (rows: Array<[string, string]>) => {
    const labelW = 118
    const gap = 3
    doc.font('Helvetica').fontSize(8)
    for (const [label, value] of rows) {
      const rowH = Math.max(
        doc.heightOfString(`${label}:`, { width: labelW }),
        doc.heightOfString(value || '-', { width: contentW - labelW - gap })
      )
      ensureSpace(rowH + 8)
      const rowTop = doc.y
      doc.font('Helvetica-Bold').text(`${label}:`, marginLeft, rowTop, { width: labelW })
      doc.font('Helvetica').text(value || '-', marginLeft + labelW + gap, rowTop, {
        width: contentW - labelW - gap,
      })
      doc.y = rowTop + rowH + 6
    }
    doc.moveDown(0.2)
  }

  /** Matches report-confirm preview: two-column pairs + Symptom row (operation date only in header band). */
  const drawHeaderTwoColumnGrid = () => {
    const colGap = 16
    const halfW = (contentW - colGap) / 2
    const pairs: Array<[[string, string], [string, string]]> = [
      [['Request ID', request.id], ['Client', form.clientLabel]],
      [['PIC', form.picName], ['Location', form.locationText]],
      [['Machine', form.equipmentLabel], ['Model', form.brand]],
      [['Serial', form.serialNumber], ['Start Time', form.startTimeDisplay]],
      [['Finish Time', form.finishTimeDisplay], ['Form code', asText(form.formCode) || 'FPC011']],
    ]

    const measureStackedCell = (label: string, rawValue: string, cellW: number) => {
      const valueDisp = asText(rawValue) || '—'
      doc.font('Helvetica').fontSize(7).fillColor('#64748b')
      const labelH = doc.heightOfString(`${label}:`, { width: cellW })
      doc.font('Helvetica').fontSize(8.5).fillColor('#111111')
      const valH = doc.heightOfString(valueDisp, { width: cellW })
      return { labelH, valH, valueDisp }
    }

    for (const [left, right] of pairs) {
      const [ll, lv] = left
      const [rl, rv] = right
      const L = measureStackedCell(ll, lv, halfW)
      const R = measureStackedCell(rl, rv, halfW)
      const leftH = L.labelH + 2 + L.valH
      const rightH = R.labelH + 2 + R.valH
      const rowH = Math.max(leftH, rightH) + 10

      ensureSpace(rowH + 6)
      const rowTop = doc.y
      const rx = marginLeft + halfW + colGap

      doc.font('Helvetica').fontSize(7).fillColor('#64748b')
      doc.text(`${ll}:`, marginLeft, rowTop, { width: halfW })
      doc.font('Helvetica').fontSize(8.5).fillColor('#111111')
      doc.text(L.valueDisp, marginLeft, rowTop + L.labelH + 2, { width: halfW })

      doc.font('Helvetica').fontSize(7).fillColor('#64748b')
      doc.text(`${rl}:`, rx, rowTop, { width: halfW })
      doc.font('Helvetica').fontSize(8.5).fillColor('#111111')
      doc.text(R.valueDisp, rx, rowTop + R.labelH + 2, { width: halfW })

      const lineY = rowTop + rowH - 4
      doc.moveTo(marginLeft, lineY).lineTo(marginRight, lineY).strokeColor('#e5e7eb').lineWidth(0.55).stroke()

      doc.y = rowTop + rowH
      doc.fillColor('#111111')
    }

    const symLabel = 'Symptom'
    const symVal = asText(request.symptom) || '—'
    doc.font('Helvetica').fontSize(7).fillColor('#64748b')
    const slh = doc.heightOfString(`${symLabel}:`, { width: contentW })
    doc.font('Helvetica').fontSize(8.5).fillColor('#111111')
    const svh = doc.heightOfString(symVal, { width: contentW })
    const symRowH = slh + 2 + svh + 10

    ensureSpace(symRowH + 6)
    const symTop = doc.y
    doc.font('Helvetica').fontSize(7).fillColor('#64748b')
    doc.text(`${symLabel}:`, marginLeft, symTop, { width: contentW })
    doc.font('Helvetica').fontSize(8.5).fillColor('#111111')
    doc.text(symVal, marginLeft, symTop + slh + 2, { width: contentW })
    const symLineY = symTop + symRowH - 4
    doc.moveTo(marginLeft, symLineY).lineTo(marginRight, symLineY).strokeColor('#e5e7eb').lineWidth(0.55).stroke()
    doc.y = symTop + symRowH
    doc.fillColor('#111111')

    doc.moveDown(0.25)
  }

  const drawBoxParagraph = (heading: string, body: string, minHeight = 52) => {
    ensureSpace(minHeight + 26)
    doc.font('Helvetica-Bold').fontSize(9).text(heading)
    const top = doc.y + 2
    doc.rect(marginLeft, top, contentW, minHeight).strokeColor('#d4d4d8').lineWidth(0.8).stroke()
    doc.font('Helvetica').fontSize(8.5).fillColor('#111827')
    doc.text(body || '-', marginLeft + 6, top + 6, {
      width: contentW - 12,
      height: minHeight - 12,
      ellipsis: true,
    })
    doc.fillColor('#111111')
    doc.y = top + minHeight + 8
  }

  const drawChecklist = () => {
    const colGap = 14
    const halfW = (contentW - colGap) / 2
    const n = MAINTENANCE_CHECKLIST_LABELS.length
    const half = Math.ceil(n / 2)

    ensureSpace(26)
    doc.font('Helvetica-Bold').fontSize(10).text('Technical checklist comments')
    doc.moveDown(0.28)
    doc.font('Helvetica').fontSize(7.5).fillColor('#111111')

    for (let r = 0; r < half; r++) {
      const iLeft = r
      const iRight = r + half
      const labelL = MAINTENANCE_CHECKLIST_LABELS[iLeft]
      const commentL = form.checklistComments[iLeft] || 'NA'
      const lineL = `${iLeft + 1}. ${labelL} — ${commentL}`

      let lineR = ''
      if (iRight < n) {
        const labelR = MAINTENANCE_CHECKLIST_LABELS[iRight]
        const commentR = form.checklistComments[iRight] || 'NA'
        lineR = `${iRight + 1}. ${labelR} — ${commentR}`
      }

      const hL = doc.heightOfString(lineL, { width: halfW })
      const hR = lineR ? doc.heightOfString(lineR, { width: halfW }) : 0
      const rowH = Math.max(hL, hR, 10) + 5

      ensureSpace(rowH + 2)
      const rowTop = doc.y
      doc.text(lineL, marginLeft, rowTop, { width: halfW })
      if (lineR) {
        doc.text(lineR, marginLeft + halfW + colGap, rowTop, { width: halfW })
      }
      doc.y = rowTop + rowH
    }
    doc.fillColor('#111111')
    doc.moveDown(0.35)
  }

  const drawRankConditions = () => {
    ensureSpace(28)
    doc.font('Helvetica-Bold').fontSize(9).text('Ranking')
    doc.moveDown(0.22)
    doc.font('Helvetica').fontSize(8).fillColor('#111111')
    doc.text(`Rank: ${form.rank} — ${rankLabel(form.rank)}`, marginLeft, doc.y, { width: contentW })
    doc.moveDown(0.15)
    const conditionLine =
      form.conditionLevel === 'dangerous'
        ? 'Condition: × DANGEROUS — stop using'
        : form.conditionLevel === 'not_good'
          ? 'Condition: Δ Not good (parts needed)'
          : 'Condition: O Perfect'
    doc.text(conditionLine, marginLeft, doc.y, { width: contentW })
    doc.fillColor('#111111')
    doc.moveDown(0.35)
  }

  const drawPhotoStrip = async (label: string, images: ReportAttachment[], thumbW: number, thumbH: number) => {
    if (images.length === 0) return
    ensureSpace(thumbH + 34)
    doc.font('Helvetica-Bold').fontSize(9).text(label)
    const rowY = doc.y + 4
    let x = marginLeft
    for (const item of images) {
      const buf = await imageBufferFromUrl(item.url)
      doc.rect(x, rowY, thumbW, thumbH).strokeColor('#d4d4d8').lineWidth(0.8).stroke()
      if (buf) {
        try {
          doc.save()
          doc.rect(x + 1, rowY + 1, thumbW - 2, thumbH - 2).clip()
          doc.image(buf, x + 1, rowY + 1, {
            cover: [thumbW - 2, thumbH - 2],
            align: 'center',
            valign: 'center',
          })
          doc.restore()
        } catch {
          doc.font('Helvetica').fontSize(7).text('Load failed', x + 4, rowY + thumbH / 2 - 4)
        }
      } else {
        doc.font('Helvetica').fontSize(7).text('Unavailable', x + 4, rowY + thumbH / 2 - 4)
      }
      x += thumbW + 8
      if (x + thumbW > marginRight) break
    }
    doc.y = rowY + thumbH + 10
  }

  const drawInvoiceBlock = () => {
    if (!isInvoice) return
    ensureSpace(62)
    doc.font('Helvetica-Bold').fontSize(10).text('Invoice summary')
    const boxTop = doc.y + 2
    doc.rect(marginLeft, boxTop, contentW, 54).strokeColor('#18181b').lineWidth(1).stroke()
    const amt =
      typeof invoiceAmount === 'number' && Number.isFinite(invoiceAmount)
        ? `PHP ${invoiceAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '-'
    doc.font('Helvetica-Bold').fontSize(9).text(`Amount: ${amt}`, marginLeft + 8, boxTop + 8)
    doc.font('Helvetica').fontSize(8.5).text(
      `Description: ${asText(invoiceWorkDescription) || form.actionTaken || '-'}`,
      marginLeft + 8,
      boxTop + 26,
      { width: contentW - 16 }
    )
    doc.y = boxTop + 58
  }

  const drawSignatureCell = async (
    title: string,
    name: string,
    sigUrl: string | undefined,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    doc.rect(x, y, w, h).strokeColor('#d4d4d8').lineWidth(0.8).stroke()
    doc.font('Helvetica-Bold').fontSize(8).text(title, x + 6, y + 4)
    doc.font('Helvetica').fontSize(8).text(name || '-', x + 6, y + 16)
    const buf = sigUrl ? await imageBufferFromUrl(asText(sigUrl)) : null
    if (buf) {
      try {
        doc.image(buf, x + 6, y + 28, { fit: [w - 12, h - 34], valign: 'bottom' })
      } catch {
        /* skip */
      }
    }
  }

  doc.x = marginLeft
  doc.y = pageTop
  drawHeaderBand()

  // 1. Same pairing / order as report-confirm “More header fields” (two-column grid)
  drawHeaderTwoColumnGrid()

  // 2. FOR — show selected classification only (Warranty XOR Billing)
  doc.font('Helvetica-Bold').fontSize(9).text('FOR')
  doc.moveDown(0.3)
  doc.font('Helvetica-Bold').fontSize(9).text(form.forBilling === 'warranty' ? 'Warranty' : 'Billing')
  doc.fillColor('#111111')
  doc.moveDown(0.4)

  if (form.forBilling === 'billing') {
    drawLabelValueRows([['If For Billing (note)', form.billingNote || '—']])
  }

  drawBoxParagraph('Concern', form.concern, 44)
  drawBoxParagraph('Action Taken', form.actionTaken, 52)
  drawLabelValueRows([['Finish (Status F)', form.statusF]])
  drawBoxParagraph('Recommendation', form.recommendation, 40)

  // 3. Technical checklist — 4. Ranking
  drawChecklist()
  drawRankConditions()

  const thumbW = (contentW - 16) / 2
  const thumbH = 64
  await drawPhotoStrip('Before', beforeImages.slice(0, 2), thumbW, thumbH)
  await drawPhotoStrip('After', afterImages.slice(0, 2), thumbW, thumbH)
  await drawPhotoStrip('Overview', overviewImages, thumbW, thumbH)

  drawInvoiceBlock()

  ensureSpace(96)
  doc.font('Helvetica-Bold').fontSize(10).text('Signatures')
  doc.moveDown(0.25)
  const sigRowY = doc.y + 2
  const half = (contentW - 10) / 2
  await drawSignatureCell(
    'Technician',
    form.technicianName,
    form.technicianSignatureDataUrl || undefined,
    marginLeft,
    sigRowY,
    half,
    76
  )
  await drawSignatureCell(
    'Supervisor',
    form.supervisorName,
    form.supervisorSignatureDataUrl || undefined,
    marginLeft + half + 10,
    sigRowY,
    half,
    76
  )
  doc.y = sigRowY + 82

  ensureSpace(84)
  doc.font('Helvetica-Bold').fontSize(9).text(`Client: ${form.clientSignatoryName || '(signatory name)'}`)
  const cx = marginLeft
  const cy = doc.y + 4
  doc.rect(cx, cy, contentW, 64).strokeColor('#d4d4d8').lineWidth(0.9).stroke()
  const custBuf = signatureDataUrl ? await imageBufferFromUrl(asText(signatureDataUrl)) : null
  if (custBuf) {
    try {
      doc.image(custBuf, cx + 6, cy + 6, { fit: [contentW - 12, 52], valign: 'center' })
    } catch {
      doc.font('Helvetica').fontSize(8).text('Customer signature could not be rendered.', cx + 8, cy + 26)
    }
  } else {
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('No signature captured.', cx + 8, cy + 26)
    doc.fillColor('#111111')
  }
  doc.y = cy + 70

  doc.end()
  return done
}
