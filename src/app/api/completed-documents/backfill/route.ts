import { NextResponse } from 'next/server'
import type { MaintenanceRequestRecord } from '@/lib/maintenance'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { buildMechanicWorkReportPdf } from '@/lib/mechanicWorkReportPdf'
import { parsePartsOrderDraftFromBody } from '@/lib/partsOrderApi'
import { buildPartsOrderPdf } from '@/lib/partsOrderPdf'
import {
  getArchiveBucketName,
  maintenanceInvoiceArchivePath,
  partsInvoiceArchivePath,
  tryDownloadArchivedPdf,
  uploadArchivedPdf,
} from '@/lib/documentArchiveStorage'

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

function isMissingRelationError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const code = typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : ''
  const message =
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : asErrorMessage(error)
  return code === 'PGRST205' || code === '42P01' || /could not find the table|relation .* does not exist/i.test(message)
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

async function updateWithFallback(
  table: 'maintenance_requests' | 'parts_order_workflows',
  idField: 'id',
  id: string,
  patch: Record<string, unknown>
) {
  const supabase = getSupabaseAdmin()
  const workingPatch: Record<string, unknown> = { ...patch }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (Object.keys(workingPatch).length === 0) return
    const { error } = await supabase.from(table).update(workingPatch).eq(idField, id)
    if (!error) return
    const message = asErrorMessage(error)
    if (!isSchemaMismatchError(message)) throw error
    const missingColumn = extractMissingColumnName(message)
    if (!missingColumn || !(missingColumn in workingPatch)) throw error
    delete workingPatch[missingColumn]
  }
}

export async function POST() {
  try {
    const supabase = getSupabaseAdmin()
    const archiveBucket = getArchiveBucketName()
    let maintenanceArchived = 0
    let partsArchived = 0
    let skipped = 0

    const { data: maintenanceRows, error: maintenanceError } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(500)
    if (maintenanceError) throw maintenanceError

    for (const row of (maintenanceRows ?? []) as Array<Record<string, unknown>>) {
      const requestId = asText(row.id)
      if (!requestId) {
        skipped += 1
        continue
      }

      const invoiceAmount = asPositiveNumber(row.invoice_amount)
      const isInvoice = invoiceAmount !== null
      const filename = isInvoice
        ? asText(row.invoice_pdf_filename) || `invoice-${requestId}.pdf`
        : `work-report-${requestId}.pdf`
      const archivePath = asText(row.invoice_archive_path) || maintenanceInvoiceArchivePath(requestId, filename)
      const exists = await tryDownloadArchivedPdf({ supabase, objectPath: archivePath })
      if (exists) continue

      const record = row as unknown as MaintenanceRequestRecord
      const reportNo = filename.replace(/\.pdf$/i, '') || `${isInvoice ? 'INV' : 'WR'}-${requestId}`
      const issuedAtText = (() => {
        const raw = isInvoice ? asText(row.invoice_issued_at) : asText(row.completed_at) || asText(row.updated_at)
        if (!raw) return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
        const date = new Date(raw)
        if (Number.isNaN(date.getTime())) return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
        return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      })()

      const pdfBuffer = isInvoice
        ? await buildMechanicWorkReportPdf({
            request: record,
            reportNo,
            issuedAtText,
            reportTitle: 'INVOICE',
            invoiceAmount: invoiceAmount ?? undefined,
            invoiceWorkDescription: asText(row.invoice_work_description),
          })
        : await buildMechanicWorkReportPdf({
            request: record,
            reportNo,
            issuedAtText,
          })
      await uploadArchivedPdf({
        supabase,
        objectPath: archivePath,
        buffer: Buffer.from(pdfBuffer),
      })
      if (isInvoice) {
        await updateWithFallback('maintenance_requests', 'id', requestId, {
          invoice_archive_bucket: archiveBucket,
          invoice_archive_path: archivePath,
        })
      }
      maintenanceArchived += 1
    }

    const { data: partsRows, error: partsError } = await supabase
      .from('parts_order_workflows')
      .select('*')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(500)
    if (partsError && !isMissingRelationError(partsError)) throw partsError

    for (const row of ((partsError ? [] : partsRows) ?? []) as Array<Record<string, unknown>>) {
      const workflowId = asText(row.id)
      if (!workflowId) {
        skipped += 1
        continue
      }
      const orderNo = asText(row.order_no) || workflowId
      const filename = asText(row.invoice_filename) || `${orderNo}-invoice.pdf`
      const archivePath = asText(row.invoice_archive_path) || partsInvoiceArchivePath(workflowId, filename)
      const exists = await tryDownloadArchivedPdf({ supabase, objectPath: archivePath })
      if (exists) continue

      const parsed = parsePartsOrderDraftFromBody(row.draft_payload)
      if (!parsed.ok) {
        skipped += 1
        continue
      }
      const issuedAtText = (() => {
        const raw = asText(row.invoice_issued_at)
        if (!raw) return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
        const date = new Date(raw)
        if (Number.isNaN(date.getTime())) return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
        return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      })()
      const pdfBuffer = await buildPartsOrderPdf(parsed.draft, orderNo, issuedAtText, 'INVOICE')
      await uploadArchivedPdf({
        supabase,
        objectPath: archivePath,
        buffer: Buffer.from(pdfBuffer),
      })
      await updateWithFallback('parts_order_workflows', 'id', workflowId, {
        invoice_archive_bucket: archiveBucket,
        invoice_archive_path: archivePath,
      })
      partsArchived += 1
    }

    return NextResponse.json({
      success: true,
      maintenanceArchived,
      partsArchived,
      skipped,
      totalArchived: maintenanceArchived + partsArchived,
    })
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
