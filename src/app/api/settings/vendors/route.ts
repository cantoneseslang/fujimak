import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const value = (error as { message?: unknown }).message
    if (typeof value === 'string' && value.length > 0) return value
  }
  return 'Unknown error'
}

function normalizeEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of raw) {
    if (typeof value !== 'string') continue
    const email = value.trim().toLowerCase()
    if (!email) continue
    if (seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('notification_emails')
      .select('id,email')
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ vendors: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const emails = normalizeEmails(body?.emails)
    const supabase = getSupabaseAdmin()

    const { error: deleteError } = await supabase
      .from('notification_emails')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (deleteError) throw deleteError

    if (emails.length > 0) {
      const { error: insertError } = await supabase
        .from('notification_emails')
        .insert(emails.map((email) => ({ email })))
      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true, count: emails.length })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}
