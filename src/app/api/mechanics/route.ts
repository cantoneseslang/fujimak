import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const DEFAULT_MECHANICS = [
  { name: 'mechanicA', email: 'mechanica@fujimak.local' },
  { name: 'mechanicB', email: 'mechanicb@fujimak.local' },
  { name: 'mechanicC', email: 'mechanicc@fujimak.local' },
] as const

const FALLBACK_MECHANICS = DEFAULT_MECHANICS.map((seed, index) => ({
  id: `fallback-mechanic-${index + 1}`,
  name: seed.name,
  english_name: seed.name,
  sir_name: null,
  family_name: null,
  phone_number: null,
  email: seed.email,
  login_code: null,
  is_active: true,
}))

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const value = (error as { message?: unknown }).message
    if (typeof value === 'string' && value.length > 0) return value
  }
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

function isMissingColumnError(message: string) {
  return /column|schema cache|could not find/i.test(message)
}

/** Whole table missing (migration not applied) — not a missing-column fallback case */
function isMechanicsTableUnavailableError(message: string) {
  const m = message.toLowerCase()
  return (
    (m.includes('could not find the table') && m.includes('mechanics')) ||
    (m.includes('relation') && m.includes('mechanics') && m.includes('does not exist')) ||
    (m.includes('schema cache') && m.includes('public.mechanics'))
  )
}

function mechanicsTableUnavailableResponse(message: string) {
  return NextResponse.json(
    {
      error: message,
      code: 'MECHANICS_TABLE_UNAVAILABLE',
      hint: 'Apply Supabase migrations (e.g. 20260330000200_mechanic_assignment_board.sql) to create public.mechanics.',
    },
    { status: 503 }
  )
}

