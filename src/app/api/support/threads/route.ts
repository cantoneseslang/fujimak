import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

function normText(v: unknown) {
  return typeof v === 'string' ? v.trim() : ''
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

const WORKFLOW_STATES = new Set([
  'pending',
  'ready_for_dispatch',
  'in_progress',
  'paperwork',
  'awaiting_invoice',
  'completed',
  'closed',
])

const LEGACY_SELECT = 'id,store_id,store_name,status,urgency,summary,contact,created_at,updated_at'
const EXTENDED_SELECT =
  'id,store_id,store_name,status,urgency,summary,contact,workflow_state,maintenance_request_id,intake_snapshot,created_at,updated_at'

function isMissingColumnError(message: string) {
  return /column|schema cache|could not find/i.test(message)
}

type ThreadRow = {
  id: string
  store_id: string
  store_name: string
  status: 'open' | 'closed'
  urgency: 'urgent' | 'normal' | null
  summary: string | null
  contact: Record<string, unknown> | null
  workflow_state?: string | null
  maintenance_request_id?: string | null
  intake_snapshot?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

function normalizeThread(row: ThreadRow) {
  const workflowState =
    typeof row.workflow_state === 'string' && row.workflow_state.length > 0
      ? row.workflow_state
      : row.status === 'closed'
        ? 'closed'
        : 'pending'
  return {
    ...row,
    workflow_state: workflowState,
    maintenance_request_id: row.maintenance_request_id ?? null,
    intake_snapshot: row.intake_snapshot ?? null,
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const status = normText(url.searchParams.get('status')) || 'open'
    const storeId = normText(url.searchParams.get('storeId'))
    const workflowState = normText(url.searchParams.get('workflowState'))

    if (!['open', 'closed', 'all'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (workflowState && workflowState !== 'all' && !WORKFLOW_STATES.has(workflowState)) {
      return NextResponse.json({ error: 'Invalid workflowState' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    let query = supabase
      .from('support_threads')
      .select(EXTENDED_SELECT)
      .order('updated_at', { ascending: false })
      .limit(200)
    if (status !== 'all') query = query.eq('status', status)
    if (storeId) query = query.eq('store_id', storeId)
    if (workflowState && workflowState !== 'all') {
      query = query.eq('workflow_state', workflowState)
    }

    const { data, error } = await query

    if (error) {
      const message = asErrorMessage(error)
      if (!isMissingColumnError(message)) throw error

      let legacyQuery = supabase
        .from('support_threads')
        .select(LEGACY_SELECT)
        .order('updated_at', { ascending: false })
        .limit(200)
      if (status !== 'all') legacyQuery = legacyQuery.eq('status', status)
      if (storeId) legacyQuery = legacyQuery.eq('store_id', storeId)
      const { data: legacyData, error: legacyError } = await legacyQuery
      if (legacyError) throw legacyError
      const normalized = (legacyData ?? []).map((row) => normalizeThread(row as ThreadRow))
      const filtered =
        workflowState && workflowState !== 'all'
          ? normalized.filter((row) => row.workflow_state === workflowState)
          : normalized
      return NextResponse.json({ threads: filtered })
    }

    const normalized = (data ?? []).map((row) => normalizeThread(row as ThreadRow))
    return NextResponse.json({ threads: normalized })
  } catch (error) {
    const msg = asErrorMessage(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const threadId = normText(body?.threadId)
    const status = normText(body?.status) || null
    const workflowState = normText(body?.workflowState) || null
    const maintenanceRequestIdRaw = body?.maintenanceRequestId
    const maintenanceRequestId =
      maintenanceRequestIdRaw === null
        ? null
        : normText(maintenanceRequestIdRaw)

    if (!threadId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    if (status && status !== 'open' && status !== 'closed') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (workflowState && !WORKFLOW_STATES.has(workflowState)) {
      return NextResponse.json({ error: 'Invalid workflowState' }, { status: 400 })
    }
    if (!status && !workflowState && maintenanceRequestIdRaw === undefined) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (status) patch.status = status
    if (workflowState) patch.workflow_state = workflowState
    if (maintenanceRequestIdRaw !== undefined) {
      patch.maintenance_request_id = maintenanceRequestId || null
    }
    if (status === 'closed' && !workflowState) {
      patch.workflow_state = 'closed'
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('support_threads')
      .update(patch)
      .eq('id', threadId)
      .select('*')
      .single()

    if (error) {
      const message = asErrorMessage(error)
      if (!isMissingColumnError(message)) throw error

      const fallbackPatch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (status) fallbackPatch.status = status
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('support_threads')
        .update(fallbackPatch)
        .eq('id', threadId)
        .select(LEGACY_SELECT)
        .single()
      if (fallbackError) throw fallbackError
      return NextResponse.json({
        thread: normalizeThread(fallbackData as ThreadRow),
        warning: 'Support workflow columns are not available yet.',
      })
    }
    return NextResponse.json({ thread: normalizeThread(data as ThreadRow) })
  } catch (error) {
    const msg = asErrorMessage(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

