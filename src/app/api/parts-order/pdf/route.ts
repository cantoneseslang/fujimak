import { NextRequest, NextResponse } from 'next/server'
import { parsePartsOrderDraftFromBody } from '@/lib/partsOrderApi'
import { buildPartsOrderPdf } from '@/lib/partsOrderPdf'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = parsePartsOrderDraftFromBody(body)
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }
    const { draft } = parsed
    const nowText = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    const orderNo = `PO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(
      1000 + Math.random() * 9000
    )}`
    const pdfBuffer = await buildPartsOrderPdf(draft, orderNo, nowText)
    const filename = `${orderNo}.pdf`
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
