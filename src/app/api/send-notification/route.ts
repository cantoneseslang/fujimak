import { fetchNotificationRecipientEmails } from '@/lib/notificationEmailsCompat'
import { createSmtpTransport, resolveEffectiveSmtpConfig } from '@/lib/effectiveSmtpConfig'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

/** Gmail SMTP — official App Password steps (not Passkeys); hints/UI link here first */
const GOOGLE_APP_PASSWORD_GUIDE_URL = 'https://support.google.com/accounts/answer/185833'

// ベストエフォート重複送信防止（同一インスタンス内・短時間）
const recentIdempotency = new Map<string, number>()
const IDEMPOTENCY_TTL_MS = 15_000
type RecipientMode = 'settings' | 'fujimak' | 'custom'

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const normalizeRecipients = (values: unknown[]) =>
  Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
        .filter((value) => value.length > 0)
    )
  )

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

async function resolveRecipients(options: {
  mode: RecipientMode
  customRecipients: unknown
  type: string
}) {
  const { mode, customRecipients, type } = options
  const supabase = getSupabaseAdmin()

  if (mode === 'custom') {
    const custom = normalizeRecipients(Array.isArray(customRecipients) ? customRecipients : [])
    if (custom.length > 0) return custom
  }

  if (mode === 'fujimak') {
    const envRecipients = normalizeRecipients(
      asText(process.env.FUJIMAK_MAINTENANCE_TO)
        .split(',')
        .map((value) => value.trim())
    )
    if (envRecipients.length > 0) return envRecipients
  }

  let settingKey = 'login_notification'
  if (type === 'maintenance') settingKey = 'maintenance_notification'
  if (type === 'store_select') settingKey = 'store_select_notification'

  const { data: setting } = await supabase
    .from('notification_settings')
    .select('enabled')
    .eq('setting_key', settingKey)
    .maybeSingle()

  // Row missing (partial migration): treat as enabled. Only skip when explicitly false.
  if (setting && setting.enabled === false) return []

  const settingsRecipients = normalizeRecipients(await fetchNotificationRecipientEmails(supabase))
  if (settingsRecipients.length > 0) return settingsRecipients

  const smtpConfig = await resolveEffectiveSmtpConfig()
  const fallback = asText(smtpConfig?.user || process.env.SMTP_USER || 'info@lifesupporthk.com').toLowerCase()
  return fallback.length > 0 ? [fallback] : []
}

function smtpUserFacingHint(errorMessage: string): string | undefined {
  const m = errorMessage.toLowerCase()
  if (
    m.includes('application-specific password') ||
    (m.includes('534') && m.includes('invalidsecondfactor'))
  ) {
    return `【公式・最初にこれ】Google アカウントでアプリパスワードを作成する手順: ${GOOGLE_APP_PASSWORD_GUIDE_URL}\n\n二段階認証がオンのアカウントでは、通常パスワードやパスキー（Passkey）では Gmail SMTP にログインできません。上記の公式ページどおりに発行した英数字だけを SMTP_PASS（Vercel）および Settings の SMTP Password に貼り付け、環境変数を変えたら Redeploy。補足（Gmail のエラー説明）: https://support.google.com/mail/?p=InvalidSecondFactor`
  }
  if (m.includes('534') && (m.includes('webloginrequired') || m.includes('log in with your web browser'))) {
    return `【公式・最初にこれ】アプリパスワード: ${GOOGLE_APP_PASSWORD_GUIDE_URL}\n\nあわせてブラウザでアカウント確認が必要な場合: https://accounts.google.com/DisplayUnlockCaptcha\n\n本番の確実な送信には SendGrid / Resend などの送信専用サービスも検討してください。`
  }
  if (m.includes('535') && m.includes('badcredentials')) {
    return `【公式・最初にこれ】アプリパスワード: ${GOOGLE_APP_PASSWORD_GUIDE_URL}\n\nログインパスワードを SMTP に入れると拒否されます。アプリパスワードに差し替えてください。`
  }
  return undefined
}

