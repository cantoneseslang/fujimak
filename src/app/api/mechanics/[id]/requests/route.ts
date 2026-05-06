import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

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

const FALLBACK_MECHANIC_MAP: Record<string, string> = {
  'fallback-mechanic-1': 'mechanicA',
  'fallback-mechanic-2': 'mechanicB',
  'fallback-mechanic-3': 'mechanicC',
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => asText(value)).filter(Boolean)))
}

/** Synthetic board IDs use vendor_name fallback; real UUIDs must align with /mechanic client matching */
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

type RequestRow = Record<string, unknown>

function mergeRequestsByUpdatedAt(primary: RequestRow[], extras: RequestRow[]) {
  const map = new Map<string, RequestRow>()
  for (const row of primary) {
    const rid = asText(row.id)
    if (rid) map.set(rid, row)
  }
  for (const row of extras) {
    const rid = asText(row.id)
    if (rid && !map.has(rid)) map.set(rid, row)
  }
  return [...map.values()].sort((a, b) =>
    String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? ''))
  )
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const mechanicId = asText(id)
    if (!mechanicId) {
      return NextResponse.json({ error: 'mechanic id is required' }, { status: 400 })
    }
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('assigned_mechanic_id', mechanicId)
      .in('status', ['in_progress', 'pending'])
      .order('updated_at', { ascending: false })
      .limit(200)
    let requests = data ?? []
    if (error) {
      const message = asErrorMessage(error)
      if (/column|schema cache|could not find|relation|does not exist/i.test(message)) {
        requests = []
      } else {
        throw error
      }
    }
    if (requests.length === 0) {
      const fallbackMechanicName = FALLBACK_MECHANIC_MAP[mechanicId]
      let mechanicNameFromProfile: string | null = null
      let mechanicEmailFromProfile: string | null = null

      const { data: mechanicProfile } = await supabase
        .from('mechanics')
        .select('name,email')
        .eq('id', mechanicId)
        .maybeSingle()
      mechanicNameFromProfile = asText(mechanicProfile?.name) || null
      mechanicEmailFromProfile = asText(mechanicProfile?.email) || null

      const emailPrefix = mechanicEmailFromProfile?.split('@')[0] ?? null
      const vendorNameCandidates = uniqueNonEmpty([
        fallbackMechanicName,
        mechanicNameFromProfile,
        emailPrefix,
      ])

      for (const candidate of vendorNameCandidates) {
        const { data: fallbackRows, error: fallbackError } = await supabase
          .from('maintenance_requests')
          .select('*')
          .ilike('vendor_name', candidate)
          .in('status', ['in_progress', 'pending'])
          .order('updated_at', { ascending: false })
          .limit(200)
        if (!fallbackError && Array.isArray(fallbackRows) && fallbackRows.length > 0) {
          requests = fallbackRows
          break
        }
      }
    }

    // Work screen (/mechanic) treats vendor_name === mechanic display name as "yours"; board must match.
    if (isUuid(mechanicId)) {
      const { data: mechanicRow, error: mechanicErr } = await supabase
        .from('mechanics')
        .select('name, english_name')
        .eq('id', mechanicId)
        .maybeSingle()

      if (!mechanicErr && mechanicRow && typeof mechanicRow === 'object') {
        const rec = mechanicRow as Record<string, unknown>
        const patterns = [
          ...new Set([asText(rec.english_name), asText(rec.name)].filter((p) => p.length > 0)),
        ]
        const extras: RequestRow[] = []
        for (const pattern of patterns) {
          const { data: vnRows, error: vnErr } = await supabase
            .from('maintenance_requests')
            .select('*')
            .ilike('vendor_name', pattern)
            .in('status', ['in_progress', 'pending'])
            .order('updated_at', { ascending: false })
            .limit(200)
          if (!vnErr && Array.isArray(vnRows)) {
            extras.push(...(vnRows as RequestRow[]))
          }
        }
        if (extras.length > 0) {
          requests = mergeRequestsByUpdatedAt(requests as RequestRow[], extras).slice(0, 200)
        }
      }
    }

    return NextResponse.json({ requests })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}
