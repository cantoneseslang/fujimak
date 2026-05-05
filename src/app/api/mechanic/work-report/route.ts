import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { buildMechanicWorkReportPdf } from '@/lib/mechanicWorkReportPdf'
import type { MaintenanceRequestRecord } from '@/lib/maintenance'

export const runtime = 'nodejs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type WorkReportMode = 'download' | 'send' | 'download_and_send'
type DemoMedia = {
  name?: string
  mimeType?: string
  dataUrl?: string
  kind?: 'image' | 'video'
}
type DemoReportPayload = {
  storeName?: string
  machineName?: string
  machineModel?: string
  machineSerial?: string
  faultLocation?: string
  symptom?: string
  remarks?: string
  requestedEmail?: string
  completedAt?: string
  workStartedAt?: string
  beforeMedia?: DemoMedia[]
  afterMedia?: DemoMedia[]
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeEmail(value: unknown) {
  const email = asText(value).toLowerCase()
  return EMAIL_RE.test(email) ? email : ''
}

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

function buildDemoRecord(payload: DemoReportPayload): MaintenanceRequestRecord {
  const nowIso = new Date().toISOString()
  const today = nowIso.slice(0, 10)
  const note = [
    '[Mechanic Work Start]',
    asText(payload.workStartedAt) ? `WorkStartedAt: ${asText(payload.workStartedAt)}` : '',
    '[Mechanic Work Complete]',
    `RecordedAt: ${asText(payload.completedAt) || nowIso}`,
    `Comment: ${asText(payload.remarks) || '-'}`,
  ]
    .filter(Boolean)
    .join('\n')

  const toAttachment = (media: DemoMedia[] | undefined, source: 'mechanic_before' | 'mechanic_after') =>
    (media ?? []).reduce<Array<{ name: string; type: 'image' | 'video'; source: 'mechanic_before' | 'mechanic_after'; url: string }>>(
      (acc, item, idx) => {
        const url = asText(item.dataUrl)
        if (!url) return acc
        acc.push({
          name: asText(item.name) || `${source}_${idx + 1}`,
          type: item.kind === 'video' || asText(item.mimeType).startsWith('video/') ? 'video' : 'image',
          source,
          url,
        })
        return acc
      },
      []
    )

  const attachments = [
    ...toAttachment(payload.beforeMedia, 'mechanic_before'),
    ...toAttachment(payload.afterMedia, 'mechanic_after'),
  ]

  return {
    id: 'demo-report',
    store_id: 'demo-store',
    store_name: asText(payload.storeName) || 'Demo Store',
    category_id: 'kitchen',
    item_id: 'jet-oven',
    machine_id: 'demo-machine-1',
    machine_name: asText(payload.machineName) || 'DEMO Jet Oven',
    machine_model: asText(payload.machineModel) || 'JO-DEMO-01',
    machine_serial: asText(payload.machineSerial) || 'DEMO-0001',
    fault_location: asText(payload.faultLocation) || 'Control Panel',
    symptom: asText(payload.symptom) || 'Demo symptom',
    photo_urls: [],
    request_flow: 'machine_first',
    machine_source_pages: [],
    urgency: 'normal',
    remarks: note,
    attachments,
    preferred_date: today,
    preferred_start_time: '10:00',
    preferred_end_time: '12:00',
    status: 'completed',
    source: 'staff_portal',
    troubleshooting_summary: null,
    requested_by: null,
    requested_phone: null,
    requested_email: asText(payload.requestedEmail) || null,
    vendor_name: 'Demo Vendor',
    scheduled_date: today,
    scheduled_start_time: '10:30',
    scheduled_end_time: '11:30',
    vendor_proposed_date: today,
    vendor_proposed_start_time: '10:30',
    vendor_proposed_end_time: '11:30',
    schedule_change_status: 'approved',
    completed_at: asText(payload.completedAt) || nowIso,
    created_at: nowIso,
    updated_at: nowIso,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const requestId = asText(body?.requestId)
    const demoData =
      body?.demoData && typeof body.demoData === 'object' ? (body.demoData as DemoReportPayload) : null
    const signatureDataUrl = asText(body?.signatureDataUrl)
    const customerEmailFromBody = normalizeEmail(body?.customerEmail)
    const modeRaw = asText(body?.mode)
    const mode: WorkReportMode =
      modeRaw === 'send' || modeRaw === 'download_and_send' ? modeRaw : 'download'
    const shouldSend = mode === 'send' || mode === 'download_and_send'

    if (!requestId && !demoData) {
      return NextResponse.json({ success: false, error: 'requestId or demoData is required' }, { status: 400 })
    }

    let record: MaintenanceRequestRecord
    if (requestId) {
      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase
        .from('maintenance_requests')
        .select('*')
        .eq('id', requestId)
        .single()
      if (error || !data) {
        return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 })
      }
      record = data as MaintenanceRequestRecord
    } else {
      record = buildDemoRecord(demoData ?? {})
    }
    const issuedAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    const reportNo = `WR-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(
      1000 + Math.random() * 9000
    )}`
    const pdfBuffer = await buildMechanicWorkReportPdf({
      request: record,
      reportNo,
      issuedAtText: issuedAt,
      signatureDataUrl,
    })
    const filename = `${reportNo}.pdf`

    const targetEmail = customerEmailFromBody || normalizeEmail(record.requested_email)
    let emailSent = false
    let emailError = ''
    let stateUpdateError = ''
    if (shouldSend && targetEmail) {
      const smtpPass = asText(process.env.SMTP_PASS)
      if (!smtpPass) {
        emailError = 'Missing SMTP_PASS'
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

          const subject = `Acceptance Report (${asText(record.store_name) || asText(record.store_id)})`
          const machineLabel = asText(record.machine_name) || asText(record.machine_model) || '-'
          const text = [
            'Maintenance acceptance report is attached.',
            `Report No: ${reportNo}`,
            `Request ID: ${record.id}`,
            `Store: ${asText(record.store_name) || asText(record.store_id)}`,
            `Machine: ${machineLabel}`,
            `Symptom: ${asText(record.symptom) || '-'}`,
            `Completed At: ${asText(record.completed_at) || issuedAt}`,
          ].join('\n')

          await transporter.sendMail({
            from:
              process.env.SMTP_FROM ||
              `"Fujimak Maintenance" <${process.env.SMTP_USER || 'info@lifesupporthk.com'}>`,
            to: targetEmail,
            subject,
            text,
            html: `
              <div style="font-family:Arial,sans-serif;padding:18px;max-width:560px;color:#111827;">
                <h2 style="margin:0 0 12px 0;">${subject}</h2>
                <p style="margin:0 0 6px 0;"><strong>Report No:</strong> ${reportNo}</p>
                <p style="margin:0 0 6px 0;"><strong>Request ID:</strong> ${record.id}</p>
                <p style="margin:0 0 6px 0;"><strong>Store:</strong> ${
                  asText(record.store_name) || asText(record.store_id)
                }</p>
                <p style="margin:0 0 6px 0;"><strong>Machine:</strong> ${machineLabel}</p>
                <p style="margin:0 0 6px 0;"><strong>Completed At:</strong> ${
                  asText(record.completed_at) || issuedAt
                }</p>
                <p style="margin:10px 0 0 0;">The attached PDF is your A4 acceptance report.</p>
              </div>
            `,
            attachments: [
              {
                filename,
                content: pdfBuffer,
                contentType: 'application/pdf',
              },
            ],
          })
          emailSent = true
        } catch (error) {
          emailError = asErrorMessage(error)
        }
      }
    } else if (shouldSend) {
      emailError = 'No valid customer email'
    }

    if (requestId && shouldSend && emailSent) {
      try {
        const nowIso = new Date().toISOString()
        const currentStatus = asText(record.status)
        const nextStatus = currentStatus === 'completed' ? 'completed' : 'in_progress'
        const patch: Record<string, unknown> = {
          report_sent_at: nowIso,
          report_sent_to: targetEmail || null,
          status: nextStatus,
          updated_at: nowIso,
        }
        if (nextStatus !== 'completed') {
          patch.completed_at = null
        }
        const supabase = getSupabaseAdmin()
        const { error: updateError } = await supabase
          .from('maintenance_requests')
          .update(patch)
          .eq('id', requestId)
        if (updateError) throw updateError

        if (nextStatus !== currentStatus) {
          await supabase.from('maintenance_updates').insert({
            request_id: requestId,
            from_status: currentStatus || null,
            to_status: nextStatus,
            note: 'Customer report email sent; waiting for invoice issuance',
            actor: 'mechanic_portal',
          })
        }

        await supabase
          .from('support_threads')
          .update({
            workflow_state: 'paperwork',
            updated_at: nowIso,
          })
          .eq('maintenance_request_id', requestId)
      } catch (error) {
        stateUpdateError = asErrorMessage(error)
      }
    }

    if (mode === 'send') {
      if (!emailSent) {
        return NextResponse.json(
          { success: false, error: emailError || 'Failed to send report email' },
          { status: 400 }
        )
      }
      return NextResponse.json({
        success: true,
        reportNo,
        filename,
        recipient: targetEmail,
        stateUpdateError: stateUpdateError || undefined,
      })
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Report-Email-Sent': emailSent ? '1' : '0',
        'X-Report-Email-Recipient': targetEmail,
        'X-Report-Email-Error': encodeURIComponent(emailError),
        'X-Report-State-Error': encodeURIComponent(stateUpdateError),
      },
    })
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