/** Synthetic IDs from GET fallback must not be sent to `.eq('id', …)` (invalid uuid). */
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function upsertMechanicFromBody(body: unknown): Promise<NextResponse> {
  const englishName =
    asText((body as { englishName?: unknown })?.englishName) ||
    asText((body as { name?: unknown })?.name)
  const sirName = asText((body as { sirName?: unknown })?.sirName) || null
  const familyName = asText((body as { familyName?: unknown })?.familyName) || null
  const phoneNumber = asText((body as { phoneNumber?: unknown })?.phoneNumber) || null
  const email = (
    asText((body as { emailAddress?: unknown })?.emailAddress) ||
    asText((body as { email?: unknown })?.email)
  ).toLowerCase()
  const loginCode = asText((body as { loginCode?: unknown })?.loginCode) || null
  const isActive =
    typeof (body as { isActive?: unknown })?.isActive === 'boolean'
      ? (body as { isActive: boolean }).isActive
      : true
  if (!englishName || !email) {
    return NextResponse.json({ error: 'englishName and emailAddress are required' }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const updatedAt = new Date().toISOString()
  const insertRow = {
    name: englishName,
    english_name: englishName,
    sir_name: sirName,
    family_name: familyName,
    phone_number: phoneNumber,
    email,
    login_code: loginCode,
    is_active: isActive,
    updated_at: updatedAt,
  }
  const { data, error } = await supabase
    .from('mechanics')
    .upsert(insertRow, { onConflict: 'email' })
    .select('*')
    .single()
  if (error) {
    const message = asErrorMessage(error)
    if (isMechanicsTableUnavailableError(message)) {
      return mechanicsTableUnavailableResponse(message)
    }
    if (!isMissingColumnError(message)) {
      return NextResponse.json({ error: message }, { status: 500 })
    }
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('mechanics')
      .upsert(
        {
          name: englishName,
          email,
          login_code: loginCode,
          is_active: isActive,
          updated_at: updatedAt,
        },
        { onConflict: 'email' }
      )
      .select('*')
      .single()
    if (fallbackError) {
      const fbMsg = asErrorMessage(fallbackError)
      if (isMechanicsTableUnavailableError(fbMsg)) {
        return mechanicsTableUnavailableResponse(fbMsg)
      }
      return NextResponse.json({ error: fbMsg }, { status: 500 })
    }
    return NextResponse.json({ mechanic: fallbackData }, { status: 201 })
  }
  return NextResponse.json({ mechanic: data }, { status: 201 })
}

async function ensureDefaultMechanics() {
  const supabase = getSupabaseAdmin()
  /** Insert-only seed: never overwrite names/settings on existing rows (plain upsert updates every GET). */
  const seedOpts = { onConflict: 'email', ignoreDuplicates: true } as const
  for (const seed of DEFAULT_MECHANICS) {
    const row = {
      name: seed.name,
      english_name: seed.name,
      sir_name: null,
      family_name: null,
      phone_number: null,
      email: seed.email,
      login_code: null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('mechanics').upsert(row, seedOpts)
    if (error) {
      const message = asErrorMessage(error)
      if (isMechanicsTableUnavailableError(message)) throw error
      if (!isMissingColumnError(message)) throw error
      const { error: fallbackError } = await supabase
        .from('mechanics')
        .upsert(
          {
            name: seed.name,
            email: seed.email,
            login_code: null,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          seedOpts
        )
      if (fallbackError) {
        const fbMsg = asErrorMessage(fallbackError)
        if (isMechanicsTableUnavailableError(fbMsg)) throw fallbackError
        throw fallbackError
      }
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const includeInactive = asText(request.nextUrl.searchParams.get('includeInactive')) === '1'
    const seedDefault = asText(request.nextUrl.searchParams.get('seedDefault')) === '1'
    if (seedDefault) {
      try {
        await ensureDefaultMechanics()
      } catch (error) {
        const message = asErrorMessage(error)
        if (!/relation|does not exist|schema cache|could not find|on conflict|constraint/i.test(message)) {
          throw error
        }
      }
    }
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('mechanics')
      .select('*')
      .order('created_at', { ascending: true })
      .order('email', { ascending: true })
    if (!includeInactive) query = query.eq('is_active', true)
    const { data, error } = await query
    if (error) {
      const message = asErrorMessage(error)
      if (/relation|does not exist|schema cache|could not find/i.test(message)) {
        return NextResponse.json({
          mechanics: FALLBACK_MECHANICS,
          warning: 'mechanics table is not available yet. Run migration first.',
        })
      }
      throw error
    }
    if (Array.isArray(data) && data.length > 0) {
      return NextResponse.json({ mechanics: data })
    }
    return NextResponse.json({
      mechanics: FALLBACK_MECHANICS,
      warning: 'mechanics table has no rows. Using default mechanics.',
    })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    return await upsertMechanicFromBody(body)
  } catch (error) {
    const message = asErrorMessage(error)
    if (isMechanicsTableUnavailableError(message)) {
      return mechanicsTableUnavailableResponse(message)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const id = asText(body?.id)
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    if (!isUuid(id)) {
      return upsertMechanicFromBody(body)
    }
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (typeof body?.englishName === 'string') {
      const value = asText(body.englishName)
      patch.english_name = value || null
      patch.name = value
    }
    if (typeof body?.sirName === 'string') patch.sir_name = asText(body.sirName) || null
    if (typeof body?.familyName === 'string') patch.family_name = asText(body.familyName) || null
    if (typeof body?.phoneNumber === 'string') patch.phone_number = asText(body.phoneNumber) || null
    if (typeof body?.emailAddress === 'string') patch.email = asText(body.emailAddress).toLowerCase()
    if (typeof body?.name === 'string' && !('name' in patch)) patch.name = asText(body.name)
    if (typeof body?.email === 'string' && !('email' in patch)) {
      patch.email = asText(body.email).toLowerCase()
    }
    if (typeof body?.loginCode === 'string') patch.login_code = asText(body.loginCode) || null
    if (typeof body?.isActive === 'boolean') patch.is_active = body.isActive

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('mechanics')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) {
      const message = asErrorMessage(error)
      if (isMechanicsTableUnavailableError(message)) {
        return mechanicsTableUnavailableResponse(message)
      }
      if (!isMissingColumnError(message)) throw error
      const fallbackPatch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (typeof body?.englishName === 'string') fallbackPatch.name = asText(body.englishName)
      if (typeof body?.name === 'string' && !('name' in fallbackPatch)) fallbackPatch.name = asText(body.name)
      if (typeof body?.emailAddress === 'string') fallbackPatch.email = asText(body.emailAddress).toLowerCase()
      if (typeof body?.email === 'string' && !('email' in fallbackPatch)) {
        fallbackPatch.email = asText(body.email).toLowerCase()
      }
      if (typeof body?.loginCode === 'string') fallbackPatch.login_code = asText(body.loginCode) || null
      if (typeof body?.isActive === 'boolean') fallbackPatch.is_active = body.isActive

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('mechanics')
        .update(fallbackPatch)
        .eq('id', id)
        .select('*')
        .single()
      if (fallbackError) {
        const fbMsg = asErrorMessage(fallbackError)
        if (isMechanicsTableUnavailableError(fbMsg)) {
          return mechanicsTableUnavailableResponse(fbMsg)
        }
        throw fallbackError
      }
      return NextResponse.json({ mechanic: fallbackData })
    }
    return NextResponse.json({ mechanic: data })
  } catch (error) {
    const message = asErrorMessage(error)
    if (isMechanicsTableUnavailableError(message)) {
      return mechanicsTableUnavailableResponse(message)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
