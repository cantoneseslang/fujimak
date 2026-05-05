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

const VALID_STATUS = new Set(['pending', 'processing', 'completed', 'cancelled', 'all'])
const WORKFLOW_LIST_COLUMNS = [
  'id',
  'order_no',
  'store_id',
  'store_name',
  'status',
  'pdf_filename',
  'invoice_filename',
  'email_sent_at',
  'invoice_issued_at',
  'created_at',
  'updated_at',
]

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
    const [, raw] = unquoted
    const parts = raw.split('.')
    return parts[parts.length - 1] || raw
  }
  return ''
}

export async function GET(request: NextRequest) {
  try {
    const status = asText(request.nextUrl.searchParams.get('status')) || 'all'
    if (!VALID_STATUS.has(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
    }
    const supabase = getSupabaseAdmin()
    let columns = [...WORKFLOW_LIST_COLUMNS]
    let droppedColumns: string[] = []

    for (let attempt = 0; attempt < 30; attempt += 1) {
      let query = supabase
        .from('parts_order_workflows')
        .select(columns.join(','))
        .order('created_at', { ascending: false })
        .limit(200)
      if (status !== 'all') query = query.eq('status', status)
      const { data, error } = await query
      if (!error) {
        return NextResponse.json({
          workflows: data ?? [],
          warning:
            droppedColumns.length > 0
              ? `Parts workflows loaded with schema fallback. Missing columns skipped: ${droppedColumns.join(', ')}`
              : undefined,
        })
      }

      const message = asErrorMessage(error)
      if (/relation|does not exist|schema cache|could not find/i.test(message)) {
        return NextResponse.json({
          workflows: [],
          warning: 'parts_order_workflows table is not available yet. Run migration first.',
        })
      }
      if (!isSchemaMismatchError(message)) throw error
      const missing = extractMissingColumnName(message)
      if (!missing || !columns.includes(missing)) throw error
      columns = columns.filter((column) => column !== missing)
      droppedColumns = [...droppedColumns, missing]
      if (columns.length === 0) throw error
    }

    throw new Error('Failed to load parts workflows after schema fallback retries')
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
