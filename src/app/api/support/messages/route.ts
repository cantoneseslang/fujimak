import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

function normText(v: unknown) {
  return typeof v === 'string' ? v.trim() : ''
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const threadId = normText(url.searchParams.get('threadId'))
    if (!threadId) return NextResponse.json({ error: 'Missing threadId' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) throw error
    return NextResponse.json({ messages: data ?? [] })
  } catch (error) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof (error as any)?.message === 'string'
          ? (error as any).message
          : JSON.stringify(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

