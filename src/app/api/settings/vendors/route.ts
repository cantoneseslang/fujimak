import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { isNotificationEmailsSchemaLimitedError } from '@/lib/notificationEmailsCompat'

const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

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

async function legacyReplaceEmailsEmailOnly(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  emailsOrdered: string[]
) {
  const { error: deleteError } = await supabase
    .from('notification_emails')
    .delete()
    .neq('id', ZERO_UUID)
  if (deleteError) throw deleteError
  if (emailsOrdered.length === 0) return

  const extendedInsert = await supabase
    .from('notification_emails')
    .insert(emailsOrdered.map((email, index) => ({ email, sort_order: index, is_active: true })))
  if (!extendedInsert.error) return

  const msg = asErrorMessage(extendedInsert.error)
  if (!isNotificationEmailsSchemaLimitedError(msg)) throw extendedInsert.error

  const { error: minimalIns } = await supabase
    .from('notification_emails')
    .insert(emailsOrdered.map((email) => ({ email })))
  if (minimalIns) throw minimalIns
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const extended = await supabase
      .from('notification_emails')
      .select('id,email,display_name,phone,is_active,sort_order')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (!extended.error) {
      return NextResponse.json({ vendors: extended.data ?? [] })
    }

    const extMsg = asErrorMessage(extended.error)
    if (!isNotificationEmailsSchemaLimitedError(extMsg)) {
      return NextResponse.json({ error: extMsg }, { status: 500 })
    }

    const basic = await supabase
      .from('notification_emails')
      .select('id,email')
      .order('created_at', { ascending: true })

    if (basic.error) {
      return NextResponse.json({ error: asErrorMessage(basic.error) }, { status: 500 })
    }

    const vendors = (basic.data ?? []).map((r, i) => ({
      id: r.id,
      email: r.email,
      display_name: null as string | null,
      phone: '',
      is_active: true,
      sort_order: i,
    }))

    return NextResponse.json({
      vendors,
      vendorProfileColumnsUnavailable: true,
    })
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
        const { error: clearError } = await supabase.from('notification_emails').delete().neq('id', ZERO_UUID)
        if (clearError) throw clearError
        return NextResponse.json({ success: true, count: 0 })
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

      if (!batchErr) {
        return NextResponse.json({ success: true, count: vendorsPayload.length })
      }

      const batchMsg = asErrorMessage(batchErr)
      if (!isNotificationEmailsSchemaLimitedError(batchMsg)) {
        return NextResponse.json({ error: batchMsg }, { status: 500 })
      }

      await legacyReplaceEmailsEmailOnly(
        supabase,
        vendorsPayload.map((v) => v.email)
      )
      return NextResponse.json({
        success: true,
        count: vendorsPayload.length,
        vendorProfilePersistSkipped: true,
      })
    }

    const emails = normalizeEmails(body?.emails)

    const { error: deleteError } = await supabase
      .from('notification_emails')
      .delete()
      .neq('id', ZERO_UUID)
    if (deleteError) throw deleteError

    await legacyReplaceEmailsEmailOnly(supabase, emails)

    return NextResponse.json({ success: true, count: emails.length })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}
