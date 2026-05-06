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

function isSchemaMismatchError(message: string) {
  return /column|schema cache|could not find|does not exist|relation/i.test(message)
}

function extractMissingColumnName(message: string) {
  const singleQuoted = message.match(/'([^']+)' column/)
  if (singleQuoted?.[1]) return singleQuoted[1]
  const doubleQuoted = message.match(/column \"([^\"]+)\"/)
  if (doubleQuoted?.[1]) return doubleQuoted[1]
  const unquoted = message.match(/column\s+([a-zA-Z0-9_.]+)\s+does not exist/i)
  if (unquoted?.[1]) {
    const parts = unquoted[1].split('.')
    return parts[parts.length - 1] || unquoted[1]
  }
  return ''
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const mechanicId = asText(id)
    if (!mechanicId) {
      return NextResponse.json({ error: 'mechanic id is required' }, { status: 400 })
    }
    /** Board intentionally shows a shared open queue for all mechanics. */
    const supabase = getSupabaseAdmin()
    let columns = BOARD_REQUEST_COLUMNS.split(',')
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const { data: sharedRows, error: sharedError } = await supabase
        .from('maintenance_requests')
        .select(columns.join(','))
        .in('status', ['in_progress', 'pending'])
        .order('updated_at', { ascending: false })
        .limit(200)

      if (!sharedError) {
        return NextResponse.json({ requests: Array.isArray(sharedRows) ? sharedRows : [] })
      }

      const message = asErrorMessage(sharedError)
      if (!isSchemaMismatchError(message)) throw sharedError
      const missingColumn = extractMissingColumnName(message)
      if (!missingColumn || !columns.includes(missingColumn)) {
        return NextResponse.json({ requests: [] })
      }
      columns = columns.filter((column) => column !== missingColumn)
      if (columns.length === 0) return NextResponse.json({ requests: [] })
    }

    return NextResponse.json({ requests: [] })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}
