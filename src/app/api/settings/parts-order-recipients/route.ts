import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const PARTS_ORDER_RECIPIENT_PREFIX = 'parts_order_recipient:'

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const value = (error as { message?: unknown }).message
    if (typeof value === 'string' && value.length > 0) return value
  }
  return 'Unknown error'
}

type RawRecipient = { email: string; is_active: boolean }

function normalizeRecipients(raw: unknown): RawRecipient[] {
  if (!Array.isArray(raw)) return []
  const byEmail = new Map<string, boolean>()
  for (const row of raw) {
    if (typeof row !== 'object' || row === null) continue
    const emailRaw = (row as { email?: unknown }).email
    const activeRaw = (row as { is_active?: unknown }).is_active
    if (typeof emailRaw !== 'string') continue
    const email = emailRaw.trim().toLowerCase()
    if (!email) continue
    const isActive = activeRaw !== false
    if (!byEmail.has(email)) {
      byEmail.set(email, isActive)
    } else if (isActive) {
      // If duplicated in payload, keep active when any row is active.
      byEmail.set(email, true)
    }
  }
  return Array.from(byEmail.entries()).map(([email, is_active]) => ({ email, is_active }))
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('notification_settings')
      .select('setting_key,enabled,created_at')
      .like('setting_key', `${PARTS_ORDER_RECIPIENT_PREFIX}%`)
      .order('created_at', { ascending: true })

    if (error) throw error

    const recipients = (data ?? [])
      .map((row) => {
        const key = typeof row?.setting_key === 'string' ? row.setting_key : ''
        if (!key.startsWith(PARTS_ORDER_RECIPIENT_PREFIX)) return null
        const email = key.slice(PARTS_ORDER_RECIPIENT_PREFIX.length).trim().toLowerCase()
        if (!email) return null
        return {
          id: key,
          email,
          is_active: Boolean(row?.enabled),
        }
      })
      .filter((row): row is { id: string; email: string; is_active: boolean } => row !== null)

    return NextResponse.json({ recipients })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const recipients = normalizeRecipients(body?.recipients)
    const supabase = getSupabaseAdmin()

    const { error: deleteError } = await supabase
      .from('notification_settings')
      .delete()
      .like('setting_key', `${PARTS_ORDER_RECIPIENT_PREFIX}%`)
    if (deleteError) throw deleteError

    if (recipients.length > 0) {
      const rows = recipients.map((recipient) => ({
        setting_key: `${PARTS_ORDER_RECIPIENT_PREFIX}${recipient.email}`,
        enabled: recipient.is_active,
      }))
      const { error: insertError } = await supabase.from('notification_settings').insert(rows)
      if (insertError) throw insertError
    }

    const activeCount = recipients.filter((recipient) => recipient.is_active).length
    return NextResponse.json({ success: true, count: recipients.length, activeCount })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}
