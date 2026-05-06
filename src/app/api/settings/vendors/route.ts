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

type VendorPayload = {
  email: string
  display_name: string | null
  phone: string
  is_active: boolean
}

/** Full vendor rows from Settings (legacy callers may send `emails` only). */
function normalizeVendorsPayload(raw: unknown): VendorPayload[] | null {
  if (!Array.isArray(raw)) return null
  const out: VendorPayload[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const o = entry as Record<string, unknown>
    const emailRaw = typeof o.email === 'string' ? o.email.trim().toLowerCase() : ''
    if (!emailRaw || seen.has(emailRaw)) continue
    seen.add(emailRaw)
    const nameRaw =
      typeof o.name === 'string'
        ? o.name.trim()
        : typeof o.display_name === 'string'
          ? o.display_name.trim()
          : ''
    const phoneRaw = typeof o.phone === 'string' ? o.phone.trim() : ''
    const isActive = typeof o.is_active === 'boolean' ? o.is_active : true
    out.push({
      email: emailRaw,
      display_name: nameRaw.length > 0 ? nameRaw : null,
      phone: phoneRaw,
      is_active: isActive,
    })
  }
  return out
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('notification_emails')
      .select('id,email,display_name,phone,is_active,sort_order')
      .order('sort_order', { ascending: true })
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
    const vendorsPayload = normalizeVendorsPayload(body?.vendors)
    const supabase = getSupabaseAdmin()

    if (vendorsPayload !== null) {
      if (vendorsPayload.length === 0) {
        const { error: clearError } = await supabase
          .from('notification_emails')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000')
        if (clearError) throw clearError
        return NextResponse.json({ success: true, count: 0 })
      }

      const keep = new Set(vendorsPayload.map((v) => v.email))
      const { data: existingRows, error: selErr } = await supabase.from('notification_emails').select('email')
      if (selErr) throw selErr
      const orphans = (existingRows ?? [])
        .map((r) => (typeof r.email === 'string' ? r.email : ''))
        .filter((e) => e.length > 0 && !keep.has(e))
      if (orphans.length > 0) {
        const { error: delErr } = await supabase.from('notification_emails').delete().in('email', orphans)
        if (delErr) throw delErr
      }

      const batchRows = vendorsPayload.map((v, i) => ({
        email: v.email,
        display_name: v.display_name,
        phone: v.phone,
        is_active: v.is_active,
        sort_order: i,
      }))
      const { error: batchErr } = await supabase
        .from('notification_emails')
        .upsert(batchRows, { onConflict: 'email' })
      if (batchErr) throw batchErr

      return NextResponse.json({ success: true, count: vendorsPayload.length })
    }

    const emails = normalizeEmails(body?.emails)

    const { error: deleteError } = await supabase
      .from('notification_emails')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (deleteError) throw deleteError

    if (emails.length > 0) {
      const { error: insertError } = await supabase
        .from('notification_emails')
        .insert(emails.map((email, index) => ({ email, sort_order: index, is_active: true })))
      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true, count: emails.length })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}
