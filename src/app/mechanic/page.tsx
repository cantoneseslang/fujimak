'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Camera, PlayCircle, Wrench, X } from 'lucide-react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import {
  fetchMaintenanceRequests,
  updateMaintenanceRequest,
  type MaintenanceStatus,
  type MaintenanceRequestRecord,
} from '@/lib/maintenance'
import type { ForBillingOption } from '@/lib/maintenanceReportForm'
import { loadMechanicReportDraft, saveMechanicReportDraft } from '@/lib/mechanicReportDraft'

type LocalMedia = {
  id: string
  file: File
  fileName: string
  mimeType: string
  dataUrl: string
  kind: 'image' | 'video'
}

const MECHANIC_DEMO_REPORT_KEY = 'mechanic-demo-report-v1'
const MECHANIC_OPERATION_MODE_KEY = 'mechanic-operation-mode-v1'
const MECHANIC_PROFILE_KEY = 'mechanic-board-profile-v1'
const MAX_MEDIA_FILE_MB = 120
const MAX_MEDIA_FILE_BYTES = MAX_MEDIA_FILE_MB * 1024 * 1024

function toLocalMedia(file: File, dataUrl: string): LocalMedia {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    file,
    fileName: file.name || 'capture',
    mimeType: file.type || 'application/octet-stream',
    dataUrl,
    kind: file.type.startsWith('video/') ? 'video' : 'image',
  }
}

function formatScheduleLabel(request: MaintenanceRequestRecord) {
  const date = request.scheduled_date ?? request.vendor_proposed_date ?? request.preferred_date
  const start = request.scheduled_start_time ?? request.vendor_proposed_start_time ?? request.preferred_start_time
  const end = request.scheduled_end_time ?? request.vendor_proposed_end_time ?? request.preferred_end_time
  if (!date) return '-'
  if (!start || !end) return date
  return `${date} ${start} - ${end}`
}

function buildDemoRequest(params: {
  storeId: string
  status: MaintenanceStatus
}): MaintenanceRequestRecord {
  const nowIso = new Date().toISOString()
  const today = nowIso.slice(0, 10)
  return {
    id: `demo-mechanic-${params.storeId}`,
    store_id: params.storeId,
    store_name: 'Demo Store',
    category_id: 'kitchen',
    item_id: 'jet-oven',
    machine_id: 'demo-machine-1',
    machine_name: 'DEMO Jet Oven',
    machine_model: 'JO-DEMO-01',
    machine_serial: 'DEMO-0001',
    fault_location: 'Control Panel',
    symptom: 'Demo sample: temperature unstable during peak hours',
    photo_urls: [],
    request_flow: 'machine_first',
    machine_source_pages: [],
    urgency: 'normal',
    remarks: null,
    attachments: [],
    preferred_date: today,
    preferred_start_time: '10:00',
    preferred_end_time: '12:00',
    status: params.status,
    source: 'staff_portal',
    troubleshooting_summary: null,
    requested_by: null,
    requested_phone: null,
    requested_email: null,
    vendor_name: 'Demo Vendor',
    scheduled_date: today,
    scheduled_start_time: '10:30',
    scheduled_end_time: '11:30',
    vendor_proposed_date: today,
    vendor_proposed_start_time: '10:30',
    vendor_proposed_end_time: '11:30',
    schedule_change_status: 'approved',
    completed_at: params.status === 'completed' ? nowIso : null,
    created_at: nowIso,
    updated_at: nowIso,
  }
}

