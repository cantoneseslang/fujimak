'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Download, FileCheck2, RotateCcw, Send, X } from 'lucide-react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import RankWheelPicker from '@/components/RankWheelPicker'
import type { MaintenanceRequestRecord } from '@/lib/maintenance'
import {
  MAINTENANCE_CHECKLIST_LABELS,
  MAINTENANCE_CHECKLIST_COMMENT_MAX,
  defaultMaintenanceReportForm,
  normalizeMaintenanceChecklistComments,
  parseMaintenanceRank,
  rankLabel,
  type MaintenanceReportFormSnapshot,
  buildMaintenanceReportFormState,
} from '@/lib/maintenanceReportForm'
import { clearMechanicReportDraft, loadMechanicReportDraft } from '@/lib/mechanicReportDraft'

type WorkAttachment = {
  name: string
  type: 'image' | 'video'
  source: string
  url: string
}

type DemoMedia = {
  name?: string
  mimeType?: string
  dataUrl?: string
  kind?: 'image' | 'video'
}

type DemoReportDraft = {
  storeId?: string
  storeName?: string
  machineName?: string
  machineModel?: string
  machineSerial?: string
  faultLocation?: string
  symptom?: string
  remarks?: string
  completedAt?: string
  workStartedAt?: string | null
  requestedEmail?: string
  beforeMedia?: DemoMedia[]
  afterMedia?: DemoMedia[]
}

const MECHANIC_DEMO_REPORT_KEY = 'mechanic-demo-report-v1'
const MECHANIC_OPERATION_MODE_KEY = 'mechanic-operation-mode-v1'

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseAttachments(input: unknown): WorkAttachment[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as { name?: unknown; type?: unknown; source?: unknown; url?: unknown }
      const url = asText(row.url)
      if (!url) return null
      const typeRaw = asText(row.type)
      return {
        name: asText(row.name) || `attachment_${index + 1}`,
        type: typeRaw === 'video' ? 'video' : 'image',
        source: asText(row.source) || 'unknown',
        url,
      } satisfies WorkAttachment
    })
    .filter((v): v is WorkAttachment => v !== null)
}

function getLatestStartTime(remarks: string | null) {
  const text = asText(remarks)
  if (!text) return ''
  const matches = [...text.matchAll(/WorkStartedAt:\s*([^\n\r]+)/g)]
  if (matches.length === 0) return ''
  const latest = matches[matches.length - 1]?.[1]
  return latest ? latest.trim() : ''
}

function getLatestRecordedTime(remarks: string | null) {
  const text = asText(remarks)
  if (!text) return ''
  const matches = [...text.matchAll(/RecordedAt:\s*([^\n\r]+)/g)]
  if (matches.length === 0) return ''
  const latest = matches[matches.length - 1]?.[1]
  return latest ? latest.trim() : ''
}

function getLatestComment(remarks: string | null) {
  const text = asText(remarks)
  if (!text) return ''
  const matches = [...text.matchAll(/Comment:\s*([^\n\r]+)/g)]
  if (matches.length === 0) return ''
  const latest = matches[matches.length - 1]?.[1]
  return latest ? latest.trim() : ''
}

/** Preview only: PDF はサーバー側 fetch で404になると空になります。ブラウザキャッシュで残って見えることがあるため onError で明示します。 */
function EvidenceAttachmentImg(props: { url: string; name: string }) {
  const { url, name } = props
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (failed) {
    return (
      <span className="text-center text-xs leading-snug text-amber-700">
        画像を取得できません
        <span className="mt-1 block text-[11px] font-normal text-zinc-500">
          DB の attachments に残った URL を参照しています。Storage のファイルを消した場合は DB も更新してください。
        </span>
      </span>
    )
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- attachment preview URL */
    <img
      src={url}
      alt={name}
      className="max-h-[min(42vh,280px)] w-full object-contain"
      onError={() => setFailed(true)}
    />
  )
}

