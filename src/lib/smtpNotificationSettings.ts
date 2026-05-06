import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const SMTP_SETTING_PREFIX = 'smtp_setting:'
const SMTP_FIELDS = ['host', 'port', 'secure', 'user', 'pass', 'from'] as const

export type SmtpField = (typeof SMTP_FIELDS)[number]

export type SmtpConfig = {
  host: string
  port: string
  secure: boolean
  user: string
  pass: string
  from: string
}

function decodeSettingValue(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}

/** SMTP saved via Settings → notification_settings rows (`smtp_setting:*`). */
export async function resolveSmtpConfigFromSettings(): Promise<SmtpConfig | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('notification_settings')
    .select('setting_key')
    .like('setting_key', `${SMTP_SETTING_PREFIX}%`)

  if (error) return null

  const config: SmtpConfig = {
    host: '',
    port: '',
    secure: true,
    user: '',
    pass: '',
    from: '',
  }

  for (const row of (data ?? []) as Array<{ setting_key?: unknown }>) {
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
