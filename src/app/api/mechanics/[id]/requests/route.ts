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

const BOARD_REQUEST_COLUMNS = [
  'id',
  'store_id',
  'store_name',
  'machine_name',
  'machine_serial',
  'fault_location',
  'status',
  'scheduled_date',
  'preferred_date',
].join(',')

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => asText(value)).filter(Boolean)))
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const mechanicId = asText(id)
    if (!mechanicId) {
      return NextResponse.json({ error: 'mechanic id is required' }, { status: 400 })
    }
    /** Board intentionally shows shared vendor queue for all mechanics. */
    const supabase = getSupabaseAdmin()
    const { data: mechanicRows } = await supabase
      .from('mechanics')
      .select('name,email')
      .eq('is_active', true)
      .limit(50)
    const vendorCandidates = uniqueNonEmpty([
      'mechanicA',
      'mechanicB',
      'mechanicC',
      ...((Array.isArray(mechanicRows) ? mechanicRows : []).flatMap((row) => {
        const rec = row as Record<string, unknown>
        const name = asText(rec.name)
        const emailPrefix = asText(rec.email).split('@')[0] || ''
        return [name, emailPrefix]
      })),
    ])
    if (vendorCandidates.length === 0) {
      return NextResponse.json({ requests: [] })
    }
    const orClause = vendorCandidates
      .map((value) => `vendor_name.ilike.%${value.replaceAll('%', '')}%`)
      .join(',')

    const { data: sharedRows, error: sharedError } = await supabase
      .from('maintenance_requests')
      .select(BOARD_REQUEST_COLUMNS)
      .or(orClause)
      .in('status', ['in_progress', 'pending'])
      .order('updated_at', { ascending: false })
      .limit(200)

    if (sharedError) {
      const message = asErrorMessage(sharedError)
      if (/column|schema cache|could not find|relation|does not exist/i.test(message)) {
        return NextResponse.json({ requests: [] })
      }
      throw sharedError
    }

    return NextResponse.json({ requests: Array.isArray(sharedRows) ? sharedRows : [] })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}
