import PDFDocument from 'pdfkit'
import type { MaintenanceRequestRecord } from '@/lib/maintenance'

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

function getLatestByLabel(remarks: string, label: string) {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = [...remarks.matchAll(new RegExp(`${safeLabel}:\\s*([^\\n\\r]+)`, 'g'))]
  if (matches.length === 0) return ''
  const latest = matches[matches.length - 1]?.[1]
  return latest ? latest.trim() : ''
}

async function fetchImageBuffer(url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const contentType = asText(res.headers.get('content-type'))
    if (!contentType.startsWith('image/')) return null
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch {
    return null
  }
}

export async function buildMechanicWorkReportPdf(params: {
  request: MaintenanceRequestRecord
  reportNo: string
  issuedAtText: string
  signatureDataUrl?: string
  reportTitle?: string
  invoiceAmount?: number
  invoiceWorkDescription?: string
}) {
  const { request, issuedAtText, signatureDataUrl, reportTitle, invoiceAmount, invoiceWorkDescription } = params
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

  const attachments = parseAttachments(request.attachments)
  const beforeImages = attachments
    .filter((item) => item.source === 'mechanic_before' && item.type === 'image')
    .slice(0, 6)
  const afterImages = attachments
    .filter((item) => item.source === 'mechanic_after' && item.type === 'image')
    .slice(0, 6)

  const remarks = asText(request.remarks)
  const workStartedAt = getLatestByLabel(remarks, 'WorkStartedAt')
  const recordedAt = getLatestByLabel(remarks, 'RecordedAt') || asText(request.completed_at)
  const comment = getLatestByLabel(remarks, 'Comment') || '-'
  const mechanicianName = 'sakon hiroki'

  doc.font('Helvetica-Bold').fontSize(11).text('FUJIMAK PHILIPPINES CORPORATION', { align: 'center' })
  doc.moveDown(0.2)
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(asText(reportTitle) || 'ACCEPTANCE REPORT', { align: 'center' })
  doc.moveDown(0.3)
  doc.font('Helvetica').fontSize(10).text(`mechanician:${mechanicianName}`, { align: 'right' })
  doc.text(issuedAtText, { align: 'right' })
  doc.moveDown(0.4)

  const pair = (label: string, value: string) => {
    doc.font('Helvetica-Bold').text(`${label}: `, { continued: true })
    doc.font('Helvetica').text(value || '-')
  }

  pair('Request ID', asText(request.id))
  pair('Store', asText(request.store_name) || asText(request.store_id))
  pair('Machine', asText(request.machine_name) || asText(request.machine_model))
  pair('Model / Serial', `${asText(request.machine_model) || '-'} / ${asText(request.machine_serial) || '-'}`)
  pair('Fault Location', asText(request.fault_location))
  pair('Symptom', asText(request.symptom))
  const normalizedTitle = asText(reportTitle).toUpperCase()
  if (normalizedTitle === 'INVOICE') {
    const amountText =
      typeof invoiceAmount === 'number' && Number.isFinite(invoiceAmount)
        ? `PHP ${invoiceAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : '-'
    pair('Invoice Amount', amountText)
    pair('Work Description', asText(invoiceWorkDescription) || comment || asText(request.symptom) || '-')
  }
  doc.moveDown(0.6)

  const ensureSpace = (needed: number) => {
    const bottom = doc.page.height - doc.page.margins.bottom
    if (doc.y + needed <= bottom) return
    doc.addPage()
  }

  const renderEvidenceSection = async (
    title: string,
    images: ReportAttachment[],
    infoRows: Array<{ label: string; value: string }>
  ) => {
    ensureSpace(260)
    doc.x = 40
    doc.moveDown(0.8)
    doc.font('Helvetica-Bold').fontSize(12).text(title)
    doc.moveDown(0.3)

    const sectionY = doc.y
    const leftX = 40
    const leftW = 326
    const rightX = 376
    const rightW = 179
    const imageW = 158
    const imageH = 102
    const imageGap = 8
    let leftBottom = sectionY

    if (images.length === 0) {
      doc.rect(leftX, sectionY, leftW, imageH).strokeColor('#d4d4d8').lineWidth(0.8).stroke()
      doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text('-', leftX + 8, sectionY + imageH / 2 - 5)
      doc.fillColor('#111111')
      leftBottom = sectionY + imageH
    }

    for (let i = 0; i < images.length; i++) {
      const item = images[i]
      if (!item) continue
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = leftX + col * (imageW + imageGap)
      const y = sectionY + row * (imageH + imageGap)
      const buffer = await fetchImageBuffer(item.url)
      if (buffer) {
        try {
          doc.rect(x, y, imageW, imageH).strokeColor('#d4d4d8').lineWidth(0.8).stroke()
          const innerX = x + 1
          const innerY = y + 1
          const innerW = imageW - 2
          const innerH = imageH - 2
          doc.save()
          try {
            doc.rect(innerX, innerY, innerW, innerH).clip()
            doc.image(buffer, innerX, innerY, {
              cover: [innerW, innerH],
              align: 'center',
              valign: 'center',
            })
          } finally {
            doc.restore()
          }
        } catch {
          doc.rect(x, y, imageW, imageH).strokeColor('#d4d4d8').lineWidth(0.8).stroke()
          doc.font('Helvetica').fontSize(8).text('Image load failed', x + 8, y + imageH / 2 - 6)
        }
      } else {
        doc.rect(x, y, imageW, imageH).strokeColor('#d4d4d8').lineWidth(0.8).stroke()
        doc.font('Helvetica').fontSize(8).text('Image unavailable', x + 8, y + imageH / 2 - 6)
      }
      leftBottom = Math.max(leftBottom, y + imageH)
    }

    const rowHeight = 17
    const tableHeight = Math.max(84, 18 + infoRows.length * rowHeight + 8)
    doc.rect(rightX, sectionY, rightW, tableHeight).strokeColor('#d4d4d8').lineWidth(0.8).stroke()
    let textY = sectionY + 7
    doc.font('Helvetica-Bold').fontSize(9).text(title === 'Before Photos' ? 'Before Data' : 'After Data', rightX + 8, textY, {
      width: rightW - 16,
    })
    textY += 18
    for (const row of infoRows) {
      doc.font('Helvetica-Bold').fontSize(9).text(`${row.label}: `, rightX + 8, textY, { continued: true })
      doc.font('Helvetica').fontSize(9).text(row.value || '-')
      textY += rowHeight
    }

    const sectionBottom = Math.max(leftBottom, sectionY + tableHeight)
    doc.x = 40
    doc.y = sectionBottom + 14
  }

  await renderEvidenceSection('Before Photos', beforeImages, [{ label: 'WorkStarted', value: workStartedAt || '-' }])
  await renderEvidenceSection('After Photos', afterImages, [
    { label: 'Recorded', value: recordedAt || '-' },
    { label: 'Comment', value: comment || '-' },
  ])

  ensureSpace(170)
  doc.moveDown(0.8)
  doc.font('Helvetica-Bold').fontSize(12).text('Customer Signature')
  doc.moveDown(0.3)
  const signX = 40
  const signY = doc.y
  const signW = 510
  const signH = 95
  doc.rect(signX, signY, signW, signH).strokeColor('#d4d4d8').lineWidth(0.8).stroke()
  const signBuffer = await fetchImageBuffer(asText(signatureDataUrl))
  if (signBuffer) {
    try {
      doc.image(signBuffer, signX + 4, signY + 4, { fit: [signW - 8, signH - 8], valign: 'center' })
    } catch {
      doc.font('Helvetica').fontSize(9).text('Signature image could not be rendered.', signX + 8, signY + signH / 2 - 6)
    }
  } else {
    doc.font('Helvetica').fontSize(9).text('No signature captured.', signX + 8, signY + signH / 2 - 6)
  }
  doc.y = signY + signH + 14

  doc.end()
  return done
}