export async function POST(request: NextRequest) {
  try {
    const {
      type,
      storeName,
      deviceInfo,
      idempotencyKey,
      recipientMode,
      customRecipients,
      machineName,
      machineModel,
      machineSerial,
      faultLocation,
      symptom,
      urgency,
      preferredDate,
      preferredStartTime,
      preferredEndTime,
      requestId,
    } = await request.json()

    const smtpConfig = await resolveEffectiveSmtpConfig()
    if (!smtpConfig) {
      return NextResponse.json({
        success: true,
        delivered: false,
        skipped: true,
        message: `Notification skipped: no SMTP password. Gmail の場合はまず公式どおりアプリパスワードを作成: ${GOOGLE_APP_PASSWORD_GUIDE_URL} — 作成後、Vercel の SMTP_PASS に設定するか、Settings の SMTP Password に保存してください（Vercel 変更後は Redeploy）。`,
      })
    }

    const mode: RecipientMode =
      recipientMode === 'fujimak' || recipientMode === 'custom' ? recipientMode : 'settings'

    const recipients = await resolveRecipients({
      mode,
      customRecipients,
      type: asText(type),
    })

    if (recipients.length === 0) {
      return NextResponse.json({
        success: true,
        delivered: false,
        message:
          'No email recipients: maintenance notification may be OFF in Admin, or no addresses in notification_emails and SMTP_USER is empty.',
      })
    }

    // 同一イベントの短時間重複送信を抑止（フロント二重発火など）
    const key = typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0
      ? idempotencyKey.trim()
      : `type:${type ?? 'unknown'}|store:${storeName ?? ''}|machine:${machineModel ?? ''}|serial:${machineSerial ?? ''}|fault:${faultLocation ?? ''}|device:${deviceInfo?.device ?? ''}|bucket:${Math.floor(Date.now() / IDEMPOTENCY_TTL_MS)}`

    const nowMs = Date.now()
    // purge
    for (const [k, ts] of recentIdempotency) {
      if (nowMs - ts > IDEMPOTENCY_TTL_MS) recentIdempotency.delete(k)
    }
    const last = recentIdempotency.get(key)
    if (last && nowMs - last < IDEMPOTENCY_TTL_MS) {
      return NextResponse.json({ success: true, delivered: false, message: 'Duplicate suppressed' })
    }
    recentIdempotency.set(key, nowMs)

    // SMTPトランスポーターを作成
    const transporter = createSmtpTransport(smtpConfig)

    // 日時を取得
    const now = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })

    // メール内容を設定
    let subject = 'fujimak-maintenance通知'
    let message = ''
    let storeInfo = ''
    let maintenanceInfoHtml = ''
    let maintenanceInfoText = ''
    
    switch (type) {
      case 'login':
        subject = 'fujimak-maintenanceログイン通知'
        message = 'ユーザーログインを確認しました。'
        break
      case 'store_select':
        subject = 'fujimak-maintenance店舗選択通知'
        message = '店舗が選択されました。'
        storeInfo = `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">🏪 店舗名</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${storeName || '不明'}</td>
          </tr>`
        break
      case 'maintenance':
        subject = `fujimak-maintenanceメンテナンス通知${storeName ? ` (${storeName})` : ''}`
        message = 'メンテナンスリクエストが送信されました。'
        maintenanceInfoText = [
          `Request ID: ${asText(requestId) || '-'}`,
          `Machine: ${asText(machineName) || '-'}`,
          `Model: ${asText(machineModel) || '-'}`,
          `Serial: ${asText(machineSerial) || '-'}`,
          `Fault Location: ${asText(faultLocation) || '-'}`,
          `Symptom: ${asText(symptom) || '-'}`,
          `Urgency: ${asText(urgency) || '-'}`,
          `Preferred Date: ${asText(preferredDate) || '-'} ${asText(preferredStartTime) || '--:--'} - ${asText(preferredEndTime) || '--:--'}`,
          `Recipient Mode: ${mode}`,
        ].join('\n')
        maintenanceInfoHtml = `
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">🆔 Request ID</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(asText(requestId) || '-')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">⚙️ 機械名</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(asText(machineName) || '-')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">🔢 型式/シリアル</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(asText(machineModel) || '-')} / ${escapeHtml(asText(machineSerial) || '-')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">🧭 故障箇所</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(asText(faultLocation) || '-')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">📝 症状</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(asText(symptom) || '-')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">⚠️ 緊急度</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(asText(urgency) || '-')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">📆 希望日時</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(asText(preferredDate) || '-')} ${escapeHtml(asText(preferredStartTime) || '--:--')} - ${escapeHtml(asText(preferredEndTime) || '--:--')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">📨 宛先モード</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(mode)}</td>
          </tr>
        `
        break
    }

    // デバイス情報のHTML
    const deviceInfoHtml = deviceInfo ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        ${storeInfo}
        ${maintenanceInfoHtml}
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">📅 日時</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${now}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">📱 デバイス</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${deviceInfo.device || '不明'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">📐 画面サイズ</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${deviceInfo.screenSize || '不明'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">🌐 言語</td>
          <td style="padding: 8px 0;">${deviceInfo.language || '不明'}</td>
        </tr>
      </table>
    ` : `<p style="color: #666; font-size: 12px;">日時: ${now}</p>`

    // メール送信
    const info = await transporter.sendMail({
      from: smtpConfig.from,
      to: recipients.join(', '),
      subject: subject,
      text: `${message}${maintenanceInfoText ? `\n\n${maintenanceInfoText}` : ''}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; max-width: 500px;">
          <h2 style="color: #111111; margin-bottom: 10px;">${subject}</h2>
          <p style="margin-bottom: 15px;">${message}</p>
          <div style="background: #f4f4f5; padding: 15px; border-radius: 8px; border-left: 4px solid #111111;">
            ${deviceInfoHtml}
          </div>
        </div>
      `
    })

    return NextResponse.json({
      success: true,
      delivered: true,
      accepted: Array.isArray(info.accepted) ? info.accepted.length : 0,
      rejected: Array.isArray(info.rejected) ? info.rejected.length : 0,
    })
  } catch (error) {
    console.error('Failed to send email:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    let hint = smtpUserFacingHint(errorMessage)
    const needsAppPassword =
      /application-specific password/i.test(errorMessage) ||
      /invalidsecondfactor/i.test(errorMessage.toLowerCase())
    if (hint && needsAppPassword) {
      hint +=
        '\n\n【重要】現在は「Settings の SMTP 設定」が優先され、未設定の場合のみ Vercel の SMTP_* 環境変数を使います。Settings の SMTP Password をアプリパスワードに更新し、必要なら Vercel 側も同じ値へ揃えてください。'
      hint +=
        '\n\n会社の Google Workspace で管理者がアプリパスワードを禁止している場合は、Gmail SMTP は使えません。SendGrid / Resend 等への切り替えが必要です。'
    }
    return NextResponse.json({
      success: false,
      delivered: false,
      error: errorMessage,
      ...(hint ? { hint } : {}),
    })
  }
}
