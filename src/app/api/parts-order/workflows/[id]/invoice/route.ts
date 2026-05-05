import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { parsePartsOrderDraftFromBody } from '@/lib/partsOrderApi'
import { buildPartsOrderPdf } from '@/lib/partsOrderPdf'
import {
  getArchiveBucketName,
  partsInvoiceArchivePath,
  uploadArchivedPdf,
} from '@/lib/documentArchiveStorage'

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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

async function updatePartsWorkflowWithFallback(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  workflowId: string,
  patch: Record<string, unknown>
) {
  const workingPatch: Record<string, unknown> = { ...patch }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (Object.keys(workingPatch).length === 0) {
      throw new Error('No compatible columns found for parts workflow update')
    }
    const { error } = await supabase.from('parts_order_workflows').update(workingPatch).eq('id', workflowId)
    if (!error) return
    const message = asErrorMessage(error)
    if (!isSchemaMismatchError(message)) throw error
    const missingColumn = extractMissingColumnName(message)
    if (!missingColumn || !(missingColumn in workingPatch)) throw error
    delete workingPatch[missingColumn]
  }
  throw new Error('Failed to update parts workflow after legacy fallback attempts')
}

export const runtime = 'nodejs'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const workflowId = asText(id)
    if (!workflowId) {
      return NextResponse.json({ success: false, error: 'workflow id is required' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const issuedBy = asText((body as Record<string, unknown>).issuedBy) || 'management_portal'

    const supabase = getSupabaseAdmin()
    const { data: workflow, error: workflowError } = await supabase
      .from('parts_order_workflows')
      .select('*')
      .eq('id', workflowId)
      .single()
    if (workflowError || !workflow) {
      return NextResponse.json({ success: false, error: 'Workflow not found' }, { status: 404 })
    }

    const parsed = parsePartsOrderDraftFromBody(workflow.draft_payload)
    if (!parsed.ok) {
      return NextResponse.json(
        { success: false, error: `Invalid draft payload: ${parsed.error}` },
        { status: 400 }
      )
    }
    const draft = parsed.draft
    const orderNo = asText(workflow.order_no) || `INV-${workflowId}`
    const issuedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    const pdfBuffer = await buildPartsOrderPdf(draft, orderNo, issuedAt, 'INVOICE')
    const filename = `${orderNo}-invoice.pdf`
    const archivePath = partsInvoiceArchivePath(workflowId, filename)
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
    const prevStatus = asText(workflow.status) || null
    await updatePartsWorkflowWithFallback(supabase, workflowId, {
      status: 'completed',
      invoice_filename: filename,
      invoice_issued_at: nowIso,
      invoice_issued_by: issuedBy,
      invoice_archive_bucket: archiveSaved ? getArchiveBucketName() : null,
      invoice_archive_path: archiveSaved ? archivePath : null,
      processed_at: nowIso,
      processed_by: issuedBy,
      updated_at: nowIso,
    })

    await supabase.from('parts_order_updates').insert({
      workflow_id: workflowId,
      from_status: prevStatus,
      to_status: 'completed',
      note: 'Invoice generated from management queue',
      actor: issuedBy,
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Parts-Workflow-Id': workflowId,
        'X-Archive-Saved': archiveSaved ? '1' : '0',
      },
    })
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
