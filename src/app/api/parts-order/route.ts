import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { parsePartsOrderDraftFromBody } from '@/lib/partsOrderApi'
import { readPartsImageDataUri } from '@/lib/partsImagePaths'
import { buildPartsOrderPdf, formatCurrency } from '@/lib/partsOrderPdf'
import { calculateOrderTotals } from '@/lib/partsOrder'

const recentOrders = new Map<string, number>()
const ORDER_TTL_MS = 15_000

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const getRecipients = async () => {
  const envRecipients = asText(process.env.FUJIMAK_ORDER_TO)
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)

  if (envRecipients.length > 0) return Array.from(new Set(envRecipients))

  const supabase = getSupabaseAdmin()
  const { data: partsRecipientSettings } = await supabase
    .from('notification_settings')
    .select('setting_key,enabled')
    .like('setting_key', 'parts_order_recipient:%')
    .eq('enabled', true)
  const partsRecipients = Array.from(
    new Set(
      (partsRecipientSettings ?? [])
        .map((entry) =>
          typeof entry?.setting_key === 'string'
            ? entry.setting_key.replace(/^parts_order_recipient:/, '').trim().toLowerCase()
            : ''
        )
        .filter((email) => email.length > 0)
    )
  )
  if (partsRecipients.length > 0) return partsRecipients

  const { data: emails } = await supabase
    .from('notification_emails')
    .select('email')
    .eq('is_active', true)
  const dbRecipients = Array.from(
    new Set(
      (emails ?? [])
        .map((entry) => (typeof entry?.email === 'string' ? entry.email.trim().toLowerCase() : ''))
        .filter((email) => email.length > 0)
    )
  )
  if (dbRecipients.length > 0) return dbRecipients

  const fallback = asText(process.env.SMTP_USER || 'info@lifesupporthk.com').toLowerCase()
  return fallback ? [fallback] : []
}

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let workflowId = ''
  try {
    const body = await request.json()
    const parsed = parsePartsOrderDraftFromBody(body)
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }
    const draft = parsed.draft
    const supabase = getSupabaseAdmin()

    const bucket = Math.floor(Date.now() / ORDER_TTL_MS)
    const idempotencyKey = `${draft.storeId}|${draft.items
      .map((i) => `${i.id}:${i.quantity}:${i.unitPrice}`)
      .join(',')}|${bucket}`
    const now = Date.now()
    for (const [key, ts] of recentOrders) {
      if (now - ts > ORDER_TTL_MS) recentOrders.delete(key)
    }
    if (recentOrders.has(idempotencyKey)) {
      return NextResponse.json({ success: true, message: 'Duplicate suppressed' })
    }
    recentOrders.set(idempotencyKey, now)

    const recipients = await getRecipients()
    const smtpPass = process.env.SMTP_PASS

    const { totalUnits, totalAmount } = calculateOrderTotals(draft.items)
    const nowText = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    const orderNo = `PO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(
      1000 + Math.random() * 9000
    )}`
    const createdAtIso = new Date().toISOString()

    const { data: createdWorkflow, error: createWorkflowError } = await supabase
      .from('parts_order_workflows')
      .insert({
        order_no: orderNo,
        store_id: draft.storeId,
        store_name: draft.storeName,
        status: 'pending',
        draft_payload: draft,
        updated_at: createdAtIso,
      })
      .select('id')
      .single()
    if (createWorkflowError || !createdWorkflow) {
      throw createWorkflowError ?? new Error('Failed to create parts workflow')
    }
    workflowId = createdWorkflow.id

    await supabase.from('parts_order_updates').insert({
      workflow_id: workflowId,
      from_status: null,
      to_status: 'pending',
      note: 'Parts order created from portal',
      actor: 'parts_portal',
    })

    const orderRows = (
      await Promise.all(
        draft.items.map(async (item) => {
          const specs = (item.specs ?? []).map((s) => escapeHtml(s)).join('<br/>')
          const rowAmount = item.quantity * item.unitPrice
          const dataUri = await readPartsImageDataUri(item.imageId)
          const imgCell = dataUri
            ? `<td style="padding:6px;border:1px solid #e5e7eb;vertical-align:middle;width:52px;"><img src="${dataUri}" width="44" height="44" alt="" style="display:block;border-radius:4px;object-fit:cover;width:44px;height:44px;" /></td>`
            : `<td style="padding:6px;border:1px solid #e5e7eb;vertical-align:middle;width:52px;text-align:center;color:#9ca3af;">—</td>`
          return `
          <tr>
            ${imgCell}
            <td style="padding:8px;border:1px solid #e5e7eb;vertical-align:top;">${escapeHtml(item.name)}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;vertical-align:top;">${specs}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;font-weight:700;">${item.quantity}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${escapeHtml(
              formatCurrency(item.unitPrice, draft.currency)
            )}</td>
            <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${escapeHtml(
              formatCurrency(rowAmount, draft.currency)
            )}</td>
          </tr>
        `
        })
      )
    ).join('')

    const pdfBuffer = await buildPartsOrderPdf(draft, orderNo, nowText)

    const subject = `Fujimak Parts Order Sheet (${draft.storeName})`
    const text = [
      'Fujimak parts order sheet has been created.',
      `Order No: ${orderNo}`,
      `From Store: ${draft.storeName} (${draft.storeId})`,
      `Machine: ${draft.machineName || draft.machineModel || '-'}${draft.machineSerial ? ` / ${draft.machineSerial}` : ''}`,
      `To: ${draft.recipient}`,
      `Currency: ${draft.currency}`,
      `Total Units: ${totalUnits}`,
      `Total Amount: ${formatCurrency(totalAmount, draft.currency)}`,
      `Notes: ${draft.notes || '-'}`,
      `Date: ${nowText}`,
    ].join('\n')

    let emailSent = false
    let emailError = ''
    if (!smtpPass) {
      emailError = 'Missing SMTP_PASS'
    } else if (recipients.length === 0) {
      emailError = 'No recipient email configured'
    } else {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.titan.email',
          port: Number(process.env.SMTP_PORT || '465'),
          secure: String(process.env.SMTP_SECURE || 'true') !== 'false',
          auth: {
            user: process.env.SMTP_USER || 'info@lifesupporthk.com',
            pass: smtpPass,
          },
        })
        await transporter.sendMail({
          from:
            process.env.SMTP_FROM ||
            `"Fujimak Maintenance" <${process.env.SMTP_USER || 'info@lifesupporthk.com'}>`,
          to: recipients.join(', '),
          subject,
          text,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:760px;padding:20px;color:#111827;">
              <h2 style="margin:0 0 12px 0;color:#111111;">${escapeHtml(subject)}</h2>
              <p style="margin:0 0 8px 0;"><strong>Order No:</strong> ${escapeHtml(orderNo)}</p>
              <p style="margin:0 0 8px 0;"><strong>From Store:</strong> ${escapeHtml(draft.storeName)} (${escapeHtml(
                draft.storeId
              )})</p>
              <p style="margin:0 0 8px 0;"><strong>Machine:</strong> ${escapeHtml(
                draft.machineName || draft.machineModel || '-'
              )}${draft.machineSerial ? ` (${escapeHtml(draft.machineSerial)})` : ''}</p>
              <p style="margin:0 0 8px 0;"><strong>To:</strong> ${escapeHtml(draft.recipient)}</p>
              <p style="margin:0 0 8px 0;"><strong>Currency:</strong> ${escapeHtml(draft.currency)}</p>
              <p style="margin:0 0 8px 0;"><strong>Total Units:</strong> ${totalUnits}</p>
              <p style="margin:0 0 8px 0;"><strong>Total Amount:</strong> ${escapeHtml(
                formatCurrency(totalAmount, draft.currency)
              )}</p>
              <p style="margin:0 0 12px 0;"><strong>Notes:</strong> ${
                draft.notes ? escapeHtml(draft.notes) : '-'
              }</p>
              <p style="margin:0 0 16px 0;color:#6b7280;"><strong>Date:</strong> ${escapeHtml(nowText)}</p>
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="padding:8px;border:1px solid #e5e7eb;background:#f3f4f6;text-align:center;width:52px;">Photo</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;background:#f3f4f6;text-align:left;">Part</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;background:#f3f4f6;text-align:left;">Spec</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;background:#f3f4f6;width:70px;">Qty</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;background:#f3f4f6;width:120px;">Unit Price</th>
                    <th style="padding:8px;border:1px solid #e5e7eb;background:#f3f4f6;width:120px;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderRows}
                </tbody>
              </table>
            </div>
          `,
          attachments: [
            {
              filename: `${orderNo}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        })
        emailSent = true
      } catch (error) {
        emailError = error instanceof Error ? error.message : 'Failed to send order email'
      }
    }

    const sentAtIso = new Date().toISOString()
    const { error: updateWorkflowError } = await supabase
      .from('parts_order_workflows')
      .update({
        status: 'processing',
        pdf_filename: `${orderNo}.pdf`,
        email_recipients: recipients,
        email_sent_at: emailSent ? sentAtIso : null,
        notes: emailError ? `[EmailPending] ${emailError}` : null,
        updated_at: sentAtIso,
      })
      .eq('id', workflowId)
    if (updateWorkflowError) throw updateWorkflowError

    await supabase.from('parts_order_updates').insert({
      workflow_id: workflowId,
      from_status: 'pending',
      to_status: 'processing',
      note: emailSent ? 'Parts order email sent successfully' : `Parts order queued without email: ${emailError}`,
      actor: 'parts_portal',
    })

    return NextResponse.json({
      success: true,
      workflowId,
      orderNo,
      status: 'processing',
      emailSent,
      warning: emailError || undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (workflowId) {
      try {
        const supabase = getSupabaseAdmin()
        const nowIso = new Date().toISOString()
        await supabase
          .from('parts_order_workflows')
          .update({
            notes: `[SendError] ${message}`,
            updated_at: nowIso,
          })
          .eq('id', workflowId)
      } catch {
        // Best effort logging only.
      }
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
