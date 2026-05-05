import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value
        .map((item) => asText(item))
        .filter((item) => item.length > 0)
    )
  )
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const supportThreadIds = asStringArray(body?.supportThreadIds)
    const maintenanceRequestIds = asStringArray(body?.maintenanceRequestIds)
    if (supportThreadIds.length === 0 && maintenanceRequestIds.length === 0) {
      return NextResponse.json({ error: 'No target IDs provided' }, { status: 400 })
    }

    const name = asText(body?.name)
    const email = asText(body?.email).toLowerCase()
    const phone = asText(body?.phone)
    const nowIso = new Date().toISOString()
    const supabase = getSupabaseAdmin()

    if (supportThreadIds.length > 0) {
      const contactPayload: Record<string, string> = {}
      if (name) {
        contactPayload.name = name
        contactPayload.surname = name
      }
      if (email) contactPayload.email = email
      if (phone) contactPayload.phone = phone
      const { error } = await supabase
        .from('support_threads')
        .update({
          contact: contactPayload,
          updated_at: nowIso,
        })
        .in('id', supportThreadIds)
      if (error) throw error
    }

    if (maintenanceRequestIds.length > 0) {
      const { error } = await supabase
        .from('maintenance_requests')
        .update({
          requested_by: name || null,
          requested_email: email || null,
          requested_phone: phone || null,
          updated_at: nowIso,
        })
        .in('id', maintenanceRequestIds)
      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      supportThreadCount: supportThreadIds.length,
      maintenanceRequestCount: maintenanceRequestIds.length,
    })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const supportThreadIds = asStringArray(body?.supportThreadIds)
    const maintenanceRequestIds = asStringArray(body?.maintenanceRequestIds)
    if (supportThreadIds.length === 0 && maintenanceRequestIds.length === 0) {
      return NextResponse.json({ error: 'No target IDs provided' }, { status: 400 })
    }
    const nowIso = new Date().toISOString()
    const supabase = getSupabaseAdmin()

    if (supportThreadIds.length > 0) {
      const { error } = await supabase
        .from('support_threads')
        .update({
          contact: {},
          updated_at: nowIso,
        })
        .in('id', supportThreadIds)
      if (error) throw error
    }

    if (maintenanceRequestIds.length > 0) {
      const { error } = await supabase
        .from('maintenance_requests')
        .update({
          requested_by: null,
          requested_email: null,
          requested_phone: null,
          updated_at: nowIso,
        })
        .in('id', maintenanceRequestIds)
      if (error) throw error
    }

    return NextResponse.json({
      success: true,
      supportThreadCount: supportThreadIds.length,
      maintenanceRequestCount: maintenanceRequestIds.length,
    })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}