export default function MechanicPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('mechanic')
  const tItems = useTranslations('items')
  const safeItemLabel = (itemId: string | null) => {
    if (!itemId) return '-'
    try {
      return tItems(itemId)
    } catch {
      return itemId
    }
  }

  const [loading, setLoading] = useState(true)
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [requests, setRequests] = useState<MaintenanceRequestRecord[]>([])
  const [operationMode, setOperationMode] = useState<'production' | 'demo'>('production')
  const [demoStatus, setDemoStatus] = useState<MaintenanceStatus>('pending')
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [startingRequestId, setStartingRequestId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [beforeMedia, setBeforeMedia] = useState<LocalMedia[]>([])
  const [afterMedia, setAfterMedia] = useState<LocalMedia[]>([])
  const [comment, setComment] = useState('')
  const [forBilling, setForBilling] = useState<ForBillingOption>('billing')
  const [billingNote, setBillingNote] = useState('')
  const [concern, setConcern] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [workStartSavedAt, setWorkStartSavedAt] = useState<string | null>(null)
  const [isModeConfirmOpen, setIsModeConfirmOpen] = useState(false)
  const [activeMechanicId, setActiveMechanicId] = useState('')
  const [activeMechanicName, setActiveMechanicName] = useState('')

  const beforeInputRef = useRef<HTMLInputElement>(null)
  const afterInputRef = useRef<HTMLInputElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const modeDialogAutoCloseTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const storeId = localStorage.getItem('selectedStoreId')
    if (!storeId) {
      router.push('/stores')
      return
    }
    const savedMode = localStorage.getItem(MECHANIC_OPERATION_MODE_KEY)
    if (savedMode === 'demo' || savedMode === 'production') {
      setOperationMode(savedMode)
    }
    setSelectedStoreId(storeId)
    const mechanicRaw = localStorage.getItem(MECHANIC_PROFILE_KEY)
    if (mechanicRaw) {
      try {
        const parsed = JSON.parse(mechanicRaw) as {
          mechanicId?: unknown
          mechanicName?: unknown
        }
        const mechanicId = typeof parsed.mechanicId === 'string' ? parsed.mechanicId.trim() : ''
        const mechanicName = typeof parsed.mechanicName === 'string' ? parsed.mechanicName.trim() : ''
        setActiveMechanicId(mechanicId)
        setActiveMechanicName(mechanicName)
      } catch {
        setActiveMechanicId('')
        setActiveMechanicName('')
      }
    }

    const load = async () => {
      try {
        const all = await fetchMaintenanceRequests({ storeId, limit: 200 })
        setRequests(all)
      } catch {
        setRequests([])
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [router])

  const scheduledRequests = useMemo(() => {
    return requests.filter((request) => request.status === 'pending' || request.status === 'in_progress')
  }, [requests])

  const demoRequest = useMemo(() => {
    if (!selectedStoreId) return null
    return buildDemoRequest({ storeId: selectedStoreId, status: demoStatus })
  }, [demoStatus, selectedStoreId])

  const isDemoMode = operationMode === 'demo'
  const effectiveRequests = useMemo(() => {
    if (isDemoMode) return demoRequest ? [demoRequest] : []
    return scheduledRequests
  }, [demoRequest, isDemoMode, scheduledRequests])

  useEffect(() => {
    if (!selectedRequestId) {
      const requestedId = searchParams.get('requestId')
      if (requestedId && effectiveRequests.some((request) => request.id === requestedId)) {
        setSelectedRequestId(requestedId)
      } else {
        setSelectedRequestId(effectiveRequests[0]?.id ?? null)
      }
      return
    }
    if (!effectiveRequests.some((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(effectiveRequests[0]?.id ?? null)
      setBeforeMedia([])
      setAfterMedia([])
      setComment('')
      setForBilling('billing')
      setBillingNote('')
      setConcern('')
      setCustomerEmail('')
      setWorkStartSavedAt(null)
    }
  }, [effectiveRequests, searchParams, selectedRequestId])

  const selectedRequest = effectiveRequests.find((request) => request.id === selectedRequestId) ?? null

  useEffect(() => {
    if (!selectedRequest) return
    const draft = loadMechanicReportDraft(selectedRequest.id)
    if (draft) {
      setForBilling(draft.forBilling)
      setBillingNote(draft.billingNote)
      setConcern(draft.concern)
      return
    }
    setForBilling('billing')
    setBillingNote('')
    setConcern(selectedRequest.symptom ?? '')
  }, [selectedRequest?.id])

  useEffect(() => {
    if (!selectedRequest) return
    const id = selectedRequest.id
    const handle = window.setTimeout(() => {
      saveMechanicReportDraft({
        requestId: id,
        forBilling,
        billingNote,
        concern,
      })
    }, 350)
    return () => window.clearTimeout(handle)
  }, [selectedRequest?.id, forBilling, billingNote, concern])
  useEffect(() => {
    if (!selectedRequestId) {
      setCustomerEmail('')
      return
    }
    const selected = effectiveRequests.find((request) => request.id === selectedRequestId)
    if (!selected) return
    setCustomerEmail(selected.requested_email ?? '')
  }, [effectiveRequests, selectedRequestId])

  const workStarted = selectedRequest?.status === 'in_progress'
  const subtitleRaw = t('subtitle')
  const subtitle =
    subtitleRaw === 'mechanic.subtitle'
      ? 'Select a scheduled job, start work, then save before/after evidence.'
      : subtitleRaw
  const saveWorkStartLabelRaw = t('saveWorkStart')
  const saveWorkStartLabel =
    saveWorkStartLabelRaw === 'mechanic.saveWorkStart' ? 'Save Work Start' : saveWorkStartLabelRaw
  const startTimeLabelRaw = t('startTimeLabel')
  const startTimeLabel =
    startTimeLabelRaw === 'mechanic.startTimeLabel' ? 'Work Start Time' : startTimeLabelRaw
  const startSavedSuccessRaw = t('startSavedSuccess')
  const startSavedSuccess =
    startSavedSuccessRaw === 'mechanic.startSavedSuccess'
      ? 'Work start saved. Start time recorded automatically.'
      : startSavedSuccessRaw
  const customerEmailLabelRaw = t('customerEmailLabel')
  const customerEmailLabel =
    customerEmailLabelRaw === 'mechanic.customerEmailLabel'
      ? 'Customer Email (for report delivery)'
      : customerEmailLabelRaw
  const customerEmailPlaceholderRaw = t('customerEmailPlaceholder')
  const customerEmailPlaceholder =
    customerEmailPlaceholderRaw === 'mechanic.customerEmailPlaceholder'
      ? 'customer@example.com'
      : customerEmailPlaceholderRaw
  const modeSwitchHint = 'Triple tap the globe icon to switch Demo/Production mode.'
  const targetMode = operationMode === 'production' ? 'demo' : 'production'

  useEffect(() => {
    return () => {
      if (modeDialogAutoCloseTimerRef.current !== null) {
        window.clearTimeout(modeDialogAutoCloseTimerRef.current)
      }
    }
  }, [])

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

  const handleToggleOperationMode = () => {
    closeModeConfirmDialog()
    const nextMode = operationMode === 'demo' ? 'production' : 'demo'
    setOperationMode(nextMode)
    localStorage.setItem(MECHANIC_OPERATION_MODE_KEY, nextMode)
    setSelectedRequestId(null)
    setBeforeMedia([])
    setAfterMedia([])
    setComment('')
    setForBilling('billing')
    setBillingNote('')
    setConcern('')
    setCustomerEmail('')
    setWorkStartSavedAt(null)
    setError(null)
    if (nextMode === 'demo') {
      setDemoStatus('pending')
      setMessage('Demo mode enabled. Sample maintenance job loaded.')
      return
    }
    setMessage('Production mode enabled. Demo sample is hidden.')
  }

  const readFiles = async (files: FileList | null, target: 'before' | 'after') => {
    if (!files || files.length === 0) return

    const accepted: LocalMedia[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue
      if (target === 'before' && !file.type.startsWith('image/')) continue
      if (file.size > MAX_MEDIA_FILE_BYTES) {
        setError(`File is too large (max ${MAX_MEDIA_FILE_MB}MB each).`)
        continue
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result)
          else reject(new Error('Invalid file data'))
        }
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
        reader.readAsDataURL(file)
      }).catch(() => '')

      if (!dataUrl) continue
      accepted.push(toLocalMedia(file, dataUrl))
    }

    if (accepted.length === 0) return
    setError(null)
    setMessage(null)
    if (target === 'before') {
      setBeforeMedia((prev) => [...prev, ...accepted].slice(0, 8))
    } else {
      setAfterMedia((prev) => [...prev, ...accepted].slice(0, 8))
      // After adding evidence, guide user to comment box.
      setTimeout(() => {
        commentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        commentRef.current?.focus()
      }, 120)
    }
  }

  const removeMedia = (target: 'before' | 'after', id: string) => {
    if (target === 'before') {
      setBeforeMedia((prev) => prev.filter((item) => item.id !== id))
      return
    }
    setAfterMedia((prev) => prev.filter((item) => item.id !== id))
  }

  const handleStartWork = async () => {
    if (!selectedRequest) return
    if (isDemoMode) {
      setDemoStatus('in_progress')
      setError(null)
      setMessage(t('workStarted'))
      setWorkStartSavedAt(null)
      return
    }
    if (selectedRequest.status === 'in_progress') return
    setStartingRequestId(selectedRequest.id)
    setError(null)
    setMessage(null)
    try {
      const updated = await updateMaintenanceRequest(selectedRequest.id, {
        status: 'in_progress',
      })
      setRequests((prev) => prev.map((request) => (request.id === updated.id ? updated : request)))
      setMessage(t('workStarted'))
      setWorkStartSavedAt(null)
    } catch {
      setError(t('saveFailed'))
    } finally {
      setStartingRequestId(null)
    }
  }

  const handleSaveWorkStart = async () => {
    if (!selectedRequest || !workStarted) return
    if (beforeMedia.length === 0) {
      setError(t('beforeRequiredForStartSave'))
      setMessage(null)
      return
    }

    if (isDemoMode) {
      setSaving(true)
      setError(null)
      setMessage(null)
      setTimeout(() => {
        const nowIso = new Date().toISOString()
        setWorkStartSavedAt(nowIso)
        setMessage(startSavedSuccess)
        setSaving(false)
      }, 250)
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.set('requestId', selectedRequest.id)
      formData.set('comment', comment.trim())
      formData.set('markCompleted', 'false')
      formData.set('recordType', 'start')
      beforeMedia.forEach((item) => {
        formData.append('beforeFiles', item.file, item.fileName)
      })
      const res = await fetch('/api/mechanic/work-record', {
        method: 'POST',
        body: formData,
      })
      const json = (await res.json()) as {
        request?: MaintenanceRequestRecord
        error?: string
        recordedAt?: string
      }
      if (!res.ok || !json.request) {
        throw new Error(json.error ?? t('saveFailed'))
      }

      setRequests((prev) => prev.map((request) => (request.id === json.request?.id ? json.request : request)))
      setWorkStartSavedAt(json.recordedAt ?? new Date().toISOString())
      setMessage(startSavedSuccess)
    } catch (error) {
      setError(error instanceof Error ? error.message : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRecord = async (markCompleted: boolean) => {
    if (!selectedRequest || !workStarted) return
    if (isDemoMode) {
      setSaving(true)
      setError(null)
      setMessage(null)
      setTimeout(() => {
        setDemoStatus(markCompleted ? 'completed' : 'in_progress')
        setBeforeMedia([])
        setAfterMedia([])
        setComment('')
        if (markCompleted) {
          setWorkStartSavedAt(null)
          const payload = {
            storeId: selectedRequest.store_id,
            storeName: selectedRequest.store_name || 'Demo Store',
            machineName: selectedRequest.machine_name || selectedRequest.machine_model || 'DEMO Jet Oven',
            machineModel: selectedRequest.machine_model || 'JO-DEMO-01',
            machineSerial: selectedRequest.machine_serial || 'DEMO-0001',
            faultLocation: selectedRequest.fault_location || 'Control Panel',
            symptom: selectedRequest.symptom || '',
            remarks: comment || selectedRequest.remarks || '',
            completedAt: new Date().toISOString(),
            workStartedAt: workStartSavedAt,
            requestedEmail: customerEmail.trim(),
            beforeMedia: beforeMedia.map((item) => ({
              name: item.fileName,
              mimeType: item.mimeType,
              dataUrl: item.dataUrl,
              kind: item.kind,
            })),
            afterMedia: afterMedia.map((item) => ({
              name: item.fileName,
              mimeType: item.mimeType,
              dataUrl: item.dataUrl,
              kind: item.kind,
            })),
          }
          localStorage.setItem(MECHANIC_DEMO_REPORT_KEY, JSON.stringify(payload))
          const params = new URLSearchParams({ demo: '1' })
          if (customerEmail.trim().length > 0) {
            params.set('email', customerEmail.trim())
          }
          saveMechanicReportDraft({
            requestId: selectedRequest.id,
            forBilling,
            billingNote,
            concern,
          })
          router.push(`/mechanic/report-confirm?${params.toString()}`)
        }
        setMessage(markCompleted ? t('demoCompleted') : t('demoSaveSuccess'))
        setSaving(false)
      }, 250)
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const formData = new FormData()
      formData.set('requestId', selectedRequest.id)
      formData.set('comment', comment.trim())
      formData.set('markCompleted', markCompleted ? 'true' : 'false')
      formData.set('recordType', markCompleted ? 'complete' : 'progress')
      beforeMedia.forEach((item) => {
        formData.append('beforeFiles', item.file, item.fileName)
      })
      afterMedia.forEach((item) => {
        formData.append('afterFiles', item.file, item.fileName)
      })
      const res = await fetch('/api/mechanic/work-record', {
        method: 'POST',
        body: formData,
      })
      const json = (await res.json()) as { request?: MaintenanceRequestRecord; error?: string }
      if (!res.ok || !json.request) {
        throw new Error(json.error ?? t('saveFailed'))
      }

      setRequests((prev) => prev.map((request) => (request.id === json.request?.id ? json.request : request)))
      if (!markCompleted) {
        setBeforeMedia([])
        setAfterMedia([])
        setComment('')
        setMessage(t('saveSuccess'))
        return
      }

      setBeforeMedia([])
      setAfterMedia([])
      setComment('')
      setWorkStartSavedAt(null)
      const params = new URLSearchParams({ requestId: json.request.id })
      const trimmedEmail = customerEmail.trim()
      if (trimmedEmail.length > 0) {
        params.set('email', trimmedEmail)
      }
      saveMechanicReportDraft({
        requestId: json.request.id,
        forBilling,
        billingNote,
        concern,
      })
      router.push(`/mechanic/report-confirm?${params.toString()}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showBack title={t('title')} onRightButtonTripleClick={openModeConfirmDialog} />

      <main className="px-4 py-6 space-y-4" style={{ paddingBottom: '380px' }}>
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600" style={{ marginLeft: '6px' }}>{subtitle}</p>
          <p className="mt-1 text-xs font-semibold text-zinc-700" style={{ marginLeft: '6px' }}>
            Mode: {operationMode === 'demo' ? 'DEMO' : 'PRODUCTION'}
          </p>
          <p className="mt-1 text-xs text-gray-500" style={{ marginLeft: '6px' }}>
            {modeSwitchHint}
          </p>
        </section>
        {!loading && isDemoMode ? (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 shadow-sm">
            <p style={{ marginLeft: '6px' }}>
              Demo mode is ON. Sample maintenance data is shown for workflow practice.
            </p>
            <p className="mt-1 text-xs text-amber-700/80" style={{ marginLeft: '6px' }}>
              {modeSwitchHint}
            </p>
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-xl bg-white p-6 text-sm text-gray-500 shadow-sm">{t('loading')}</section>
        ) : effectiveRequests.length === 0 ? (
          <section className="rounded-xl bg-white p-6 text-sm text-gray-500 shadow-sm">{t('noScheduled')}</section>
        ) : (
          <>
            <section className="space-y-3">
              {effectiveRequests.map((request) => {
                const machineLabel =
                  request.machine_name ??
                  request.machine_model ??
                  safeItemLabel(request.item_id)
                const isSelected = request.id === selectedRequestId
                const statusLabel = request.status === 'completed'
                  ? t('statusCompleted')
                  : request.status === 'in_progress'
                    ? t('statusInProgress')
                    : t('statusPending')
              const assignedMechanicName = request.vendor_name?.trim() || ''
              const isAssignedToCurrentMechanic =
                (activeMechanicId.length > 0 && request.assigned_mechanic_id === activeMechanicId) ||
                (activeMechanicName.length > 0 &&
                  assignedMechanicName.length > 0 &&
                  assignedMechanicName.toLowerCase() === activeMechanicName.toLowerCase())

                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => {
                      setSelectedRequestId(request.id)
                      setBeforeMedia([])
                      setAfterMedia([])
                      setComment('')
                      setCustomerEmail(request.requested_email ?? '')
                      setWorkStartSavedAt(null)
                      setMessage(null)
                      setError(null)
                    }}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      isSelected
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" style={{ marginLeft: '6px' }}>{machineLabel}</p>
                        <p className={`mt-1 text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`} style={{ marginLeft: '6px' }}>
                          {request.symptom || '-'}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <p className={`mt-2 text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`} style={{ marginLeft: '6px' }}>
                      {t('scheduleLabel')}: {formatScheduleLabel(request)}
                    </p>
                    <p className={`mt-1 text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`} style={{ marginLeft: '6px' }}>
                      Assigned mechanic: {assignedMechanicName || '-'}
                    </p>
                    {isAssignedToCurrentMechanic ? (
                      <p
                        className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                        }`}
                        style={{ marginLeft: '6px' }}
                      >
                        Assigned to you
                      </p>
                    ) : null}
                  </button>
                )
              })}
            </section>

            {selectedRequest ? (
              <section className="rounded-xl bg-white p-4 shadow-sm space-y-4">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-500" style={{ marginLeft: '6px' }}>{t('selectedJob')}</p>
                  <p className="mt-1 text-sm font-medium text-gray-800" style={{ marginLeft: '6px' }}>
                    {selectedRequest.machine_name ??
                      selectedRequest.machine_model ??
                      safeItemLabel(selectedRequest.item_id)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500" style={{ marginLeft: '6px' }}>
                    {t('scheduleLabel')}: {formatScheduleLabel(selectedRequest)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500" style={{ marginLeft: '6px' }}>
                    Assigned mechanic: {selectedRequest.vendor_name?.trim() || '-'}
                  </p>
                </div>

                {isDemoMode && selectedRequest.status === 'completed' ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                      {t('demoCompleted')}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDemoStatus('pending')
                        setBeforeMedia([])
                        setAfterMedia([])
                        setComment('')
                        setForBilling('billing')
                        setBillingNote('')
                        setConcern('')
                        setCustomerEmail('')
                        setWorkStartSavedAt(null)
                        setMessage(null)
                        setError(null)
                      }}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800"
                      style={{ paddingTop: '20px', paddingBottom: '20px' }}
                    >
                      {t('resetDemo')}
                    </button>
                  </div>
                ) : !workStarted ? (
                  <button
                    type="button"
                    onClick={handleStartWork}
                    disabled={startingRequestId === selectedRequest.id}
                    className="w-full rounded-xl px-4 text-base font-semibold text-white disabled:opacity-50"
                    style={{ paddingTop: '24px', paddingBottom: '24px', backgroundColor: '#16a34a' }}
                  >
                    {startingRequestId === selectedRequest.id ? t('startWorking') : t('startWork')}
                  </button>
                ) : (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700" style={{ marginLeft: '6px' }}>
                    <span>{t('workStarted')}</span>
                  </div>
                )}

                <div className={`${!workStarted ? 'pointer-events-none opacity-50' : ''} space-y-4`}>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-800" style={{ marginLeft: '6px' }}>{t('beforeSectionTitle')}</p>
                    <p className="text-xs text-gray-500" style={{ marginLeft: '6px' }}>{t('beforeHint')}</p>
                    <input
                      ref={beforeInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={(event) => {
                        void readFiles(event.target.files, 'before')
                        event.target.value = ''
                      }}
                    />
                    <div className="flex flex-wrap gap-2" style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}>
                      {beforeMedia.map((item) => (
                        <div key={item.id} className="relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element -- camera previews use local data URLs */}
                          <img src={item.dataUrl} alt={item.fileName} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeMedia('before', item.id)}
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => beforeInputRef.current?.click()}
                        className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-600"
                      >
                        <Camera className="h-5 w-5" />
                        {t('addBeforeMedia')}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveWorkStart()}
                      disabled={saving || beforeMedia.length === 0 || !!workStartSavedAt}
                      className="w-full rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
                      style={{ marginLeft: '6px', width: 'calc(100% - 6px)', paddingTop: '20px', paddingBottom: '20px', backgroundColor: '#dc2626' }}
                    >
                      {saving ? t('saving') : saveWorkStartLabel}
                    </button>
                    {workStartSavedAt ? (
                      <p
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700"
                        style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
                      >
                        {startTimeLabel}: {new Date(workStartSavedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-800" style={{ marginLeft: '6px' }}>{t('afterSectionTitle')}</p>
                    <p className="text-xs text-gray-500" style={{ marginLeft: '6px' }}>{t('afterHint')}</p>
                    <input
                      ref={afterInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,video/*"
                      capture="environment"
                      multiple
                      onChange={(event) => {
                        void readFiles(event.target.files, 'after')
                        event.target.value = ''
                      }}
                    />
                    <div className="flex flex-wrap gap-2" style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}>
                      {afterMedia.map((item) => (
                        <div key={item.id} className="relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-black">
                          {item.kind === 'video' ? (
                            <video src={item.dataUrl} className="h-full w-full object-cover" controls />
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element -- camera previews use local data URLs */
                            <img src={item.dataUrl} alt={item.fileName} className="h-full w-full object-cover" />
                          )}
                          {item.kind === 'video' ? (
                            <div className="absolute left-1 top-1 rounded-full bg-black/60 p-1 text-white">
                              <PlayCircle className="h-3 w-3" />
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => removeMedia('after', item.id)}
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => afterInputRef.current?.click()}
                        className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-600"
                      >
                        <Camera className="h-5 w-5" />
                        {t('addAfterMedia')}
                      </button>
                    </div>
                  </div>

                  <div
                    className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 shadow-sm"
                    style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
                  >
                    <p className="text-sm font-semibold text-gray-900">{t('forBillingTitle')}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setForBilling('warranty')}
                        className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-semibold shadow-sm transition-colors sm:flex-none sm:min-w-[128px] ${
                          forBilling === 'warranty'
                            ? 'bg-red-600 text-white'
                            : 'border border-gray-300 bg-white text-gray-800'
                        }`}
                      >
                        {t('warranty')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setForBilling('billing')}
                        className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-semibold shadow-sm transition-colors sm:flex-none sm:min-w-[128px] ${
                          forBilling === 'billing'
                            ? 'bg-red-600 text-white'
                            : 'border border-gray-300 bg-white text-gray-800'
                        }`}
                      >
                        {t('billing')}
                      </button>
                    </div>
                    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-800">
                      {t('billingNoteLabel')}
                      <input
                        value={billingNote}
                        onChange={(event) => setBillingNote(event.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-normal text-gray-700 focus:border-zinc-900 focus:outline-none"
                        placeholder={t('billingNotePlaceholder')}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-semibold text-gray-800">
                      {t('concernLabel')}
                      <textarea
                        value={concern}
                        onChange={(event) => setConcern(event.target.value)}
                        rows={2}
                        placeholder={t('concernPlaceholder')}
                        className="w-full rounded-xl border border-gray-200 p-3 text-sm font-normal text-gray-700 focus:border-zinc-900 focus:outline-none"
                      />
                    </label>
                    <p className="text-xs text-gray-500">{t('reportDraftHint')}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-800" style={{ marginLeft: '6px' }}>{t('commentLabel')}</label>
                    <textarea
                      ref={commentRef}
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      onFocus={(event) => {
                        event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }}
                      placeholder={t('commentPlaceholder')}
                      className="h-28 w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-700 focus:border-zinc-900 focus:outline-none"
                      style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
                    />
                  </div>
                  <div className="space-y-2 scroll-mb-80">
                    <label className="text-sm font-semibold text-gray-800" style={{ marginLeft: '6px' }}>
                      {customerEmailLabel}
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(event) => setCustomerEmail(event.target.value)}
                      onFocus={(event) => {
                        event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }}
                      placeholder={customerEmailPlaceholder}
                      className="w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-700 focus:border-zinc-900 focus:outline-none"
                      style={{ marginLeft: '6px', width: 'calc(100% - 6px)', paddingTop: '20px', paddingBottom: '20px' }}
                    />
                  </div>

                  {message ? (
                    <p
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
                      style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
                    >
                      {message}
                    </p>
                  ) : null}
                  {error ? (
                    <p
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                      style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
                    >
                      {error}
                    </p>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveRecord(false)}
                      disabled={saving || !workStarted}
                      className="rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 disabled:opacity-60"
                      style={{ paddingTop: '20px', paddingBottom: '20px' }}
                    >
                      {saving ? t('saving') : t('saveRecord')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveRecord(true)}
                      disabled={saving || !workStarted}
                      className="rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
                      style={{ paddingTop: '20px', paddingBottom: '20px', backgroundColor: '#2563eb' }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        {saving ? t('saving') : 'Save and Get the Sign'}
                      </span>
                    </button>
                  </div>


                </div>
              </section>
            ) : null}
          </>
        )}
      </main>

      {isModeConfirmOpen ? (
        <div
          className="fixed inset-0 z-[70] bg-black/45 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeModeConfirmDialog()
            }
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
                onClick={handleToggleOperationMode}
                className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white"
              >
                {targetMode === 'production' ? 'Switch to Production' : 'Switch to Demo'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav />
    </div>
  )
}
