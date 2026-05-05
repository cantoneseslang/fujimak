import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import type { ScheduleChangeStatus } from '@/lib/maintenance'

const SCHEDULE_STATUS = new Set<ScheduleChangeStatus>(['none', 'pending', 'approved', 'rescheduled'])
const NOTIFICATION_COLUMNS = [
  'id',
  'store_id',
  'store_name',
  'category_id',
  'item_id',
  'machine_name',
  'machine_model',
  'machine_serial',
  'fault_location',
  'symptom',
  'urgency',
  'remarks',
  'preferred_date',
  'preferred_start_time',
  'preferred_end_time',
  'vendor_proposed_date',
  'vendor_proposed_start_time',
  'vendor_proposed_end_time',
  'schedule_change_status',
  'vendor_name',
  'status',
  'created_at',
  'updated_at',
]

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asDateString(value: unknown) {
  const raw = asText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  return raw
}

function asTimeString(value: unknown) {
  const raw = asText(value)
  if (!/^\d{2}:\d{2}$/.test(raw)) return null
  return raw
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
    const storeId = asText(request.nextUrl.searchParams.get('storeId'))
    const statusRaw = asText(request.nextUrl.searchParams.get('status')) || 'pending'
    const status = SCHEDULE_STATUS.has(statusRaw as ScheduleChangeStatus)
      ? (statusRaw as ScheduleChangeStatus)
      : 'pending'

    const supabase = getSupabaseAdmin()
    let columns = [...NOTIFICATION_COLUMNS]
    let droppedColumns: string[] = []

    for (let attempt = 0; attempt < 30; attempt += 1) {
      let query = supabase
        .from('maintenance_requests')
        .select(columns.join(','))
        .eq('schedule_change_status', status)
        .not('vendor_proposed_date', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(50)

      if (storeId) query = query.eq('store_id', storeId)

      const { data, error } = await query
      if (!error) {
        return NextResponse.json({
          notifications: data ?? [],
          warning:
            droppedColumns.length > 0
              ? `Notifications loaded with schema fallback. Missing columns skipped: ${droppedColumns.join(', ')}`
              : undefined,
        })
      }

      const message = asErrorMessage(error)
      if (!isSchemaMismatchError(message)) throw error
      const missing = extractMissingColumnName(message)
      if (!missing || !columns.includes(missing)) throw error
      columns = columns.filter((column) => column !== missing)
      droppedColumns = [...droppedColumns, missing]
      if (columns.length === 0) throw error
    }

    throw new Error('Failed to load notifications after schema fallback retries')
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const requestId = asText(body?.requestId)
    const action = asText(body?.action)
    if (!requestId || (action !== 'approve' && action !== 'reschedule')) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: current, error: currentError } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (currentError || !current) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (action === 'approve') {
      patch.schedule_change_status = 'approved'
      patch.scheduled_date = current.vendor_proposed_date
      patch.scheduled_start_time = current.vendor_proposed_start_time
      patch.scheduled_end_time = current.vendor_proposed_end_time
    }

    if (action === 'reschedule') {
      const newDate = asDateString(body?.newDate)
      const newStart = asTimeString(body?.newStartTime)
      const newEnd = asTimeString(body?.newEndTime)
      if (!newDate || !newStart || !newEnd) {
        return NextResponse.json(
          { error: 'newDate/newStartTime/newEndTime are required for reschedule' },
          { status: 400 }
        )
      }
      patch.schedule_change_status = 'rescheduled'
      patch.preferred_date = newDate
      patch.preferred_start_time = newStart
      patch.preferred_end_time = newEnd
    }

    const { data, error } = await supabase
      .from('maintenance_requests')
      .update(patch)
      .eq('id', requestId)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ request: data })
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
