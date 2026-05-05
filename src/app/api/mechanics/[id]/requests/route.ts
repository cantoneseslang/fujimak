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
    const fallbackMechanicName = FALLBACK_MECHANIC_MAP[mechanicId]
    if (fallbackMechanicName && requests.length === 0) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from('maintenance_requests')
        .select('*')
        .ilike('vendor_name', fallbackMechanicName)
        .in('status', ['in_progress', 'pending'])
        .order('updated_at', { ascending: false })
        .limit(200)
      if (!fallbackError && Array.isArray(fallbackRows)) {
        requests = fallbackRows
      }
    }
    return NextResponse.json({ requests })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}
