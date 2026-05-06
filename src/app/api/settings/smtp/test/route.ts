import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { explainSmtpFailure, type SmtpLocale } from '@/lib/smtpExplainError'

export const runtime = 'nodejs'

const SMTP_SETTING_PREFIX = 'smtp_setting:'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sanitize(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function decodeSettingValue(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}

function extractSavedSmtpPass(rows: Array<{ setting_key?: unknown }>): string {
  for (const row of rows) {
    const keyRaw = typeof row.setting_key === 'string' ? row.setting_key : ''
    if (!keyRaw.startsWith(SMTP_SETTING_PREFIX)) continue
    const rest = keyRaw.slice(SMTP_SETTING_PREFIX.length)
    const delimiter = rest.indexOf(':')
    if (delimiter <= 0) continue
    const field = rest.slice(0, delimiter)
    const encoded = rest.slice(delimiter + 1)
    if (field === 'pass') return decodeSettingValue(encoded)
  }
  return ''
}

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const value = (error as { message?: unknown }).message
    if (typeof value === 'string' && value.length > 0) return value
  }
  return 'Unknown error'
}

function normalizeLocale(raw: unknown): SmtpLocale {
  const s = typeof raw === 'string' ? raw.toLowerCase().slice(0, 5) : ''
  if (s.startsWith('ja')) return 'ja'
  if (s.startsWith('zh')) return 'zh'
  if (s.startsWith('tl')) return 'tl'
  return 'en'
}

function successCopy(locale: SmtpLocale, recipient: string): string {
  if (locale === 'ja') return `接続確認とテスト送信が完了しました。宛先: ${recipient}`
  if (locale === 'zh') return `连接验证与测试邮件已发送。收件人: ${recipient}`
  if (locale === 'tl') return `Natapos ang verify at test send. Papunta sa: ${recipient}`
  return `Connection verified and test email sent to ${recipient}.`
}

function subjectCopy(locale: SmtpLocale): string {
  if (locale === 'ja') return '[FUJIMAK Maintenance] SMTP 送信テスト'
  if (locale === 'zh') return '[FUJIMAK Maintenance] SMTP 发送测试'
  if (locale === 'tl') return '[FUJIMAK Maintenance] SMTP test email'
  return '[FUJIMAK Maintenance] SMTP test email'
}

function bodyCopy(locale: SmtpLocale): string {
  if (locale === 'ja') {
    return 'これは設定画面の「送信テスト」です。このメールが届けば、同じ SMTP 設定で他画面からの送信も通る状態です（Vercel の SMTP_PASS が上書きしている場合は別）。'
  }
  if (locale === 'zh') {
    return 'This is an SMTP test from Settings. If you received this, the same SMTP config should work for other features (unless Vercel env overrides).'
  }
  if (locale === 'tl') {
    return 'SMTP test from Settings. If received, the same config should work elsewhere unless Vercel env overrides.'
  }
  return 'This is an SMTP test from FUJIMAK Maintenance Settings. If you received this email, the same SMTP credentials should work for mechanic reports and notifications—unless Vercel SMTP_* env vars override the saved password.'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const locale = normalizeLocale(body?.locale)

    const host = sanitize(body?.smtp?.host)
    const port = sanitize(body?.smtp?.port) || '465'
    const secure = body?.smtp?.secure !== false
    const user = sanitize(body?.smtp?.user)
    let pass = sanitize(body?.smtp?.pass)
    const from = sanitize(body?.smtp?.from)
    const mergeSaved = body?.mergeSavedPassword !== false

    if (!host) {
      return NextResponse.json(
        {
          ok: false,
          step: 'validate',
          explanation: explainSmtpFailure('Missing SMTP host', locale),
        },
        { status: 400 }
      )
    }
    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          step: 'validate',
          explanation: explainSmtpFailure('Missing SMTP user', locale),
        },
        { status: 400 }
      )
    }

    if (mergeSaved && !pass) {
      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase
        .from('notification_settings')
        .select('setting_key')
        .like('setting_key', `${SMTP_SETTING_PREFIX}%`)
      if (!error && data) {
        pass = extractSavedSmtpPass(data as Array<{ setting_key?: unknown }>)
      }
    }

    if (!pass) {
      return NextResponse.json(
        {
          ok: false,
          step: 'validate',
          explanation: explainSmtpFailure('Missing SMTP password', locale),
        },
        { status: 400 }
      )
    }

    const testToRaw = sanitize(body?.testTo).toLowerCase()
    const recipient = EMAIL_RE.test(testToRaw) ? testToRaw : user.toLowerCase()

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure,
      auth: { user, pass },
    })

    try {
      await transporter.verify()
    } catch (error) {
      const raw = asErrorMessage(error)
      return NextResponse.json(
        {
          ok: false,
          step: 'verify',
          explanation: explainSmtpFailure(raw, locale),
        },
        { status: 400 }
      )
    }

    const fromHeader = from || `"FUJIMAK Maintenance" <${user}>`

    try {
      await transporter.sendMail({
        from: fromHeader,
        to: recipient,
        subject: subjectCopy(locale),
        text: bodyCopy(locale),
      })
    } catch (error) {
      const raw = asErrorMessage(error)
      return NextResponse.json(
        {
          ok: false,
          step: 'send',
          explanation: explainSmtpFailure(raw, locale),
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      recipient,
      message: successCopy(locale, recipient),
      steps: { verify: true, send: true },
    })
  } catch (error) {
    const locale: SmtpLocale = 'ja'
    return NextResponse.json(
      {
        ok: false,
        step: 'server',
        explanation: explainSmtpFailure(asErrorMessage(error), locale),
      },
      { status: 500 }
    )
  }
}
