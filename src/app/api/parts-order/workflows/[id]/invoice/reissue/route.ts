import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { parsePartsOrderDraftFromBody } from '@/lib/partsOrderApi'
import { buildPartsOrderPdf } from '@/lib/partsOrderPdf'
import {
  partsInvoiceArchivePath,
  tryDownloadArchivedPdf,
  uploadArchivedPdf,
} from '@/lib/documentArchiveStorage'

export const runtime = 'nodejs'

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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const inlineMode = asText(request.nextUrl.searchParams.get('inline')) === '1'
    const dispositionType = inlineMode ? 'inline' : 'attachment'
    const { id } = await context.params
    const workflowId = asText(id)
    if (!workflowId) {
      return NextResponse.json({ success: false, error: 'workflow id is required' }, { status: 400 })
    }

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
    const filename = asText(workflow.invoice_filename) || `${orderNo}-invoice.pdf`
    const archivePath = partsInvoiceArchivePath(workflowId, filename)
    const archivedBuffer = await tryDownloadArchivedPdf({
      supabase,
      objectPath: archivePath,
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

    const issuedAtText = (() => {
      const raw = asText(workflow.invoice_issued_at)
      if (!raw) return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      const date = new Date(raw)
      if (Number.isNaN(date.getTime())) return new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
      return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    })()
    const pdfBuffer = await buildPartsOrderPdf(draft, orderNo, issuedAtText, 'INVOICE')
    try {
      await uploadArchivedPdf({
        supabase,
        objectPath: archivePath,
        buffer: Buffer.from(pdfBuffer),
      })
    } catch {
      // Non-blocking: return generated PDF even if archive upload fails.
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
