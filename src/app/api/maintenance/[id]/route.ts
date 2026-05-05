import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import type { MaintenanceStatus, ScheduleChangeStatus } from '@/lib/maintenance'

const MAINTENANCE_STATUS = new Set<MaintenanceStatus>([
  'pending',
  'in_progress',
  'completed',
  'cancelled',
])

const SCHEDULE_STATUS = new Set<ScheduleChangeStatus>(['none', 'pending', 'approved', 'rescheduled'])

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asDateString(value: unknown) {
  const raw = asText(value)
  if (!raw) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  return raw
}

function asTimeString(value: unknown) {
  const raw = asText(value)
  if (!raw) return null
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

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const requestId = asText(id)
    if (!requestId) {
      return NextResponse.json({ error: 'Missing request id' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('maintenance_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    return NextResponse.json({ request: data })
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const requestId = asText(id)
    if (!requestId) {
      return NextResponse.json({ error: 'Missing request id' }, { status: 400 })
    }

    const body = await request.json()
    const statusRaw = asText(body?.status)
    const scheduleChangeStatusRaw = asText(body?.scheduleChangeStatus)

    if (statusRaw && !MAINTENANCE_STATUS.has(statusRaw as MaintenanceStatus)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
    }

    if (scheduleChangeStatusRaw && !SCHEDULE_STATUS.has(scheduleChangeStatusRaw as ScheduleChangeStatus)) {
      return NextResponse.json({ error: 'Invalid scheduleChangeStatus value' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: current, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('id,status')
      .eq('id', requestId)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (statusRaw) {
      patch.status = statusRaw
      if (statusRaw === 'completed') {
        patch.completed_at = new Date().toISOString()
      }
    }

    const scheduledDate = asDateString(body?.scheduledDate)
    const scheduledStartTime = asTimeString(body?.scheduledStartTime)
    const scheduledEndTime = asTimeString(body?.scheduledEndTime)
    if (scheduledDate) patch.scheduled_date = scheduledDate
    if (scheduledStartTime) patch.scheduled_start_time = scheduledStartTime
    if (scheduledEndTime) patch.scheduled_end_time = scheduledEndTime

    const vendorProposedDate = asDateString(body?.vendorProposedDate)
    const vendorProposedStartTime = asTimeString(body?.vendorProposedStartTime)
    const vendorProposedEndTime = asTimeString(body?.vendorProposedEndTime)
    if (vendorProposedDate) patch.vendor_proposed_date = vendorProposedDate
    if (vendorProposedStartTime) patch.vendor_proposed_start_time = vendorProposedStartTime
    if (vendorProposedEndTime) patch.vendor_proposed_end_time = vendorProposedEndTime

    if (scheduleChangeStatusRaw) {
      patch.schedule_change_status = scheduleChangeStatusRaw
    }

    const remarks = asText(body?.remarks)
    if (remarks) patch.remarks = remarks

    const { data, error } = await supabase
      .from('maintenance_requests')
      .update(patch)
      .eq('id', requestId)
      .select('*')
      .single()

    if (error) throw error

    if (statusRaw && statusRaw !== current.status) {
      await supabase.from('maintenance_updates').insert({
        request_id: requestId,
        from_status: current.status,
        to_status: statusRaw,
        note: asText(body?.note) || null,
        actor: asText(body?.actor) || 'portal',
      })
    }

    return NextResponse.json({ request: data })
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
