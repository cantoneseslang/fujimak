import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import type { MaintenanceStatus, MaintenanceSource } from '@/lib/maintenance'

const MAINTENANCE_STATUS = new Set<MaintenanceStatus>([
  'pending',
  'in_progress',
  'completed',
  'cancelled',
])

const MAINTENANCE_SOURCE = new Set<MaintenanceSource>([
  'staff_portal',
  'customer_call',
  'troubleshooting_escalation',
])

const URGENCY_LEVELS = new Set(['urgent', 'normal', 'estimate'])
const LIGHT_LIST_COLUMNS = [
  'id',
  'store_id',
  'store_name',
  'category_id',
  'item_id',
  'machine_id',
  'machine_name',
  'machine_model',
  'machine_serial',
  'fault_location',
  'symptom',
  'request_flow',
  'urgency',
  'remarks',
  'preferred_date',
  'preferred_start_time',
  'preferred_end_time',
  'scheduled_date',
  'scheduled_start_time',
  'scheduled_end_time',
  'vendor_proposed_date',
  'vendor_proposed_start_time',
  'vendor_proposed_end_time',
  'schedule_change_status',
  'source',
  'troubleshooting_summary',
  'requested_by',
  'requested_phone',
  'requested_email',
  'vendor_name',
  'assigned_mechanic_id',
  'assignment_state',
  'assigned_at',
  'status',
  'completed_at',
  'created_at',
  'updated_at',
]

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableText(value: unknown) {
  const t = asText(value)
  return t.length > 0 ? t : null
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)
}

function asIntArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const num = Number(item)
      return Number.isFinite(num) ? Math.floor(num) : null
    })
    .filter((item): item is number => item !== null)
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

async function insertMaintenanceRequestWithFallback(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  payload: Record<string, unknown>
) {
  const workingPayload: Record<string, unknown> = { ...payload }
  const droppedColumns: string[] = []

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .insert(workingPayload)
      .select('*')
      .single()

    if (!error) {
      return { data, droppedColumns, usedPayload: workingPayload }
    }

    const message = asErrorMessage(error)
    if (!isSchemaMismatchError(message)) throw error

    const missingColumn = extractMissingColumnName(message)
    if (!missingColumn || !(missingColumn in workingPayload)) throw error

    delete workingPayload[missingColumn]
    droppedColumns.push(missingColumn)
  }

  throw new Error('Failed to insert maintenance request after schema fallback retries')
}

async function selectMaintenanceListWithFallback(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  storeId: string
  statusRaw: string
  limit: number
  full: boolean
}) {
  let columns = params.full ? ['*'] : [...LIGHT_LIST_COLUMNS]
  const droppedColumns: string[] = []

  for (let attempt = 0; attempt < 40; attempt += 1) {
    let query = params.supabase
      .from('maintenance_requests')
      .select(columns.join(','))
      .order('created_at', { ascending: false })
      .limit(params.limit)

    if (params.storeId) query = query.eq('store_id', params.storeId)
    if (params.statusRaw && MAINTENANCE_STATUS.has(params.statusRaw as MaintenanceStatus)) {
      query = query.eq('status', params.statusRaw)
    }

    const { data, error } = await query
    if (!error) {
      const rows = (data ?? []).map((row) => {
        const record = (row ?? {}) as unknown as Record<string, unknown>
        return {
          ...record,
          photo_urls: Array.isArray(record.photo_urls) ? record.photo_urls : [],
          machine_source_pages: Array.isArray(record.machine_source_pages) ? record.machine_source_pages : [],
          attachments: Array.isArray(record.attachments) ? record.attachments : [],
          request_flow: typeof record.request_flow === 'string' ? record.request_flow : 'machine_first',
        }
      })
      return { rows, droppedColumns }
    }

    if (params.full) throw error
    const message = asErrorMessage(error)
    if (!isSchemaMismatchError(message)) throw error
    const missing = extractMissingColumnName(message)
    if (!missing || !columns.includes(missing)) throw error
    columns = columns.filter((column) => column !== missing)
    droppedColumns.push(missing)
    if (columns.length === 0) throw error
  }

  throw new Error('Failed to load maintenance list after schema fallback retries')
}

