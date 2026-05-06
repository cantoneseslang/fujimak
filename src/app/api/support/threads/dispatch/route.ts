import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { createSmtpTransport, resolveEffectiveSmtpConfig } from '@/lib/effectiveSmtpConfig'

type SupportAttachment = {
  url: string
  mimeType: string
  source: 'image' | 'video'
}

const FALLBACK_MECHANIC_MAP: Record<string, { name: string; email: string }> = {
  'fallback-mechanic-1': { name: 'mechanicA', email: 'mechanica@fujimak.local' },
  'fallback-mechanic-2': { name: 'mechanicB', email: 'mechanicb@fujimak.local' },
  'fallback-mechanic-3': { name: 'mechanicC', email: 'mechanicc@fujimak.local' },
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

function extractMissingColumnName(message: string) {
  const singleQuoted = message.match(/'([^']+)' column/)
  if (singleQuoted?.[1]) return singleQuoted[1]
  const doubleQuoted = message.match(/column "([^"]+)"/)
  if (doubleQuoted?.[1]) return doubleQuoted[1]
  return ''
}

async function insertMaintenanceRequestWithFallback(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  payload: Record<string, unknown>
) {
  const workingPayload: Record<string, unknown> = { ...payload }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .insert(workingPayload)
      .select('*')
      .single()
    if (!error && data) return data as Record<string, unknown>
    const message = asErrorMessage(error)
    if (!isMissingColumnError(message)) throw error
    const missingColumn = extractMissingColumnName(message)
    if (!missingColumn || !(missingColumn in workingPayload)) throw error
    delete workingPayload[missingColumn]
  }
  throw new Error('Failed to create maintenance request after legacy fallback attempts')
}

