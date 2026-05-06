import nodemailer from 'nodemailer'
import { resolveSmtpConfigFromSettings } from '@/lib/smtpNotificationSettings'

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export type EffectiveSmtpConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

/**
 * Unified SMTP resolution for all mail-sending APIs.
 * Priority: Settings (DB) -> environment variables -> fixed defaults.
 */
export async function resolveEffectiveSmtpConfig(): Promise<EffectiveSmtpConfig | null> {
  const smtpSettings = await resolveSmtpConfigFromSettings()

  const pass = asText(smtpSettings?.pass) || asText(process.env.SMTP_PASS)
  if (!pass) return null

  const user = asText(smtpSettings?.user) || asText(process.env.SMTP_USER) || 'info@lifesupporthk.com'
  const host = asText(smtpSettings?.host) || asText(process.env.SMTP_HOST) || 'smtp.gmail.com'
  const portRaw = asText(smtpSettings?.port) || asText(process.env.SMTP_PORT) || '465'
  const port = Number(portRaw)
  const secure =
    smtpSettings?.secure === false
      ? false
      : smtpSettings?.secure === true
        ? true
        : String(asText(process.env.SMTP_SECURE) || 'true') !== 'false'
  const from =
    asText(smtpSettings?.from) || asText(process.env.SMTP_FROM) || `"Fujimak Maintenance" <${user}>`

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    secure,
    user,
    pass,
    from,
  }
}

export function createSmtpTransport(config: EffectiveSmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })
}