function buildDemoRecord(draft: DemoReportDraft): MaintenanceRequestRecord {
  const nowIso = new Date().toISOString()
  const today = nowIso.slice(0, 10)
  const startedAt = asText(draft.workStartedAt)
  const noteLines = [
    '[Mechanic Work Start]',
    startedAt ? `WorkStartedAt: ${startedAt}` : '',
    '[Mechanic Work Complete]',
    `RecordedAt: ${asText(draft.completedAt) || nowIso}`,
    `Comment: ${asText(draft.remarks) || '-'}`,
  ]
    .filter(Boolean)
    .join('\n')

  const toAttachment = (media: DemoMedia[] | undefined, source: 'mechanic_before' | 'mechanic_after') =>
    (media ?? []).reduce<
      Array<{ name: string; type: 'image' | 'video'; source: 'mechanic_before' | 'mechanic_after'; url: string }>
    >((acc, item, idx) => {
      const url = asText(item.dataUrl)
      if (!url) return acc
      const type = item.kind === 'video' || asText(item.mimeType).startsWith('video/') ? 'video' : 'image'
      acc.push({
        name: asText(item.name) || `${source}_${idx + 1}`,
        type,
        source,
        url,
      })
      return acc
    }, [])

  const attachments = [
    ...toAttachment(draft.beforeMedia, 'mechanic_before'),
    ...toAttachment(draft.afterMedia, 'mechanic_after'),
  ]

  const sid = asText(draft.storeId) || 'demo-store'
  return {
    id: `demo-mechanic-${sid}`,
    store_id: sid,
    store_name: asText(draft.storeName) || 'Demo Store',
    category_id: 'kitchen',
    item_id: 'jet-oven',
    machine_id: 'demo-machine-1',
    machine_name: asText(draft.machineName) || 'DEMO Jet Oven',
    machine_model: asText(draft.machineModel) || 'JO-DEMO-01',
    machine_serial: asText(draft.machineSerial) || 'DEMO-0001',
    fault_location: asText(draft.faultLocation) || 'Control Panel',
    symptom: asText(draft.symptom) || 'Demo sample',
    photo_urls: [],
    request_flow: 'machine_first',
    machine_source_pages: [],
    urgency: 'normal',
    remarks: noteLines,
    attachments,
    preferred_date: today,
    preferred_start_time: '10:00',
    preferred_end_time: '12:00',
    status: 'completed',
    source: 'staff_portal',
    troubleshooting_summary: null,
    requested_by: null,
    requested_phone: null,
    requested_email: asText(draft.requestedEmail) || null,
    vendor_name: 'Demo Vendor',
    scheduled_date: today,
    scheduled_start_time: '10:30',
    scheduled_end_time: '11:30',
    vendor_proposed_date: today,
    vendor_proposed_start_time: '10:30',
    vendor_proposed_end_time: '11:30',
    schedule_change_status: 'approved',
    completed_at: asText(draft.completedAt) || nowIso,
    created_at: nowIso,
    updated_at: nowIso,
  }
}

