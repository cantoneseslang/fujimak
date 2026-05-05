import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const visitorId = asText(body?.visitorId)
    const page = asText(body?.page)
    const userAgent = asText(body?.userAgent)
    const language = asText(body?.language)
    const screenWidth = asNumber(body?.screenWidth)
    const screenHeight = asNumber(body?.screenHeight)
    const referrer = asText(body?.referrer) || 'direct'

    if (!visitorId || !page) {
      return NextResponse.json({ success: false, error: 'visitorId and page are required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('visitor_logs').insert({
      visitor_id: visitorId,
      page,
      user_agent: userAgent || null,
      language: language || null,
      screen_width: screenWidth,
      screen_height: screenHeight,
      referrer,
    })
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    // Tracking failure should never break UX.
    return NextResponse.json({ success: false, error: asErrorMessage(error) }, { status: 200 })
  }
}
