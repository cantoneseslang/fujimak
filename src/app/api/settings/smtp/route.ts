import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const SMTP_SETTING_PREFIX = 'smtp_setting:'
const SMTP_FIELDS = ['host', 'port', 'secure', 'user', 'pass', 'from'] as const
type SmtpField = (typeof SMTP_FIELDS)[number]

type SmtpConfig = {
  host: string
  port: string
  secure: boolean
  user: string
  pass: string
  from: string
}

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const value = (error as { message?: unknown }).message
    if (typeof value === 'string' && value.length > 0) return value
  }
  return 'Unknown error'
}

function emptySmtpConfig(): SmtpConfig {
  return {
    host: '',
    port: '',
    secure: true,
    user: '',
    pass: '',
    from: '',
  }
}

function sanitizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function encodeSettingValue(value: string) {
  return encodeURIComponent(value)
}

function decodeSettingValue(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}

function parseConfigFromRows(rows: Array<{ setting_key?: unknown }>): SmtpConfig {
  const config = emptySmtpConfig()

  for (const row of rows) {
    const keyRaw = typeof row.setting_key === 'string' ? row.setting_key : ''
    if (!keyRaw.startsWith(SMTP_SETTING_PREFIX)) continue

    const rest = keyRaw.slice(SMTP_SETTING_PREFIX.length)
    const delimiter = rest.indexOf(':')
    if (delimiter <= 0) continue
    const field = rest.slice(0, delimiter) as SmtpField
    const encoded = rest.slice(delimiter + 1)
    if (!SMTP_FIELDS.includes(field)) continue

    const value = decodeSettingValue(encoded)
    if (field === 'secure') {
      config.secure = value !== 'false'
    } else {
      config[field] = value
    }
  }

  return config
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('notification_settings')
      .select('setting_key')
      .like('setting_key', `${SMTP_SETTING_PREFIX}%`)

    if (error) throw error
    const config = parseConfigFromRows((data ?? []) as Array<{ setting_key?: unknown }>)
    return NextResponse.json({ smtp: config })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const raw = (body?.smtp ?? {}) as Record<string, unknown>
    const smtp: SmtpConfig = {
      host: sanitizeText(raw.host),
      port: sanitizeText(raw.port),
      secure: raw.secure !== false,
      user: sanitizeText(raw.user),
      pass: sanitizeText(raw.pass),
      from: sanitizeText(raw.from),
    }

    const supabase = getSupabaseAdmin()
    const { error: deleteError } = await supabase
      .from('notification_settings')
      .delete()
      .like('setting_key', `${SMTP_SETTING_PREFIX}%`)
    if (deleteError) throw deleteError

    const rows = [
      smtp.host
        ? { setting_key: `${SMTP_SETTING_PREFIX}host:${encodeSettingValue(smtp.host)}`, enabled: true }
        : null,
      smtp.port
        ? { setting_key: `${SMTP_SETTING_PREFIX}port:${encodeSettingValue(smtp.port)}`, enabled: true }
        : null,
      { setting_key: `${SMTP_SETTING_PREFIX}secure:${encodeSettingValue(smtp.secure ? 'true' : 'false')}`, enabled: true },
      smtp.user
        ? { setting_key: `${SMTP_SETTING_PREFIX}user:${encodeSettingValue(smtp.user)}`, enabled: true }
        : null,
      smtp.pass
        ? { setting_key: `${SMTP_SETTING_PREFIX}pass:${encodeSettingValue(smtp.pass)}`, enabled: true }
        : null,
      smtp.from
        ? { setting_key: `${SMTP_SETTING_PREFIX}from:${encodeSettingValue(smtp.from)}`, enabled: true }
        : null,
    ].filter((row): row is { setting_key: string; enabled: boolean } => row !== null)

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('notification_settings').insert(rows)
      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: asErrorMessage(error) }, { status: 500 })
  }
}
