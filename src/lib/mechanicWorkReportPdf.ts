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
  footerSiteUrl?: string
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
    footerSiteUrl,
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
    bufferPages: true,
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
    doc.text(asText(form.formCode) || 'FPC011', metaX, bandTop, { width: 140, align: 'right' })
    doc.text(`Operation Date: ${form.operationDateText}`, metaX, bandTop + 11, { width: 140, align: 'right' })
    doc.text(`Report No: ${reportNo}`, metaX, bandTop + 22, { width: 140, align: 'right' })
    doc.text(`Issued: ${issuedAtText}`, metaX, bandTop + 33, { width: 140, align: 'right' })
    doc.fillColor('#111111')

    doc.y = bandTop + Math.max(logoH, 46)
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
    ensureSpace(162)
    doc.font('Helvetica-Bold').fontSize(10).text('Technical checklist')
    doc.moveDown(0.35)
    doc.font('Helvetica').fontSize(7.8)
    for (let i = 0; i < MAINTENANCE_CHECKLIST_LABELS.length; i++) {
      const label = MAINTENANCE_CHECKLIST_LABELS[i]
      const comment = form.checklistComments[i] || 'NA'
      ensureSpace(14)
      doc.text(`${i + 1}. ${label}`, marginLeft, doc.y, { continued: true })
      doc.font('Helvetica-Bold').text(` — `, { continued: true })
      doc.font('Helvetica').text(comment)
    }
    doc.moveDown(0.45)
  }

  const drawRankConditions = () => {
    ensureSpace(92)
    doc.font('Helvetica-Bold').fontSize(9).text('Ranking & condition')
    doc.moveDown(0.25)
    doc.font('Helvetica').fontSize(7.2).fillColor('#374151')
    doc.text(rankLabel(form.rank), marginLeft, doc.y, { width: contentW })
    doc.moveDown(0.12)
    doc.text(
      'Rank reference: A Unit Operational · B Replacement part(s) · C Observation · D Pull out-shop evaluation · E Unit replacement',
      marginLeft,
      doc.y,
      { width: contentW }
    )
    doc.moveDown(0.12)
    doc.text(
      'Conditions legend: O Perfect | Δ Not good (parts needed) | × DANGEROUS — stop using',
      marginLeft,
      doc.y,
      { width: contentW }
    )
    doc.fillColor('#111111')
    doc.moveDown(0.35)

    const boxTop = doc.y
    doc.rect(marginLeft, boxTop, 52, 44).strokeColor('#d4d4d8').lineWidth(0.85).stroke()
    doc.font('Helvetica-Bold').fontSize(8).text('Rank', marginLeft + 6, boxTop + 5)
    doc.font('Helvetica-Bold').fontSize(18).text(form.rank, marginLeft + 6, boxTop + 18, { width: 40, align: 'center' })

    const sym = form.conditionLevel === 'dangerous' ? '×' : form.conditionLevel === 'not_good' ? 'Δ' : 'O'
    doc.font('Helvetica-Bold').fontSize(11).text(`Condition: ${sym}`, marginLeft + 62, boxTop + 14)

    doc.y = boxTop + 50
    doc.moveDown(0.2)
  }

  const drawPhotoStrip = async (label: string, images: ReportAttachment[], thumbW: number, thumbH: number) => {
    ensureSpace(thumbH + 34)
    doc.font('Helvetica-Bold').fontSize(9).text(label)
    const rowY = doc.y + 4
    if (images.length === 0) {
      doc.rect(marginLeft, rowY, contentW, thumbH).strokeColor('#e4e4e7').lineWidth(0.8).stroke()
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('No image', marginLeft + 8, rowY + thumbH / 2 - 5)
      doc.fillColor('#111111')
      doc.y = rowY + thumbH + 10
      return
    }
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

  doc.font('Helvetica-Bold').fontSize(9).text(`Request ID: ${request.id}`)
  doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(`FOR: ${form.forBilling === 'billing' ? 'Billing' : 'Warranty'}`)
  doc.fillColor('#111111')
  doc.moveDown(0.45)

  drawLabelValueRows([
    ['Client', form.clientLabel],
    ['PIC', form.picName],
    ['Location', form.locationText],
    ['Equipment', form.equipmentLabel],
    ['Brand', form.brand],
    ['Model / Serial', `${asText(request.machine_model) || '-'} / ${asText(request.machine_serial) || '-'}`],
    ['Start Time', form.startTimeDisplay],
    ['Finish Time', form.finishTimeDisplay],
    ['If For Billing', form.billingNote || '-'],
  ])

  drawBoxParagraph('Concern', form.concern, 44)
  drawBoxParagraph('Action Taken', form.actionTaken, 52)
  drawBoxParagraph('Recommendation', form.recommendation, 40)

  drawChecklist()
  drawRankConditions()

  doc.font('Helvetica-Bold').fontSize(9).text(`Status(F): ${form.statusF}`)
  doc.moveDown(0.45)

  const thumbW = (contentW - 16) / 2
  const thumbH = 72
  await drawPhotoStrip('Overview', overviewImages, thumbW, thumbH)
  await drawPhotoStrip('Before', beforeImages.slice(0, 2), thumbW, thumbH)
  await drawPhotoStrip('After', afterImages.slice(0, 2), thumbW, thumbH)

  drawInvoiceBlock()

  ensureSpace(118)
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

  ensureSpace(92)
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

  doc.addPage()
  doc.x = marginLeft
  doc.y = pageTop
  doc.font('Helvetica-Bold').fontSize(12).text('Remarks (continuation)')
  doc.moveDown(0.45)
  doc.font('Helvetica').fontSize(8).fillColor('#52525b').text(
    'Additional handwritten notes on printed copies. Remark fields for office use.'
  )
  doc.fillColor('#111111')
  doc.moveDown(0.45)

  const remarkBoxH = 52
  const gap = 10
  for (let i = 1; i <= 10; i++) {
    ensureSpace(remarkBoxH + gap + 22)
    doc.font('Helvetica-Bold').fontSize(9).text(`Remarks${i}`)
    const ry = doc.y + 2
    doc.rect(marginLeft, ry, contentW, remarkBoxH).strokeColor('#e4e4e7').lineWidth(0.75).stroke()
    doc.y = ry + remarkBoxH + gap
  }

  const range = doc.bufferedPageRange()
  const total = range.count
  const footerLeft =
    (footerSiteUrl ? footerSiteUrl.replace(/\/$/, '') : '').slice(0, 92) + (footerSiteUrl && footerSiteUrl.length > 92 ? '…' : '')
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    const pg = i - range.start + 1
    const footY = doc.page.height - 32
    doc.font('Helvetica').fontSize(7).fillColor('#52525b')
    doc.text(footerLeft || 'FUJIMAK Maintenance Portal', marginLeft, footY, {
      width: contentW * 0.72,
      lineBreak: false,
    })
    doc.text(`${pg} / ${total}`, marginLeft, footY, { width: contentW, align: 'right', lineBreak: false })
    doc.fillColor('#111111')
  }

  doc.end()
  return done
}