export default function MechanicReportConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tm = useTranslations('mechanic')
  const isDemoMode = searchParams.get('demo') === '1'
  const requestId = searchParams.get('requestId') || ''
  const initialEmail = searchParams.get('email') || ''

  const [loading, setLoading] = useState(true)
  const [record, setRecord] = useState<MaintenanceRequestRecord | null>(null)
  const [customerEmail, setCustomerEmail] = useState(initialEmail)
  const [isSavingPdf, setIsSavingPdf] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [operationMode, setOperationMode] = useState<'production' | 'demo'>('production')
  const [isModeConfirmOpen, setIsModeConfirmOpen] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [isSignModalOpen, setIsSignModalOpen] = useState(false)
  const [reportForm, setReportForm] = useState<MaintenanceReportFormSnapshot>(() => defaultMaintenanceReportForm())
  const modeDialogAutoCloseTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const savedMode = localStorage.getItem(MECHANIC_OPERATION_MODE_KEY)
    if (savedMode === 'demo' || savedMode === 'production') {
      setOperationMode(savedMode)
    }

    if (isDemoMode) {
      try {
        const raw = localStorage.getItem(MECHANIC_DEMO_REPORT_KEY)
        const parsed = raw ? (JSON.parse(raw) as DemoReportDraft) : {}
        const demoRecord = buildDemoRecord(parsed)
        setRecord(demoRecord)
        setCustomerEmail((prev) => (prev || parsed.requestedEmail || '').trim())
      } catch {
        setRecord(buildDemoRecord({ requestedEmail: initialEmail }))
      } finally {
        setLoading(false)
      }
      return
    }

    if (!requestId) {
      setLoading(false)
      return
    }
    const load = async () => {
      try {
        const res = await fetch(`/api/maintenance/${encodeURIComponent(requestId)}`, { cache: 'no-store' })
        const json = (await res.json()) as { request?: MaintenanceRequestRecord; error?: string }
        if (!res.ok || !json.request) {
          throw new Error(json.error || 'Failed to load maintenance record')
        }
        setRecord(json.request)
        setCustomerEmail((prev) => (prev || json.request?.requested_email || '').trim())
      } catch (error) {
        setFeedback({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to load maintenance record',
        })
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [initialEmail, isDemoMode, requestId])

  useEffect(() => {
    if (!record) return
    const base = buildMaintenanceReportFormState(record, record.mechanic_report_snapshot)
    const draft = loadMechanicReportDraft(record.id)
    if (!draft) {
      setReportForm(base)
      return
    }
    setReportForm({
      ...base,
      forBilling: draft.forBilling,
      billingNote: draft.billingNote,
      concern: draft.concern,
      checklistComments: normalizeMaintenanceChecklistComments(draft.checklistComments ?? base.checklistComments),
      rank: parseMaintenanceRank(draft.rank ?? base.rank),
    })
  }, [record])

  useEffect(() => {
    return () => {
      if (modeDialogAutoCloseTimerRef.current !== null) {
        window.clearTimeout(modeDialogAutoCloseTimerRef.current)
      }
    }
  }, [])

  const attachments = useMemo(() => parseAttachments(record?.attachments), [record?.attachments])
  const beforeImages = useMemo(
    () => attachments.filter((item) => item.source === 'mechanic_before' && item.type === 'image'),
    [attachments]
  )
  const afterImages = useMemo(
    () => attachments.filter((item) => item.source === 'mechanic_after' && item.type === 'image'),
    [attachments]
  )
  const beforeVideos = useMemo(
    () => attachments.filter((item) => item.source === 'mechanic_before' && item.type === 'video'),
    [attachments]
  )
  const afterVideos = useMemo(
    () => attachments.filter((item) => item.source === 'mechanic_after' && item.type === 'video'),
    [attachments]
  )

  const startTime = getLatestStartTime(record?.remarks ?? null)
  const recordedTime = getLatestRecordedTime(record?.remarks ?? null) || asText(record?.completed_at)
  const latestComment = getLatestComment(record?.remarks ?? null) || '-'

  const extraBeforeCount = Math.max(0, beforeImages.length - 1)
  const extraAfterCount = Math.max(0, afterImages.length - 1)

  const hasSignature = signatureDataUrl.length > 0

  const buildDemoData = () => ({
    storeName: record?.store_name,
    machineName: record?.machine_name,
    machineModel: record?.machine_model,
    machineSerial: record?.machine_serial,
    faultLocation: record?.fault_location,
    symptom: record?.symptom,
    remarks: record?.remarks,
    requestedEmail: customerEmail || record?.requested_email,
    completedAt: record?.completed_at,
    workStartedAt: getLatestStartTime(record?.remarks ?? null),
    beforeMedia: beforeImages.map((item) => ({
      name: item.name,
      mimeType: 'image/png',
      dataUrl: item.url,
      kind: 'image' as const,
    })),
    afterMedia: [
      ...afterImages.map((item) => ({
        name: item.name,
        mimeType: 'image/png',
        dataUrl: item.url,
        kind: 'image' as const,
      })),
      ...afterVideos.map((item) => ({
        name: item.name,
        mimeType: 'video/mp4',
        dataUrl: item.url,
        kind: 'video' as const,
      })),
    ],
  })

  const openSignModal = () => {
    setIsSignModalOpen(true)
    document.body.style.overflow = 'hidden'
  }

  const closeSignModal = (dataUrl?: string) => {
    setIsSignModalOpen(false)
    document.body.style.overflow = ''
    if (dataUrl !== undefined) {
      setSignatureDataUrl(dataUrl)
    }
  }

  const targetMode = operationMode === 'production' ? 'demo' : 'production'

  const closeModeConfirmDialog = () => {
    if (modeDialogAutoCloseTimerRef.current !== null) {
      window.clearTimeout(modeDialogAutoCloseTimerRef.current)
      modeDialogAutoCloseTimerRef.current = null
    }
    setIsModeConfirmOpen(false)
  }

  const openModeConfirmDialog = () => {
    setIsModeConfirmOpen(true)
    if (modeDialogAutoCloseTimerRef.current !== null) {
      window.clearTimeout(modeDialogAutoCloseTimerRef.current)
    }
    modeDialogAutoCloseTimerRef.current = window.setTimeout(() => {
      closeModeConfirmDialog()
    }, 15000)
  }

  const confirmModeSwitch = () => {
    closeModeConfirmDialog()
    const nextMode = operationMode === 'production' ? 'demo' : 'production'
    setOperationMode(nextMode)
    localStorage.setItem(MECHANIC_OPERATION_MODE_KEY, nextMode)
    setFeedback({
      type: 'success',
      message:
        nextMode === 'demo'
          ? 'Switched to DEMO mode. Return to Mechanic to use sample job.'
          : 'Switched to PRODUCTION mode. Return to Mechanic to use real jobs only.',
    })
  }

  const downloadReportPdf = async () => {
    if (!record || isSavingPdf) return
    setFeedback(null)
    setIsSavingPdf(true)
    try {
      const response = await fetch('/api/mechanic/work-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: isDemoMode ? undefined : record.id,
          demoData: isDemoMode ? buildDemoData() : undefined,
          customerEmail,
          mode: 'download',
          signatureDataUrl,
          maintenanceReport: reportForm,
        }),
      })
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error || 'Failed to generate report PDF')
      }
      const contentType = response.headers.get('Content-Type') || ''
      if (!contentType.includes('application/pdf')) {
        throw new Error('Invalid PDF response')
      }
      const blob = await response.blob()
      const cd = response.headers.get('Content-Disposition')
      let filename = 'maintenance-report.pdf'
      const m = cd?.match(/filename="([^"]+)"/)
      if (m?.[1]) filename = m[1]
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.rel = 'noopener'
      a.click()
      URL.revokeObjectURL(url)
      setFeedback({ type: 'success', message: 'Maintenance report PDF downloaded.' })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate report PDF',
      })
    } finally {
      setIsSavingPdf(false)
    }
  }

  const sendReportToCustomer = async () => {
    if (!record || isSending) return
    if (!hasSignature) {
      setFeedback({ type: 'error', message: 'Please collect customer signature before sending.' })
      return
    }
    setFeedback(null)
    setIsSending(true)
    try {
      const response = await fetch('/api/mechanic/work-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: isDemoMode ? undefined : record.id,
          demoData: isDemoMode ? buildDemoData() : undefined,
          customerEmail,
          mode: 'send',
          signatureDataUrl,
          maintenanceReport: reportForm,
        }),
      })
      const json = (await response.json()) as {
        success?: boolean
        error?: string
        recipient?: string
        stateUpdateError?: string
      }
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Failed to send report email')
      }
      setFeedback({
        type: 'success',
        message: json.stateUpdateError
          ? `Report sent to ${json.recipient || customerEmail || 'customer'}, but workflow update failed: ${json.stateUpdateError}`
          : `Report sent to ${json.recipient || customerEmail || 'customer'}. Waiting for invoice issuance.`,
      })
      clearMechanicReportDraft()
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to send report email',
      })
    } finally {
      setIsSending(false)
    }
  }

  if (!isDemoMode && !requestId) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header showBack title="Maintenance Report" />
        <main className="px-4 py-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Missing requestId. Please go back and complete a work record first.
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showBack title="Maintenance Report" onRightButtonTripleClick={openModeConfirmDialog} />

      <main className="px-3 py-5 sm:px-4 sm:py-6" style={{ paddingBottom: '420px' }}>
        {loading ? (
          <div className="mx-auto max-w-[220mm] rounded-xl bg-white p-6 text-sm text-zinc-600 shadow-sm">
            Loading report...
          </div>
        ) : record ? (
          <div className="mx-auto flex w-full max-w-[220mm] flex-col justify-center gap-4">
            <details
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
              style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
            >
              <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
                Maintenance report — finish (PDF)
              </summary>

              <details className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-zinc-800">
                  More header fields (client / dates / equipment)
                </summary>
                <div className="mt-3 grid gap-3 pb-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Form code
                  <input
                    value={reportForm.formCode}
                    onChange={(e) => setReportForm((p) => ({ ...p, formCode: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Operation date (printed)
                  <input
                    value={reportForm.operationDateText}
                    onChange={(e) => setReportForm((p) => ({ ...p, operationDateText: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Client
                  <input
                    value={reportForm.clientLabel}
                    onChange={(e) => setReportForm((p) => ({ ...p, clientLabel: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  PIC
                  <input
                    value={reportForm.picName}
                    onChange={(e) => setReportForm((p) => ({ ...p, picName: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Fault location
                  <input
                    value={reportForm.locationText}
                    onChange={(e) => setReportForm((p) => ({ ...p, locationText: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Equipment
                  <input
                    value={reportForm.equipmentLabel}
                    onChange={(e) => setReportForm((p) => ({ ...p, equipmentLabel: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Model
                  <input
                    value={reportForm.brand}
                    onChange={(e) => setReportForm((p) => ({ ...p, brand: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Serial number
                  <input
                    value={reportForm.serialNumber}
                    onChange={(e) => setReportForm((p) => ({ ...p, serialNumber: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Start time (display)
                  <input
                    value={reportForm.startTimeDisplay}
                    onChange={(e) => setReportForm((p) => ({ ...p, startTimeDisplay: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Finish time (display)
                  <input
                    value={reportForm.finishTimeDisplay}
                    onChange={(e) => setReportForm((p) => ({ ...p, finishTimeDisplay: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
                </div>
              </details>

              <p className="mt-3 text-xs text-zinc-500">
                Open each section below to edit. Save PDF uses the same order: header → FOR → checklist → ranking.
              </p>

              <details className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-zinc-800">FOR</summary>
                <div className="mt-3 space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-zinc-800">{tm('forBillingTitle')}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setReportForm((p) => ({ ...p, forBilling: 'warranty' }))}
                      className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-semibold shadow-sm transition-colors sm:max-w-[160px] ${
                        reportForm.forBilling === 'warranty'
                          ? 'border border-emerald-600 bg-emerald-600 text-white shadow-sm'
                          : 'border border-zinc-300 bg-white text-zinc-800'
                      }`}
                    >
                      {tm('warranty')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportForm((p) => ({ ...p, forBilling: 'billing' }))}
                      className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-semibold shadow-sm transition-colors sm:max-w-[160px] ${
                        reportForm.forBilling === 'billing'
                          ? 'border border-red-600 bg-red-600 text-white shadow-sm'
                          : 'border border-zinc-300 bg-white text-zinc-800'
                      }`}
                    >
                      {tm('billing')}
                    </button>
                  </div>
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  {tm('billingNoteLabel')}
                  <input
                    value={reportForm.billingNote}
                    onChange={(e) => setReportForm((p) => ({ ...p, billingNote: e.target.value }))}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
                    placeholder={tm('billingNotePlaceholder')}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  {tm('concernLabel')}
                  <textarea
                    value={reportForm.concern}
                    onChange={(e) => setReportForm((p) => ({ ...p, concern: e.target.value }))}
                    rows={2}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
                    placeholder={tm('concernPlaceholder')}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Action taken
                  <textarea
                    value={reportForm.actionTaken}
                    onChange={(e) => setReportForm((p) => ({ ...p, actionTaken: e.target.value }))}
                    rows={3}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Finish (Status F)
                  <input
                    value={reportForm.statusF}
                    onChange={(e) => setReportForm((p) => ({ ...p, statusF: e.target.value }))}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Recommendation
                  <textarea
                    value={reportForm.recommendation}
                    onChange={(e) => setReportForm((p) => ({ ...p, recommendation: e.target.value }))}
                    rows={2}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
                  />
                </label>
                </div>
              </details>

              <details className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-zinc-800">Technical checklist comments</summary>
                <div className="mt-3 space-y-3">
                <p className="text-[11px] text-zinc-500">
                  Tap NA or type a comment (max {MAINTENANCE_CHECKLIST_COMMENT_MAX} characters per line).
                </p>
                <div className="flex flex-col gap-3">
                  {MAINTENANCE_CHECKLIST_LABELS.map((label, idx) => {
                    const stored = reportForm.checklistComments[idx] ?? 'NA'
                    const isNaChoice = stored === 'NA'
                    return (
                      <div key={label} className="rounded-lg border border-zinc-200 bg-white p-2.5 shadow-sm">
                        <div className="flex flex-wrap items-start gap-2">
                          <p className="min-w-0 flex-1 text-xs font-medium text-zinc-800">
                            <span className="font-semibold text-zinc-600">{idx + 1}.</span> {label}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setReportForm((p) => {
                                const next = [...p.checklistComments]
                                next[idx] = 'NA'
                                return { ...p, checklistComments: next }
                              })
                            }
                            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              isNaChoice
                                ? 'border-red-600 bg-red-600 text-white'
                                : 'border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                            }`}
                          >
                            NA
                          </button>
                        </div>
                        <input
                          type="text"
                          value={isNaChoice ? '' : stored}
                          placeholder={isNaChoice ? 'NA' : 'Comment'}
                          onChange={(e) => {
                            const v = e.target.value.slice(0, MAINTENANCE_CHECKLIST_COMMENT_MAX)
                            setReportForm((p) => {
                              const next = [...p.checklistComments]
                              next[idx] = v
                              return { ...p, checklistComments: next }
                            })
                          }}
                          onBlur={() =>
                            setReportForm((p) => {
                              const next = [...p.checklistComments]
                              const cur = (next[idx] ?? '').trim()
                              next[idx] = cur === '' ? 'NA' : cur.slice(0, MAINTENANCE_CHECKLIST_COMMENT_MAX)
                              return { ...p, checklistComments: next }
                            })
                          }
                          className="mt-2 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                        />
                      </div>
                    )
                  })}
                </div>
                </div>
              </details>

              <details className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-zinc-800">Ranking</summary>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p id="maintenance-rank-label" className="text-xs font-semibold text-zinc-800">
                    Maintenance rank
                  </p>
                  <RankWheelPicker
                    ariaLabelledBy="maintenance-rank-label"
                    value={reportForm.rank}
                    onChange={(rank) => setReportForm((p) => ({ ...p, rank }))}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                    Condition
                    <select
                      value={reportForm.conditionLevel}
                      onChange={(e) =>
                        setReportForm((p) => ({
                          ...p,
                          conditionLevel: e.target.value as MaintenanceReportFormSnapshot['conditionLevel'],
                        }))
                      }
                      className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                    >
                      <option value="perfect">O Perfect</option>
                      <option value="not_good">Δ Not good</option>
                      <option value="dangerous">× Dangerous</option>
                    </select>
                  </label>
                </div>
                </div>
              </details>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Technician name
                  <input
                    value={reportForm.technicianName}
                    onChange={(e) => setReportForm((p) => ({ ...p, technicianName: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700">
                  Supervisor name
                  <input
                    value={reportForm.supervisorName}
                    onChange={(e) => setReportForm((p) => ({ ...p, supervisorName: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 sm:col-span-2">
                  Client signatory name (printed)
                  <input
                    value={reportForm.clientSignatoryName}
                    onChange={(e) => setReportForm((p) => ({ ...p, clientSignatoryName: e.target.value }))}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
              </div>
            </details>

            <section className="flex min-h-[min(85vh,297mm)] w-full max-w-[210mm] flex-col rounded-sm border border-zinc-300/90 bg-white p-6 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25),0_4px_16px_-4px_rgba(0,0,0,0.12)] sm:min-h-[297mm] sm:p-8 md:p-10">
              <div className="mb-6 border-b border-zinc-200 pb-4">
                <p className="text-center text-sm font-semibold tracking-wide text-zinc-700">
                  FUJIMAK PHILIPPINES CORPORATION
                </p>
                <h1 className="text-center text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">
                  Maintenance Report
                </h1>
                <div className="mt-2 flex flex-col items-end gap-1">
                  <p className="text-xs font-medium text-zinc-700">
                    Technician: {reportForm.technicianName?.trim() || '—'}
                  </p>
                  <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    {new Date().toLocaleString()}
                  </div>
                  <p className="max-w-[min(100%,14rem)] text-right text-xs font-medium text-zinc-700">
                    Finish (Status F):{' '}
                    <span className="font-normal text-zinc-600">{asText(reportForm.statusF) || '-'}</span>
                  </p>
                </div>
              </div>

              {/* Body order matches PDF: header block → FOR → checklist → ranking → photos (no duplicate inputs here) */}
              <div className="mb-4 space-y-3 text-sm text-zinc-700" style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="mb-2 font-semibold text-zinc-900">More header fields (client / dates / equipment)</p>
                  <dl className="grid gap-2 text-xs sm:grid-cols-2">
                    {(
                      [
                        ['Request ID', record.id],
                        ['Client', reportForm.clientLabel],
                        ['PIC', reportForm.picName],
                        ['Location', reportForm.locationText],
                        ['Machine', reportForm.equipmentLabel],
                        ['Model', reportForm.brand],
                        ['Serial', reportForm.serialNumber],
                        ['Form code', reportForm.formCode],
                        ['Start Time', reportForm.startTimeDisplay],
                        ['Finish Time', reportForm.finishTimeDisplay],
                        ['Operation date (printed)', reportForm.operationDateText],
                        ['Symptom', asText(record.symptom) || '-'],
                      ] satisfies ReadonlyArray<readonly [string, string]>
                    ).map(([label, value]) => (
                      <div key={label} className="border-b border-zinc-200/80 pb-1.5">
                        <dt className="font-medium text-zinc-600">{label}</dt>
                        <dd className="mt-0.5 text-zinc-800">{asText(value) || '-'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="mb-2 font-semibold text-zinc-900">FOR</p>
                  <dl className="grid gap-2 text-xs sm:grid-cols-2">
                    <div className="border-b border-zinc-200/80 pb-1.5 sm:col-span-2">
                      <dt className="font-medium text-zinc-600">
                        {reportForm.forBilling === 'warranty' ? 'Warranty' : 'Billing'}
                      </dt>
                    </div>
                    {reportForm.forBilling === 'billing' ? (
                      <div className="border-b border-zinc-200/80 pb-1.5 sm:col-span-2">
                        <dt className="font-medium text-zinc-600">If For Billing (note)</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-zinc-800">
                          {asText(reportForm.billingNote) || '—'}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3 text-xs">
                    <div>
                      <p className="font-semibold text-zinc-800">{tm('concernLabel')}</p>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-700">{asText(reportForm.concern) || '—'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-800">Action taken</p>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-700">{asText(reportForm.actionTaken) || '—'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-800">Recommendation</p>
                      <p className="mt-1 whitespace-pre-wrap text-zinc-700">{asText(reportForm.recommendation) || '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="mb-2 font-semibold text-zinc-900">Technical checklist comments</p>
                  <ul className="space-y-2 text-xs">
                    {MAINTENANCE_CHECKLIST_LABELS.map((label, idx) => (
                      <li key={label} className="border-b border-zinc-200/80 pb-2 last:border-0">
                        <span className="font-semibold text-zinc-700">
                          {idx + 1}. {label}
                        </span>
                        <span className="mt-0.5 block text-zinc-800">
                          {asText(reportForm.checklistComments[idx]) || 'NA'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="grid gap-4 text-xs text-zinc-800 sm:grid-cols-2">
                    <div>
                      <p className="font-semibold text-zinc-900">Ranking</p>
                      <p className="mt-1">
                        <span className="font-semibold text-zinc-700">Rank: </span>
                        {reportForm.rank} — {rankLabel(reportForm.rank)}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900">Condition</p>
                      <p className="mt-1 text-zinc-800">
                        {reportForm.conditionLevel === 'dangerous'
                          ? '× DANGEROUS — stop using'
                          : reportForm.conditionLevel === 'not_good'
                            ? 'Δ Not good (parts needed)'
                            : 'O Perfect'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-700"
                style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
              >
                <p className="font-semibold" style={{ marginLeft: '6px' }}>
                  Before / After evidence
                </p>
                <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div>
                    {beforeImages.length === 0 && afterImages.length === 0 ? (
                      <p className="text-zinc-500" style={{ marginLeft: '6px' }}>
                        -
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="mb-1 text-xs font-semibold text-zinc-600">Before</p>
                            <div className="flex min-h-[120px] items-center justify-center rounded border border-zinc-200 bg-zinc-50 p-1">
                              {beforeImages.length > 0 ? (
                                <EvidenceAttachmentImg
                                  url={beforeImages[beforeImages.length - 1]!.url}
                                  name={beforeImages[beforeImages.length - 1]!.name}
                                />
                              ) : (
                                <span className="text-xs text-zinc-400">—</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold text-zinc-600">After</p>
                            <div className="flex min-h-[120px] items-center justify-center rounded border border-zinc-200 bg-zinc-50 p-1">
                              {afterImages.length > 0 ? (
                                <EvidenceAttachmentImg
                                  url={afterImages[afterImages.length - 1]!.url}
                                  name={afterImages[afterImages.length - 1]!.name}
                                />
                              ) : (
                                <span className="text-xs text-zinc-400">—</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {(extraBeforeCount > 0 || extraAfterCount > 0) && (
                          <p className="mt-2 text-xs leading-relaxed text-zinc-500" style={{ marginLeft: '6px' }}>
                            このプレビューとPDFは、Before / After{' '}
                            <strong className="font-medium text-zinc-600">それぞれ最新の1枚</strong>
                            のみ表示します（複数ある場合は、いちばん後から追加された写真）。
                            {extraBeforeCount > 0 ? ` Before ほか${extraBeforeCount}枚` : ''}
                            {extraBeforeCount > 0 && extraAfterCount > 0 ? '、' : ''}
                            {extraAfterCount > 0 ? ` After ほか${extraAfterCount}枚` : ''}
                            がリクエストに添付されています。
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-700">
                      <p className="font-semibold">Before Data</p>
                      <p className="mt-2">
                        <span className="font-semibold">WorkStarted:</span> {startTime || '-'}
                      </p>
                    </div>
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-700">
                      <p className="font-semibold">After Data</p>
                      <p className="mt-2">
                        <span className="font-semibold">Recorded:</span> {recordedTime || '-'}
                      </p>
                      <p className="mt-1">
                        <span className="font-semibold">Comment:</span> {latestComment}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
              >
                <p className="text-sm font-semibold text-zinc-800" style={{ marginLeft: '6px' }}>
                  Customer Signature
                </p>
                {hasSignature ? (
                  <div className="mt-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signature preview from canvas data URL */}
                    <img
                      src={signatureDataUrl}
                      alt="Customer signature"
                      className="h-24 w-full rounded-lg border border-zinc-300 bg-white object-contain"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={openSignModal}
                        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700"
                        style={{ paddingTop: '14px', paddingBottom: '14px' }}
                      >
                        Re-sign
                      </button>
                      <button
                        type="button"
                        onClick={() => setSignatureDataUrl('')}
                        className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700"
                        style={{ paddingTop: '14px', paddingBottom: '14px' }}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openSignModal}
                    className="mt-2 flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 bg-white text-sm text-zinc-500"
                    style={{ paddingTop: '28px', paddingBottom: '28px' }}
                  >
                    <span className="text-2xl">&#9998;</span>
                    Tap to sign
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2 scroll-mb-80" style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}>
                <label className="text-sm font-semibold text-zinc-800">Customer Email (for report delivery)</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  onFocus={(event) => {
                    event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                  placeholder="customer@example.com"
                  className="w-full rounded-xl border border-zinc-300 px-3 text-sm text-zinc-800 focus:border-zinc-900 focus:outline-none"
                  style={{ paddingTop: '20px', paddingBottom: '20px' }}
                />
              </div>
            </section>
          </div>
        ) : null}

        {feedback ? (
          <p
            className={`mx-auto mt-4 w-full max-w-[220mm] rounded-lg px-3 py-2 text-sm ${
              feedback.type === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {feedback.message}
          </p>
        ) : null}

        <div className="mx-auto mt-4 w-full max-w-[220mm] border-t border-stone-300/80 px-4 py-3">
          <div className="flex w-full flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void downloadReportPdf()}
                disabled={isSavingPdf || loading || !record}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-400 bg-white px-3 text-sm font-semibold text-zinc-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                style={{ paddingTop: '20px', paddingBottom: '20px' }}
              >
                <Download className="h-4 w-4 shrink-0" strokeWidth={2} />
                {isSavingPdf ? 'Generating...' : 'Save PDF'}
              </button>
              <button
                type="button"
                onClick={() => void sendReportToCustomer()}
                disabled={isSending || loading || !record}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold shadow-sm disabled:cursor-not-allowed"
                style={{
                  backgroundColor: isSending ? '#a1a1aa' : '#18181b',
                  color: '#ffffff',
                  paddingTop: '20px',
                  paddingBottom: '20px',
                }}
              >
                <Send className="h-4 w-4 shrink-0 text-white" strokeWidth={2} />
                {isSending ? 'Sending...' : 'Send to Customer'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => router.push('/mechanic')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 shadow-sm"
              style={{ paddingTop: '16px', paddingBottom: '16px' }}
            >
              <FileCheck2 className="h-4 w-4 shrink-0" />
              Back to Mechanic
            </button>
          </div>
        </div>
      </main>

      {isModeConfirmOpen ? (
        <div
          className="fixed inset-0 z-[90] bg-black/45 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeModeConfirmDialog()
          }}
        >
          <div className="mx-auto mt-[12vh] w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-bold text-zinc-900">Switch app mode?</h2>
            <p className="mt-2 text-sm text-zinc-600">
              {targetMode === 'production'
                ? 'Demo sample will be hidden and only real scheduled jobs will be used.'
                : 'Demo sample will be enabled for workflow practice.'}
            </p>
            <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              <p>
                Current: <span className="font-semibold">{operationMode.toUpperCase()}</span>
              </p>
              <p className="mt-1">
                Target: <span className="font-semibold">{targetMode.toUpperCase()}</span>
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={closeModeConfirmDialog}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModeSwitch}
                className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                {targetMode === 'production' ? 'Switch to Production' : 'Switch to Demo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSignModalOpen ? <SignatureModal onClose={closeSignModal} initialDataUrl={signatureDataUrl} /> : null}

      <BottomNav />
    </div>
  )
}

function SignatureModal(props: { onClose: (dataUrl?: string) => void; initialDataUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const isDrawingRef = useRef(false)
  const [hasStrokes, setHasStrokes] = useState(false)

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevBodyPosition = body.style.position
    const prevBodyTop = body.style.top
    const prevBodyWidth = body.style.width
    const scrollY = window.scrollY

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    const blockTouchMove = (e: TouchEvent) => {
      e.preventDefault()
    }
    const overlay = overlayRef.current
    overlay?.addEventListener('touchmove', blockTouchMove, { passive: false })

    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      body.style.position = prevBodyPosition
      body.style.top = prevBodyTop
      body.style.width = prevBodyWidth
      window.scrollTo(0, scrollY)
      overlay?.removeEventListener('touchmove', blockTouchMove)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const dpr = window.devicePixelRatio || 1
    const w = parent.clientWidth
    const h = parent.clientHeight
    canvas.width = Math.max(1, Math.floor(w * dpr))
    canvas.height = Math.max(1, Math.floor(h * dpr))
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'

    if (props.initialDataUrl) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h)
        setHasStrokes(true)
      }
      img.src = props.initialDataUrl
    }
  }, [props.initialDataUrl])

  const getPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const startStroke = (clientX: number, clientY: number) => {
    const ctx = canvasRef.current?.getContext('2d')
    const pt = getPoint(clientX, clientY)
    if (!ctx || !pt) return
    isDrawingRef.current = true
    setHasStrokes(true)
    ctx.beginPath()
    ctx.moveTo(pt.x, pt.y)
  }

  const continueStroke = (clientX: number, clientY: number) => {
    if (!isDrawingRef.current) return
    const ctx = canvasRef.current?.getContext('2d')
    const pt = getPoint(clientX, clientY)
    if (!ctx || !pt) return
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
  }

  const endStroke = () => {
    isDrawingRef.current = false
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    setHasStrokes(false)
  }

  const handleDone = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokes) {
      props.onClose('')
      return
    }
    props.onClose(canvas.toDataURL('image/png'))
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 flex flex-col items-center justify-center bg-black/50" style={{ zIndex: 9999, overscrollBehavior: 'none' }}>
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-base font-bold text-zinc-900">Customer Signature</h2>
          <button
            type="button"
            onClick={() => props.onClose()}
            className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="px-4 pt-2 text-xs text-zinc-500">
          Sign below with finger or stylus.
        </p>

        <div className="px-4 py-2">
          <canvas
            ref={canvasRef}
            className="w-full rounded-xl border-2 border-zinc-300 bg-white"
            style={{ height: '200px' }}
            onPointerDown={(e) => {
              e.preventDefault()
              startStroke(e.clientX, e.clientY)
            }}
            onPointerMove={(e) => {
              e.preventDefault()
              continueStroke(e.clientX, e.clientY)
            }}
            onPointerUp={(e) => {
              e.preventDefault()
              endStroke()
            }}
            onPointerCancel={(e) => {
              e.preventDefault()
              endStroke()
            }}
            onTouchStart={(e) => {
              const t = e.touches[0]
              if (!t) return
              e.preventDefault()
              startStroke(t.clientX, t.clientY)
            }}
            onTouchMove={(e) => {
              const t = e.touches[0]
              if (!t) return
              e.preventDefault()
              continueStroke(t.clientX, t.clientY)
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              endStroke()
            }}
          />
        </div>

        <div className="flex gap-3 border-t border-zinc-200 px-4 py-3">
          <button
            type="button"
            onClick={clearCanvas}
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800"
            style={{ paddingTop: '20px', paddingBottom: '20px' }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="flex-1 rounded-xl px-4 text-sm font-semibold text-white"
            style={{ paddingTop: '20px', paddingBottom: '20px', backgroundColor: '#16a34a' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