async function sendMechanicAssignmentEmail(params: {
  to: string
  storeName: string
  machineName: string
  machineSerial: string
  faultLocation: string
  symptom: string
  preferredDate: string
}) {
  const smtpConfig = await resolveEffectiveSmtpConfig()
  if (!smtpConfig) return
  const transporter = createSmtpTransport(smtpConfig)
  const subject = `New Mechanic Assignment (${params.storeName})`
  const text = [
    'You have a new assigned maintenance job.',
    `Store: ${params.storeName}`,
    `Machine: ${params.machineName} / ${params.machineSerial}`,
    `Fault: ${params.faultLocation}`,
    `Symptom: ${params.symptom}`,
    `Preferred Date: ${params.preferredDate}`,
  ].join('\n')
  await transporter.sendMail({
    from: smtpConfig.from,
    to: params.to,
    subject,
    text,
  })
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNullableText(value: unknown) {
  const text = asText(value)
  return text.length > 0 ? text : null
}

function asDate(value: unknown) {
  const raw = asText(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
}

function asTime(value: unknown) {
  const raw = asText(value)
  return /^\d{2}:\d{2}$/.test(raw) ? raw : null
}

function parseSupportAttachments(meta: unknown) {
  if (!meta || typeof meta !== 'object') return [] as SupportAttachment[]
  const raw = (meta as { attachments?: unknown }).attachments
  if (!Array.isArray(raw)) return [] as SupportAttachment[]
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as Record<string, unknown>
      const url = asText(row.url)
      const mimeType = asText(row.mimeType)
      if (!url || !mimeType) return null
      return {
        url,
        mimeType,
        source: mimeType.startsWith('video/') ? 'video' : 'image',
      } satisfies SupportAttachment
    })
    .filter((entry): entry is SupportAttachment => entry !== null)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const threadId = asText(body?.threadId)
    const machineName = asText(body?.machineName)
    const machineSerial = asText(body?.machineSerial)
    const faultLocation = asText(body?.faultLocation)
    const symptom = asText(body?.symptom)
    const preferredDate = asDate(body?.preferredDate)
    const visitDate = asDate(body?.visitDate) || preferredDate
    const preferredStartTime = asTime(body?.preferredStartTime)
    const preferredEndTime = asTime(body?.preferredEndTime)
    const mechanicId = asText(body?.mechanicId)
    const fallbackMechanic = FALLBACK_MECHANIC_MAP[mechanicId] ?? null
    const normalizedMechanicId =
      mechanicId && !fallbackMechanic && UUID_PATTERN.test(mechanicId) ? mechanicId : ''

    const missingFields: string[] = []
    if (!threadId) missingFields.push('threadId')
    if (!machineName) missingFields.push('machineName')
    if (!machineSerial) missingFields.push('machineSerial')
    if (!preferredDate) missingFields.push('preferredDate')
    if (!visitDate) missingFields.push('visitDate')
    if (!mechanicId) missingFields.push('mechanicId')
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', missingFields },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    const { data: thread, error: threadError } = await supabase
      .from('support_threads')
      .select('*')
      .eq('id', threadId)
      .single()
    if (threadError || !thread) {
      return NextResponse.json({ error: 'Support thread not found' }, { status: 404 })
    }
    const summaryFallback = asText(thread.summary)
    const resolvedFaultLocation = faultLocation || summaryFallback
    const resolvedSymptom = symptom || summaryFallback
    const resolvedMissingFields: string[] = []
    if (!resolvedFaultLocation) resolvedMissingFields.push('faultLocation')
    if (!resolvedSymptom) resolvedMissingFields.push('symptom')
    if (resolvedMissingFields.length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', missingFields: resolvedMissingFields },
        { status: 400 }
      )
    }
    if (thread.maintenance_request_id) {
      return NextResponse.json(
        {
          error: 'Thread already dispatched',
          maintenanceRequestId: thread.maintenance_request_id,
        },
        { status: 409 }
      )
    }

    const { data: userMessages } = await supabase
      .from('support_messages')
      .select('meta')
      .eq('thread_id', threadId)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(8)

    const attachments = (userMessages ?? [])
      .flatMap((message) => parseSupportAttachments(message.meta))
      .slice(0, 6)
      .map((item, index) => ({
        name: `${item.source}_${index + 1}`,
        type: item.source,
        source: 'mechanic_before',
        url: item.url,
      }))
    const photoUrls = attachments.filter((item) => item.type === 'image').map((item) => item.url)

    const intakeSnapshot = {
      machineName,
      machineSerial,
      machineModel: asText(body?.machineModel) || null,
      machineId: asText(body?.machineId) || null,
      faultLocation: resolvedFaultLocation,
      symptom: resolvedSymptom,
      preferredDate,
      visitDate,
      preferredStartTime,
      preferredEndTime,
      requestedBy: asText(body?.requestedBy) || null,
      requestedPhone: asText(body?.requestedPhone) || null,
      requestedEmail: asText(body?.requestedEmail) || null,
    }

    const contact = thread.contact && typeof thread.contact === 'object'
      ? (thread.contact as Record<string, unknown>)
      : {}

    const nowIso = new Date().toISOString()
    const baseInsertPayload = {
      store_id: asText(thread.store_id),
      store_name: asText(thread.store_name),
      category_id: 'support',
      item_id: 'customer_call',
      machine_id: asNullableText(body?.machineId),
      machine_name: machineName,
      machine_model: asNullableText(body?.machineModel),
      machine_serial: machineSerial,
      fault_location: resolvedFaultLocation,
      symptom: resolvedSymptom,
      photo_urls: photoUrls,
      request_flow: 'machine_first',
      machine_source_pages: [],
      urgency: thread.urgency === 'urgent' ? 'urgent' : 'normal',
      remarks: asText(body?.remarks) || asText(thread.summary),
      attachments,
      preferred_date: preferredDate,
      preferred_start_time: preferredStartTime,
      preferred_end_time: preferredEndTime,
      source: 'customer_call',
      troubleshooting_summary: asNullableText(thread.summary),
      requested_by: asNullableText(body?.requestedBy) ?? asNullableText(contact.surname),
      requested_phone: asNullableText(body?.requestedPhone) ?? asNullableText(contact.phone),
      requested_email: asNullableText(body?.requestedEmail) ?? asNullableText(contact.email),
      vendor_name: asNullableText(body?.vendorName),
      scheduled_date: visitDate,
      scheduled_start_time: preferredStartTime,
      scheduled_end_time: preferredEndTime,
      vendor_proposed_date: visitDate,
      vendor_proposed_start_time: preferredStartTime,
      vendor_proposed_end_time: preferredEndTime,
      schedule_change_status: 'approved',
      status: 'in_progress',
      updated_at: nowIso,
    }

    let mechanicName = ''
    let mechanicEmail = ''
    if (fallbackMechanic) {
      mechanicName = fallbackMechanic.name
      mechanicEmail = fallbackMechanic.email
    } else if (normalizedMechanicId) {
      try {
        const { data: mechanicRow } = await supabase
          .from('mechanics')
          .select('id,name,email,is_active')
          .eq('id', normalizedMechanicId)
          .single()
        if (mechanicRow && mechanicRow.is_active !== false) {
          mechanicName = asText(mechanicRow.name)
          mechanicEmail = asText(mechanicRow.email)
        }
      } catch {
        // Best effort; keep workflow working even if mechanic registry table is not ready.
      }
    }

    const insertPayload = {
      ...baseInsertPayload,
      assigned_mechanic_id: normalizedMechanicId || null,
      assignment_state: 'assigned',
      assigned_at: nowIso,
    }
    const insertBasePayload = {
      ...insertPayload,
      vendor_name:
        asNullableText(body?.vendorName) ??
        asNullableText(mechanicName) ??
        asNullableText(fallbackMechanic?.name),
    }

    const createdRequest = await insertMaintenanceRequestWithFallback(supabase, insertBasePayload)

    try {
      await supabase.from('maintenance_updates').insert({
        request_id: asText(createdRequest.id),
        from_status: null,
        to_status: 'in_progress',
        note: 'Dispatched from support thread',
        actor: asText(body?.actor) || 'management_dispatch',
      })
    } catch (error) {
      const message = asErrorMessage(error)
      if (!/column|schema cache|could not find|relation|does not exist/i.test(message)) throw error
    }

    let updatedThread: Record<string, unknown> | null = null
    const { data: dispatchedData, error: updateThreadError } = await supabase
      .from('support_threads')
      .update({
        workflow_state: 'in_progress',
        maintenance_request_id: asText(createdRequest.id),
        intake_snapshot: intakeSnapshot,
        dispatched_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', threadId)
      .select('*')
      .single()
    if (updateThreadError) {
      const message = asErrorMessage(updateThreadError)
      if (!isMissingColumnError(message)) throw updateThreadError
      const { data: fallbackThread, error: fallbackThreadError } = await supabase
        .from('support_threads')
        .update({ updated_at: nowIso })
        .eq('id', threadId)
        .select('*')
        .single()
      if (fallbackThreadError) throw fallbackThreadError
      updatedThread = fallbackThread as Record<string, unknown>
    } else {
      updatedThread = dispatchedData as Record<string, unknown>
    }

    if (normalizedMechanicId) {
      try {
        await supabase.from('mechanic_notifications').insert({
          mechanic_id: normalizedMechanicId,
          request_id: asText(createdRequest.id),
          type: 'assignment',
          title: 'New assigned job',
          body: `${asText(thread.store_name)} / ${machineName} / ${resolvedFaultLocation}`,
        })
      } catch {
        // Best effort.
      }
    }
    if (mechanicEmail) {
      try {
        await sendMechanicAssignmentEmail({
          to: mechanicEmail,
          storeName: asText(thread.store_name),
          machineName,
          machineSerial,
          faultLocation: resolvedFaultLocation,
          symptom: resolvedSymptom,
          preferredDate: visitDate || preferredDate,
        })
      } catch {
        // Best effort.
      }
    }

    return NextResponse.json({
      request: createdRequest,
      thread: updatedThread,
      missingFields: [],
      assignedMechanic: mechanicName || null,
    })
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