type ActiveMechanic = {
  id: string
  name: string
}

async function pickAutoAssigneeMechanic(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data: mechanicsRows, error: mechanicsError } = await supabase
    .from('mechanics')
    .select('id,name,is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(100)

  if (mechanicsError) {
    const message = asErrorMessage(mechanicsError)
    if (/relation|does not exist|schema cache|could not find|column/i.test(message)) return null
    throw mechanicsError
  }

  const mechanics = (Array.isArray(mechanicsRows) ? mechanicsRows : [])
    .map((row) => {
      const record = (row ?? {}) as Record<string, unknown>
      const id = asText(record.id)
      if (!id) return null
      return {
        id,
        name: asText(record.name),
      } satisfies ActiveMechanic
    })
    .filter((row): row is ActiveMechanic => row !== null)

  if (mechanics.length === 0) return null

  const mechanicIds = mechanics.map((row) => row.id)
  const loadById = new Map<string, number>()
  for (const id of mechanicIds) loadById.set(id, 0)

  const { data: requestRows, error: requestError } = await supabase
    .from('maintenance_requests')
    .select('assigned_mechanic_id,status')
    .in('assigned_mechanic_id', mechanicIds)
    .in('status', ['pending', 'in_progress'])
    .limit(2000)

  if (!requestError && Array.isArray(requestRows)) {
    for (const row of requestRows as Array<Record<string, unknown>>) {
      const assignedId = asText(row.assigned_mechanic_id)
      if (!assignedId || !loadById.has(assignedId)) continue
      loadById.set(assignedId, (loadById.get(assignedId) ?? 0) + 1)
    }
  }

  let best = mechanics[0]!
  let bestScore = loadById.get(best.id) ?? 0
  for (const row of mechanics) {
    const score = loadById.get(row.id) ?? 0
    if (score < bestScore) {
      best = row
      bestScore = score
    }
  }

  return best
}

