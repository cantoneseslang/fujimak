import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  getArchiveBucketName,
  maintenanceInvoiceArchivePath,
  partsInvoiceArchivePath,
} from '@/lib/documentArchiveStorage'

export const runtime = 'nodejs'

type CompletedDocumentRow = {
  id: string
  kind: 'maintenance_invoice' | 'maintenance_report' | 'parts_invoice'
  request_id: string | null
  workflow_id: string | null
  store_id: string
  store_name: string
  title: string
  filename: string
  issued_at: string | null
  completed_at: string | null
  updated_at: string | null
  invoice_amount: number | null
  invoice_work_description: string | null
  archive_bucket: string | null
  archive_path: string | null
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableText(value: unknown) {
  const text = asText(value)
  return text.length > 0 ? text : null
}

function asNullablePositiveNumber(value: unknown) {
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

function isMissingRelationError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : ''
  const message =
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : asErrorMessage(error)
  return code === 'PGRST205' || code === '42P01' || /could not find the table|relation .* does not exist/i.test(message)
}

function toMaintenanceTitle(row: Record<string, unknown>) {
  const machineName = asText(row.machine_name)
  const machineModel = asText(row.machine_model)
  const machineSerial = asText(row.machine_serial)
  const base = machineName || machineModel || 'Maintenance Request'
  return machineSerial ? `${base} / ${machineSerial}` : base
}

export async function GET(request: NextRequest) {
  try {
    const limitRaw = Number(request.nextUrl.searchParams.get('limit'))
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 200
    const query = asText(request.nextUrl.searchParams.get('q')).toLowerCase()

    const supabase = getSupabaseAdmin()
    const maintenanceResult = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (maintenanceResult.error) throw maintenanceResult.error

    const partsResult = await supabase
      .from('parts_order_workflows')
      .select('*')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(limit)

    let partsQueryWarning: string | null = null
    if (partsResult.error && !isMissingRelationError(partsResult.error)) {
      throw partsResult.error
    }
    if (partsResult.error && isMissingRelationError(partsResult.error)) {
      partsQueryWarning = 'parts_order_workflows table is missing; skipped parts documents.'
    }

    const maintenanceRows = (maintenanceResult.data ?? []) as Record<string, unknown>[]
    const partsRows = (((partsResult.error ? [] : partsResult.data) ?? []) as Record<string, unknown>[]).filter((row) => {
      const hasInvoiceFile = asText(row.invoice_filename).length > 0
      const hasIssuedAt = asText(row.invoice_issued_at).length > 0
      return hasInvoiceFile || hasIssuedAt
    })

    const maintenanceDocs: CompletedDocumentRow[] = maintenanceRows.map((row) => {
      const requestId = asText(row.id)
      const hasInvoiceFile = asText(row.invoice_pdf_filename).length > 0
      const hasInvoiceIssuedAt = asText(row.invoice_issued_at).length > 0
      const hasInvoiceAmount = asNullablePositiveNumber(row.invoice_amount) !== null
      const isInvoice = hasInvoiceFile || hasInvoiceIssuedAt || hasInvoiceAmount
      const filename = isInvoice
        ? asText(row.invoice_pdf_filename) || `invoice-${requestId}.pdf`
        : `work-report-${requestId}.pdf`
      const archivePath =
        asNullableText(row.invoice_archive_path) || maintenanceInvoiceArchivePath(requestId, filename)
      return {
        id: `maintenance:${requestId}`,
        kind: isInvoice ? 'maintenance_invoice' : 'maintenance_report',
        request_id: requestId || null,
        workflow_id: null,
        store_id: asText(row.store_id),
        store_name: asText(row.store_name),
        title: toMaintenanceTitle(row),
        filename,
        issued_at: asNullableText(row.invoice_issued_at),
        completed_at: asNullableText(row.completed_at),
        updated_at: asNullableText(row.updated_at),
        invoice_amount: asNullablePositiveNumber(row.invoice_amount),
        invoice_work_description: asNullableText(row.invoice_work_description),
        archive_bucket: asNullableText(row.invoice_archive_bucket) || getArchiveBucketName(),
        archive_path: archivePath,
      }
    })

    const partsDocs: CompletedDocumentRow[] = partsRows.map((row) => {
      const workflowId = asText(row.id)
      const orderNo = asText(row.order_no) || workflowId
      const invoiceFileName = asText(row.invoice_filename) || `${orderNo}-invoice.pdf`
      const archivePath =
        asNullableText(row.invoice_archive_path) || partsInvoiceArchivePath(workflowId, invoiceFileName)
      return {
        id: `parts:${workflowId}`,
        kind: 'parts_invoice',
        request_id: null,
        workflow_id: workflowId || null,
        store_id: asText(row.store_id),
        store_name: asText(row.store_name),
        title: `Order ${orderNo}`,
        filename: invoiceFileName,
        issued_at: asNullableText(row.invoice_issued_at),
        completed_at: asNullableText(row.processed_at),
        updated_at: asNullableText(row.updated_at),
        invoice_amount: null,
        invoice_work_description: null,
        archive_bucket: asNullableText(row.invoice_archive_bucket) || getArchiveBucketName(),
        archive_path: archivePath,
      }
    })

    const merged = [...maintenanceDocs, ...partsDocs]
      .filter((row) => {
        if (!query) return true
        const target = [
          row.kind,
          row.store_id,
          row.store_name,
          row.title,
          row.filename,
          row.request_id || '',
          row.workflow_id || '',
          row.invoice_work_description || '',
        ]
          .join(' ')
          .toLowerCase()
        return target.includes(query)
      })
      .sort((a, b) => {
        const aTime = new Date(a.issued_at || a.completed_at || a.updated_at || 0).getTime()
        const bTime = new Date(b.issued_at || b.completed_at || b.updated_at || 0).getTime()
        return bTime - aTime
      })

    return NextResponse.json({
      documents: merged,
      warning: partsQueryWarning || undefined,
    })
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
