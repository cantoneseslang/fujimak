import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { buildMechanicWorkReportPdf } from '@/lib/mechanicWorkReportPdf'
import {
  getArchiveBucketName,
  maintenanceInvoiceArchivePath,
  uploadArchivedPdf,
} from '@/lib/documentArchiveStorage'
import type { MaintenanceRequestRecord } from '@/lib/maintenance'
import { buildMaintenanceReportFormState } from '@/lib/maintenanceReportForm'

export const runtime = 'nodejs'

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

function isSchemaMismatchError(message: string) {
  return /column|schema cache|could not find|does not exist|relation/i.test(message)
}

function extractMissingColumnName(message: string) {
  const singleQuoted = message.match(/'([^']+)' column/)
  if (singleQuoted?.[1]) return singleQuoted[1]
  const doubleQuoted = message.match(/column "([^"]+)"/)
  if (doubleQuoted?.[1]) return doubleQuoted[1]
  return ''
}

async function updateMaintenanceRequestWithFallback(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  requestId: string,
  patch: Record<string, unknown>
) {
  const workingPatch: Record<string, unknown> = { ...patch }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (Object.keys(workingPatch).length === 0) {
      throw new Error('No compatible columns found for maintenance request update')
    }
    const { error } = await supabase.from('maintenance_requests').update(workingPatch).eq('id', requestId)
    if (!error) return
    const message = asErrorMessage(error)
    if (!isSchemaMismatchError(message)) throw error
    const missingColumn = extractMissingColumnName(message)
    if (!missingColumn || !(missingColumn in workingPatch)) throw error
    delete workingPatch[missingColumn]
  }
  throw new Error('Failed to update maintenance request after legacy fallback attempts')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const requestId = asText(body?.requestId)
    const issuedBy = asText(body?.issuedBy) || 'management_portal'
    const invoiceAmount = asPositiveNumber(body?.invoiceAmount)
    const invoiceWorkDescription = asText(body?.invoiceWorkDescription)
    if (!requestId) {
      return NextResponse.json({ success: false, error: 'requestId is required' }, { status: 400 })
    }
    if (invoiceAmount === null) {
      return NextResponse.json({ success: false, error: 'invoiceAmount is required and must be > 0' }, { status: 400 })
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
    const record = data as MaintenanceRequestRecord
    const mergedReportForm = buildMaintenanceReportFormState(record, record.mechanic_report_snapshot ?? undefined)

    const reportNo = `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(
      1000 + Math.random() * 9000
    )}`
    const issuedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    const pdfBuffer = await buildMechanicWorkReportPdf({
      request: record,
      reportNo,
      issuedAtText: issuedAt,
      reportTitle: 'INVOICE',
      invoiceAmount,
      invoiceWorkDescription,
      maintenanceReport: mergedReportForm,
    })
    const filename = `${reportNo}.pdf`
    const archivePath = maintenanceInvoiceArchivePath(requestId, filename)
    let archiveSaved = false
    try {
      await uploadArchivedPdf({
        supabase,
        objectPath: archivePath,
        buffer: Buffer.from(pdfBuffer),
      })
      archiveSaved = true
    } catch {
      archiveSaved = false
    }

    const nowIso = new Date().toISOString()
    const prevStatus = asText(record.status)
    const patch = {
      status: 'completed',
      completed_at: nowIso,
      invoice_pdf_filename: filename,
      invoice_issued_at: nowIso,
      invoice_issued_by: issuedBy,
      invoice_amount: invoiceAmount,
      invoice_work_description: invoiceWorkDescription || null,
      invoice_archive_bucket: archiveSaved ? getArchiveBucketName() : null,
      invoice_archive_path: archiveSaved ? archivePath : null,
      updated_at: nowIso,
    }
    await updateMaintenanceRequestWithFallback(supabase, requestId, patch)

    if (prevStatus !== 'completed') {
      try {
        await supabase.from('maintenance_updates').insert({
          request_id: requestId,
          from_status: prevStatus || null,
          to_status: 'completed',
          note: 'Invoice issued from management queue',
          actor: issuedBy,
        })
      } catch (error) {
        const message = asErrorMessage(error)
        if (!isSchemaMismatchError(message)) throw error
      }
    }

    try {
      await supabase
        .from('support_threads')
        .update({
          workflow_state: 'completed',
          updated_at: nowIso,
        })
        .eq('maintenance_request_id', requestId)
    } catch (error) {
      const message = asErrorMessage(error)
      if (!isSchemaMismatchError(message)) throw error
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Invoice-Request-Id': requestId,
        'X-Archive-Saved': archiveSaved ? '1' : '0',
      },
    })
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