export async function GET(request: NextRequest) {
  try {
    const statusRaw = asText(request.nextUrl.searchParams.get('status'))
    const storeId = asText(request.nextUrl.searchParams.get('storeId'))
    const limitRaw = Number(request.nextUrl.searchParams.get('limit'))
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 100
    const full = asText(request.nextUrl.searchParams.get('full')) === '1'

    const supabase = getSupabaseAdmin()
    const { rows, droppedColumns } = await selectMaintenanceListWithFallback({
      supabase,
      storeId,
      statusRaw,
      limit,
      full,
    })

    return NextResponse.json({
      requests: rows,
      warning:
        droppedColumns.length > 0
          ? `List loaded with schema fallback. Missing columns skipped: ${droppedColumns.join(', ')}`
          : undefined,
    })
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const storeId = asText(body?.storeId)
    const storeName = asText(body?.storeName)
    const categoryId = asText(body?.categoryId) || 'machine'
    const itemId = asText(body?.itemId) || 'jet-oven'
    const machineId = asNullableText(body?.machineId)
    const machineName = asText(body?.machineName)
    const machineModel = asNullableText(body?.machineModel)
    const machineSerial = asText(body?.machineSerial)
    const faultLocation = asText(body?.faultLocation)
    const symptom = asText(body?.symptom)
    const photoUrls = asStringArray(body?.photoUrls)
    const machineSourcePages = asIntArray(body?.machineSourcePages)
    const requestedFlow = asText(body?.requestFlow)
    const configuredFlow = asText(process.env.FUJIMAK_MAINTENANCE_FLOW || 'machine_first')
    const isLegacyFlow = requestedFlow === 'legacy' || configuredFlow === 'legacy'
    const requestFlow = isLegacyFlow ? 'legacy' : 'machine_first'
    const urgency = asText(body?.urgency)
    const preferredDate = asDateString(body?.preferredDate)
    const preferredStartTime = asTimeString(body?.preferredStartTime)
    const preferredEndTime = asTimeString(body?.preferredEndTime)
    const sourceRaw = asText(body?.source) || 'staff_portal'

    if (!storeId || !storeName || !preferredDate) {
      return NextResponse.json(
        { error: 'storeId/storeName/preferredDate are required' },
        { status: 400 }
      )
    }
    if (!isLegacyFlow && (!machineName || !machineSerial || !faultLocation || !symptom)) {
      return NextResponse.json(
        {
          error:
            'machineName/machineSerial/faultLocation/symptom are required when machine-first flow is enabled',
        },
        { status: 400 }
      )
    }
    if (isLegacyFlow && (!categoryId || !itemId)) {
      return NextResponse.json(
        { error: 'categoryId/itemId are required when legacy flow is enabled' },
        { status: 400 }
      )
    }

    if (!URGENCY_LEVELS.has(urgency)) {
      return NextResponse.json({ error: 'Invalid urgency value' }, { status: 400 })
    }

    if (!MAINTENANCE_SOURCE.has(sourceRaw as MaintenanceSource)) {
      return NextResponse.json({ error: 'Invalid source value' }, { status: 400 })
    }

    const attachmentsFromBody = Array.isArray(body?.attachments)
      ? body.attachments.filter((item: unknown) => typeof item === 'object' && item !== null)
      : []
    const photoAttachments = photoUrls.map((url, index) => ({
      name: `photo_${index + 1}`,
      type: 'image',
      source: 'supabase_storage',
      url,
    }))
    const attachments = [...photoAttachments, ...attachmentsFromBody]

    const supabase = getSupabaseAdmin()
    const nowIso = new Date().toISOString()
    const autoAssignee = await pickAutoAssigneeMechanic(supabase)

    const insertPayload = {
      store_id: storeId,
      store_name: storeName,
      category_id: categoryId,
      item_id: itemId,
      machine_id: machineId,
      machine_name: machineName || null,
      machine_model: machineModel,
      machine_serial: machineSerial || null,
      fault_location: faultLocation || null,
      symptom: symptom || null,
      photo_urls: photoUrls,
      request_flow: requestFlow,
      machine_source_pages: machineSourcePages,
      urgency,
      remarks: asText(body?.remarks),
      attachments,
      preferred_date: preferredDate,
      preferred_start_time: preferredStartTime,
      preferred_end_time: preferredEndTime,
      vendor_proposed_date: preferredDate,
      vendor_proposed_start_time: preferredStartTime,
      vendor_proposed_end_time: preferredEndTime,
      schedule_change_status: 'pending',
      source: sourceRaw as MaintenanceSource,
      troubleshooting_summary: asNullableText(body?.troubleshootingSummary),
      requested_by: asNullableText(body?.requestedBy),
      requested_phone: asNullableText(body?.requestedPhone),
      requested_email: asNullableText(body?.requestedEmail),
      vendor_name: asNullableText(body?.vendorName),
      assigned_mechanic_id: autoAssignee?.id || null,
      assignment_state: autoAssignee ? 'assigned' : null,
      assigned_at: autoAssignee ? nowIso : null,
    }
    const { data, droppedColumns } = await insertMaintenanceRequestWithFallback(supabase, insertPayload)

    await supabase.from('maintenance_updates').insert({
      request_id: data.id,
      from_status: null,
      to_status: 'pending',
      note: 'Created from portal',
      actor: sourceRaw,
    })

    if (autoAssignee?.id) {
      try {
        await supabase.from('mechanic_notifications').insert({
          mechanic_id: autoAssignee.id,
          request_id: data.id,
          type: 'assignment',
          title: 'New assigned job',
          body: `${storeName} / ${machineName || machineModel || itemId} / ${faultLocation || '-'}`,
        })
      } catch {
        // best effort
      }
    }

    return NextResponse.json(
      {
        request: data,
        warning:
          droppedColumns.length > 0
            ? `Inserted with schema fallback. Missing columns skipped: ${droppedColumns.join(', ')}`
            : undefined,
      },
      { status: 201 }
    )
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
