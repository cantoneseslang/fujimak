import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { STORES } from '@/lib/constants'

const LIMIT_PREFIX = 'store_access_limit:'
const ENABLED_PREFIX = 'store_access_enabled:'
const DEFAULT_LIMIT = 10

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

function defaultEnabledStoreIds(limit = DEFAULT_LIMIT) {
  return STORES.slice(0, limit).map((store) => store.id)
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data: limitRows, error: limitError } = await supabase
      .from('notification_settings')
      .select('setting_key,enabled,created_at')
      .like('setting_key', `${LIMIT_PREFIX}%`)
      .order('created_at', { ascending: false })
      .limit(1)

    if (limitError) throw limitError

    const { data: enabledRows, error: enabledError } = await supabase
      .from('notification_settings')
      .select('setting_key,enabled')
      .like('setting_key', `${ENABLED_PREFIX}%`)
      .eq('enabled', true)

    if (enabledError) throw enabledError

    let limit = DEFAULT_LIMIT
    const enabledStoreIds: string[] = []
    for (const row of limitRows ?? []) {
      const key = asText(row?.setting_key)
      if (key.startsWith(LIMIT_PREFIX)) {
        const parsed = Number.parseInt(key.slice(LIMIT_PREFIX.length), 10)
        if (Number.isFinite(parsed) && parsed > 0) {
          limit = parsed
        }
      }
    }
    for (const row of enabledRows ?? []) {
      const key = asText(row?.setting_key)
      if (key.startsWith(ENABLED_PREFIX)) {
        const storeId = key.slice(ENABLED_PREFIX.length)
        if (storeId && STORES.some((store) => store.id === storeId)) enabledStoreIds.push(storeId)
      }
    }

    const selected = enabledStoreIds.length > 0 ? enabledStoreIds : defaultEnabledStoreIds(limit)
    return NextResponse.json({
      limit,
      enabledStoreIds: selected.slice(0, Math.max(1, limit)),
      totalStores: STORES.length,
    })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const rawLimit = Number(body?.limit)
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : DEFAULT_LIMIT
    const allowedStoreIdSet = new Set(STORES.map((store) => store.id))
    const enabledStoreIds = Array.isArray(body?.enabledStoreIds)
      ? Array.from(
          new Set(
            body.enabledStoreIds
              .map((value: unknown) => asText(value))
              .filter((storeId: string) => allowedStoreIdSet.has(storeId))
          )
        ).slice(0, limit)
      : defaultEnabledStoreIds(limit)

    const supabase = getSupabaseAdmin()
    const { error: deleteLimitError } = await supabase
      .from('notification_settings')
      .delete()
      .like('setting_key', `${LIMIT_PREFIX}%`)
    if (deleteLimitError) throw deleteLimitError

    const { error: deleteEnabledError } = await supabase
      .from('notification_settings')
      .delete()
      .like('setting_key', `${ENABLED_PREFIX}%`)
    if (deleteEnabledError) throw deleteEnabledError

    const rows = [
      {
        setting_key: `${LIMIT_PREFIX}${limit}`,
        enabled: true,
      },
      ...enabledStoreIds.map((storeId) => ({
        setting_key: `${ENABLED_PREFIX}${storeId}`,
        enabled: true,
      })),
    ]
    const { error: insertError } = await supabase.from('notification_settings').insert(rows)
    if (insertError) throw insertError

    return NextResponse.json({
      success: true,
      limit,
      enabledStoreIds,
      totalStores: STORES.length,
    })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}
