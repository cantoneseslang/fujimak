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

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const mechanicId = asText(id)
    if (!mechanicId) {
      return NextResponse.json({ error: 'mechanic id is required' }, { status: 400 })
    }
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('mechanic_notifications')
      .select('*')
      .eq('mechanic_id', mechanicId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) {
      const message = asErrorMessage(error)
      if (/relation|does not exist|schema cache|could not find/i.test(message)) {
        return NextResponse.json({ notifications: [] })
      }
      throw error
    }
    return NextResponse.json({ notifications: data ?? [] })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const mechanicId = asText(id)
    const body = await request.json()
    const notificationId = asText(body?.notificationId)
    const markRead = body?.markRead !== false
    if (!mechanicId || !notificationId) {
      return NextResponse.json({ error: 'mechanic id and notificationId are required' }, { status: 400 })
    }
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('mechanic_notifications')
      .update({
        is_read: markRead,
        updated_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('mechanic_id', mechanicId)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ notification: data })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}
