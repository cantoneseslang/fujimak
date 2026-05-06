import { NextRequest, NextResponse } from 'next/server'
import type { MaintenanceRequestRecord } from '@/lib/maintenance'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { buildMechanicWorkReportPdf } from '@/lib/mechanicWorkReportPdf'
import {
  maintenanceLegacyArchivePath,
  maintenanceInvoiceArchivePath,
  maintenanceRequestArchivePath,
  maintenanceSignedArchivePath,
  tryDownloadArchivedPdf,
  uploadArchivedPdf,
} from '@/lib/documentArchiveStorage'
import { buildMaintenanceReportFormState } from '@/lib/maintenanceReportForm'

export const runtime = 'nodejs'

type InvoiceCapableRequest = MaintenanceRequestRecord & {
  invoice_pdf_filename?: unknown
  invoice_issued_at?: unknown
  invoice_amount?: unknown
  invoice_work_description?: unknown
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asPositiveNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim()
    if (!normalized) return null
    const parsed = Number(normalized)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

export async function GET(request: NextRequest) {
  try {
    const requestId = asText(request.nextUrl.searchParams.get('requestId'))
    const inlineMode = asText(request.nextUrl.searchParams.get('inline')) === '1'
    const requestedMode = asText(request.nextUrl.searchParams.get('mode')).toLowerCase()
    const requestedFilename = asText(request.nextUrl.searchParams.get('filename'))
    const dispositionType = inlineMode ? 'inline' : 'attachment'
    if (!requestId) {
      return NextResponse.json({ success: false, error: 'requestId is required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('id', requestId)
      .single()
    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })
    }

    const record = data as InvoiceCapableRequest
    const invoiceAmount = asPositiveNumber(record.invoice_amount)
    const useInvoice = requestedMode !== 'report' && invoiceAmount !== null
    const filename =
      requestedFilename ||
      (useInvoice ? asText(record.invoice_pdf_filename) || `invoice-${requestId}.pdf` : `work-report-${requestId}.pdf`)
    const filenameLower = filename.toLowerCase()
    const mode =
      requestedMode === 'invoice' ||
      filenameLower.startsWith('invoice-') ||
      filenameLower.startsWith('inv-')
        ? 'invoice'
        : filenameLower.startsWith('signed-report-')
          ? 'signed'
          : useInvoice
            ? 'invoice'
            : 'request'
    const archiveCandidates =
      mode === 'invoice'
        ? [maintenanceInvoiceArchivePath(requestId, filename), maintenanceLegacyArchivePath(requestId, filename)]
        : mode === 'signed'
          ? [maintenanceSignedArchivePath(requestId, filename), maintenanceLegacyArchivePath(requestId, filename)]
          : [maintenanceRequestArchivePath(requestId, filename), maintenanceLegacyArchivePath(requestId, filename)]
    for (const archivedPath of archiveCandidates) {
      const archivedBuffer = await tryDownloadArchivedPdf({
        supabase,
        objectPath: archivedPath,
      })
      if (archivedBuffer) {
        return new NextResponse(new Uint8Array(archivedBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `${dispositionType}; filename="${filename}"`,
            'Cache-Control': 'no-store',
            'X-Archive-Hit': '1',
          },
        })
      }
    }

    const reportNo =
      filename.replace(/\.pdf$/i, '') ||
      `${useInvoice ? 'INV' : 'WR'}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`
    const issuedAtText = (() => {
      const raw = useInvoice ? asText(record.invoice_issued_at) : asText(record.completed_at) || asText(record.updated_at)
      if (!raw) return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      const date = new Date(raw)
      if (Number.isNaN(date.getTime())) return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    })()
    const invoiceWorkDescription = asText(record.invoice_work_description)
    const mergedReportForm = buildMaintenanceReportFormState(record, record.mechanic_report_snapshot ?? undefined)

    const pdfBuffer = useInvoice
      ? await buildMechanicWorkReportPdf({
          request: record,
          reportNo,
          issuedAtText,
          reportTitle: 'INVOICE',
          invoiceAmount: invoiceAmount ?? undefined,
          invoiceWorkDescription,
          maintenanceReport: mergedReportForm,
        })
      : await buildMechanicWorkReportPdf({
          request: record,
          reportNo,
          issuedAtText,
          maintenanceReport: mergedReportForm,
        })
    try {
      await uploadArchivedPdf({
        supabase,
        objectPath:
          mode === 'invoice'
            ? maintenanceInvoiceArchivePath(requestId, filename)
            : mode === 'signed'
              ? maintenanceSignedArchivePath(requestId, filename)
              : maintenanceRequestArchivePath(requestId, filename),
        buffer: Buffer.from(pdfBuffer),
      })
    } catch {
      // Non-blocking: even when archive upload fails, return PDF to user.
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${dispositionType}; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Archive-Hit': '0',
      },
    })
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
