'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { 
  Building2, 
  X,
  Calendar,
  Clock,
  Wrench,
  AlertCircle,
  CheckCircle2,
  MessageCircle
} from 'lucide-react'
import Header from '@/components/Header'
import { format, addDays, subDays, isSameDay, isToday } from 'date-fns'
import {
  fetchMaintenanceRequests,
  type MaintenanceRequestRecord,
} from '@/lib/maintenance'

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'paperwork' | 'completed'

interface MaintenanceRequest {
  id: string
  storeId: string
  storeName: string
  storeNameEn: string
  machineName: string | null
  machineModel: string | null
  machineSerial: string | null
  faultLocation: string | null
  symptom: string | null
  areaKey: string | null
  itemKey: string | null
  areaLabel: string
  itemLabel: string
  urgency: string
  status: string
  createdAt: Date
  scheduledDate?: Date
  completedAt?: Date
  vendorName: string
  assignedMechanicId?: string | null
}

interface SupportThread {
  id: string
  store_id: string
  store_name: string
  status: 'open' | 'closed'
  workflow_state:
    | 'pending'
    | 'ready_for_dispatch'
    | 'in_progress'
    | 'paperwork'
    | 'awaiting_invoice'
    | 'completed'
    | 'closed'
  urgency: 'urgent' | 'normal' | null
  summary: string | null
  contact: Record<string, unknown> | null
  maintenance_request_id: string | null
  intake_snapshot: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

interface SupportMessage {
  id: string
  thread_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  meta: Record<string, unknown> | null
  created_at: string
}

type SupportAttachment = {
  url: string
  mimeType: string
  source: 'image' | 'video'
}

type DispatchForm = {
  mechanicId: string
  machineName: string
  machineModel: string
  machineSerial: string
  faultLocation: string
  symptom: string
  preferredDate: string
  visitDate: string
  preferredStartTime: string
  preferredEndTime: string
  requestedBy: string
  requestedPhone: string
  requestedEmail: string
}

type PartsWorkflow = {
  id: string
  order_no: string
  store_id: string
  store_name: string
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  pdf_filename: string | null
  invoice_filename: string | null
  email_sent_at: string | null
  invoice_issued_at: string | null
  created_at: string
  updated_at: string
}

type MechanicOption = {
  id: string
  name: string
  email: string
  is_active: boolean
}

type RequestListRow =
  | {
      key: string
      kind: 'thread'
      thread: SupportThread
      workflowState: string
      linkedRequestId: string
      canGenerateInvoice: boolean
      timestamp: string
      storeName: string
      summary: string
      urgency: 'urgent' | 'normal' | null
    }
  | {
      key: string
      kind: 'request'
      request: MaintenanceRequest
      workflowState: string
      linkedRequestId: string
      canGenerateInvoice: boolean
      timestamp: string
      storeName: string
      summary: string
      urgency: 'urgent' | 'normal' | null
    }

const DEFAULT_MECHANIC_OPTIONS: MechanicOption[] = [
  { id: 'fallback-mechanic-1', name: 'mechanicA', email: 'mechanica@fujimak.local', is_active: true },
  { id: 'fallback-mechanic-2', name: 'mechanicB', email: 'mechanicb@fujimak.local', is_active: true },
  { id: 'fallback-mechanic-3', name: 'mechanicC', email: 'mechanicc@fujimak.local', is_active: true },
]

const asDate = (dateString: string | null) => (dateString ? new Date(dateString) : undefined)
const isSameYearMonth = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth()
const toValidDate = (value: string | null | undefined) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const getSupportAttachments = (meta: Record<string, unknown> | null): SupportAttachment[] => {
  if (!meta || typeof meta !== 'object') return []
  const maybe = (meta as { attachments?: unknown }).attachments
  if (!Array.isArray(maybe)) return []
  return maybe
    .filter((item): item is SupportAttachment => {
      if (!item || typeof item !== 'object') return false
      const v = item as Record<string, unknown>
      return typeof v.url === 'string' && typeof v.mimeType === 'string'
    })
    .slice(0, 3)
}

const isAttachmentLabelNoise = (content: string) => {
  const text = content.trim().toLowerCase()
  if (!text) return true
  if (/^size[-_\s]?check[-_\s]?\d+/.test(text)) return true
  if (/^\(?sent a photo\)?$/.test(text)) return true
  if (/^\(?sent (an|a) (image|photo|attachment)\)?$/.test(text)) return true
  if (/^(img|image|photo|attachment|file)[-_\s]?[a-z0-9._-]*$/.test(text)) return true
  if (!text.includes(' ') && /^[a-z0-9._-]{10,}$/.test(text)) return true
  return false
}

const mapRequestFromApi = (request: MaintenanceRequestRecord): MaintenanceRequest => ({
  id: request.id,
  storeId: request.store_id,
  storeName: request.store_name,
  storeNameEn: request.store_name,
  machineName: request.machine_name,
  machineModel: request.machine_model,
  machineSerial: request.machine_serial,
  faultLocation: request.fault_location,
  symptom: request.symptom,
  areaKey: request.category_id,
  itemKey: request.item_id,
  areaLabel: request.fault_location ?? request.category_id ?? '-',
  itemLabel:
    request.machine_name ??
    request.machine_model ??
    request.item_id ??
    '-',
  urgency: request.urgency,
  status: request.status,
  createdAt: new Date(request.created_at),
  scheduledDate: asDate(request.scheduled_date ?? request.preferred_date) ?? new Date(request.created_at),
  completedAt: asDate(request.completed_at),
  vendorName: request.vendor_name || 'Fujimak Service',
  assignedMechanicId: typeof request.assigned_mechanic_id === 'string' ? request.assigned_mechanic_id : null,
})

const buildDispatchForm = (thread?: SupportThread | null): DispatchForm => {
  const intake = thread?.intake_snapshot && typeof thread.intake_snapshot === 'object'
    ? (thread.intake_snapshot as Record<string, unknown>)
    : {}
  const rawSummaryText = typeof thread?.summary === 'string' ? thread.summary : ''
  const summaryText = isAttachmentLabelNoise(rawSummaryText) ? '' : rawSummaryText
  const today = new Date().toISOString().slice(0, 10)
  return {
    mechanicId: '',
    machineName: typeof intake.machineName === 'string' ? intake.machineName : '',
    machineModel: typeof intake.machineModel === 'string' ? intake.machineModel : '',
    machineSerial: typeof intake.machineSerial === 'string' ? intake.machineSerial : '',
    faultLocation:
      typeof intake.faultLocation === 'string' && intake.faultLocation.length > 0
        ? intake.faultLocation
        : summaryText,
    symptom:
      typeof intake.symptom === 'string'
        ? intake.symptom
        : summaryText,
    preferredDate:
      typeof intake.preferredDate === 'string' && intake.preferredDate.length > 0
        ? intake.preferredDate
        : today,
    visitDate:
      typeof intake.visitDate === 'string' && intake.visitDate.length > 0
        ? intake.visitDate
        : typeof intake.preferredDate === 'string' && intake.preferredDate.length > 0
          ? intake.preferredDate
          : today,
    preferredStartTime: typeof intake.preferredStartTime === 'string' ? intake.preferredStartTime : '',
    preferredEndTime: typeof intake.preferredEndTime === 'string' ? intake.preferredEndTime : '',
    requestedBy: typeof intake.requestedBy === 'string' ? intake.requestedBy : '',
    requestedPhone: typeof intake.requestedPhone === 'string' ? intake.requestedPhone : '',
    requestedEmail: typeof intake.requestedEmail === 'string' ? intake.requestedEmail : '',
  }
}

const getWorkflowBadgeClass = (state: string) => {
  switch (state) {
    case 'pending':
    case 'ready_for_dispatch':
      return 'bg-orange-500 text-white'
    case 'in_progress':
      return 'bg-yellow-500 text-gray-900'
    case 'paperwork':
    case 'awaiting_invoice':
      return 'bg-purple-600 text-white'
    case 'completed':
      return 'bg-green-500 text-white'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

const normalizeSupportWorkflowState = (thread: SupportThread) => {
  const state = typeof thread.workflow_state === 'string' ? thread.workflow_state : ''
  if (
    state === 'pending' ||
    state === 'ready_for_dispatch' ||
    state === 'in_progress' ||
    state === 'paperwork' ||
    state === 'awaiting_invoice' ||
    state === 'completed' ||
    state === 'closed'
  ) {
    return state
  }
  return thread.status === 'closed' ? 'closed' : 'pending'
}

const getEffectiveSupportWorkflowState = (thread: SupportThread, requestStatusById: Map<string, string>) => {
  const raw = normalizeSupportWorkflowState(thread)
  const linkedRequestId = typeof thread.maintenance_request_id === 'string' ? thread.maintenance_request_id : ''
  const linkedRequestStatus = linkedRequestId ? requestStatusById.get(linkedRequestId) : ''
  if (linkedRequestStatus === 'completed') return 'completed'
  if (raw === 'paperwork' || raw === 'awaiting_invoice') return 'paperwork'
  if (linkedRequestStatus === 'in_progress') return 'in_progress'
  if (linkedRequestStatus === 'pending') return 'pending'
  return raw
}

export default function ManagementPage() {
  const router = useRouter()
  const locale = useLocale()
  const isLatinLocale = locale === 'en' || locale === 'tl'
  const t = useTranslations('management')
  const scrollRef = useRef<HTMLDivElement>(null)
  const leftSentinelRef = useRef<HTMLTableCellElement>(null)
  const rightSentinelRef = useRef<HTMLTableCellElement>(null)
  const isLoadingMore = useRef(false)
  const initialScrollDone = useRef(false)
  
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null)
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([])
  const [selectedSupportThreadId, setSelectedSupportThreadId] = useState<string | null>(null)
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([])
  const [isSupportLoading, setIsSupportLoading] = useState(false)
  const [supportError, setSupportError] = useState<string | null>(null)
  const [supportActionMessage, setSupportActionMessage] = useState<string | null>(null)
  const [dispatchForm, setDispatchForm] = useState<DispatchForm>(buildDispatchForm(null))
  const [isDispatching, setIsDispatching] = useState(false)
  const [mechanics, setMechanics] = useState<MechanicOption[]>([])
  const [mechanicsError, setMechanicsError] = useState<string | null>(null)
  const [partsWorkflows, setPartsWorkflows] = useState<PartsWorkflow[]>([])
  const [isPartsLoading, setIsPartsLoading] = useState(false)
  const [partsError, setPartsError] = useState<string | null>(null)
  const [partsActionMessage, setPartsActionMessage] = useState<string | null>(null)
  const [issuingPartsWorkflowId, setIssuingPartsWorkflowId] = useState<string | null>(null)
  const [docsFolderCount, setDocsFolderCount] = useState(0)
  
  // 無限スクロール用：開始日と日数を管理
  const [startDate, setStartDate] = useState(() => subDays(new Date(), 30))
  const [totalDays, setTotalDays] = useState(90) // 前後30日 + 今日 = 約90日

  // Generate days array
  const days = Array.from({ length: totalDays }, (_, i) => addDays(startDate, i))
  
  // 左端にスクロールしたら過去の日付を追加
  const loadMorePast = useCallback(() => {
    if (isLoadingMore.current) return
    isLoadingMore.current = true
    
    const daysToAdd = 30
    setStartDate(prev => subDays(prev, daysToAdd))
    setTotalDays(prev => prev + daysToAdd)
    
    // スクロール位置を維持するために少し遅延
    setTimeout(() => {
      if (scrollRef.current) {
        const cellWidth = 70 // min-w-[70px]
        scrollRef.current.scrollLeft += daysToAdd * cellWidth
      }
      isLoadingMore.current = false
    }, 50)
  }, [])
  
  // 右端にスクロールしたら未来の日付を追加
  const loadMoreFuture = useCallback(() => {
    if (isLoadingMore.current) return
    isLoadingMore.current = true
    
    const daysToAdd = 30
    setTotalDays(prev => prev + daysToAdd)
    
    setTimeout(() => {
      isLoadingMore.current = false
    }, 50)
  }, [])
  
  // IntersectionObserverで端を検知
  useEffect(() => {
    const options = {
      root: scrollRef.current,
      rootMargin: '0px 100px',
      threshold: 0
    }
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && initialScrollDone.current) {
          if (entry.target === leftSentinelRef.current) {
            loadMorePast()
          } else if (entry.target === rightSentinelRef.current) {
            loadMoreFuture()
          }
        }
      })
    }, options)
    
    if (leftSentinelRef.current) observer.observe(leftSentinelRef.current)
    if (rightSentinelRef.current) observer.observe(rightSentinelRef.current)
    
    return () => observer.disconnect()
  }, [loadMorePast, loadMoreFuture])
  
  // 初期スクロール位置を今日に設定
  useEffect(() => {
    if (scrollRef.current && !initialScrollDone.current) {
      const todayIndex = days.findIndex(day => isToday(day))
      if (todayIndex !== -1) {
        const cellWidth = 70
        const containerWidth = scrollRef.current.clientWidth
        const scrollPosition = (todayIndex * cellWidth) - (containerWidth / 2) + (cellWidth / 2)
        scrollRef.current.scrollLeft = Math.max(0, scrollPosition)
      }
      setTimeout(() => {
        initialScrollDone.current = true
      }, 100)
    }
  }, [days])

  // Get unique stores from requests
  const storesWithRequests = Array.from(
    new Set(requests.map(r => r.storeId))
  ).map(storeId => {
    const request = requests.find(r => r.storeId === storeId)
    return {
      id: storeId,
      name: request?.storeName || '',
      nameEn: request?.storeNameEn || ''
    }
  })

  const loadSupportThreads = useCallback(async () => {
    setIsSupportLoading(true)
    setSupportError(null)
    try {
      const res = await fetch('/api/support/threads?status=all', { cache: 'no-store' })
      const json = (await res.json()) as { threads?: SupportThread[]; error?: string }
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load support threads')
      }
      setSupportThreads(Array.isArray(json.threads) ? json.threads : [])
    } catch (error) {
      setSupportError(error instanceof Error ? error.message : 'Failed to load support threads')
    } finally {
      setIsSupportLoading(false)
    }
  }, [])

  const loadSupportMessages = useCallback(async (threadId: string) => {
    setIsSupportLoading(true)
    setSupportError(null)
    try {
      const res = await fetch(`/api/support/messages?threadId=${encodeURIComponent(threadId)}`, {
        cache: 'no-store',
      })
      const json = (await res.json()) as { messages?: SupportMessage[]; error?: string }
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load support messages')
      }
      setSupportMessages(Array.isArray(json.messages) ? json.messages : [])
      setSelectedSupportThreadId(threadId)
    } catch (error) {
      setSupportMessages([])
      setSupportError(error instanceof Error ? error.message : 'Failed to load support messages')
    } finally {
      setIsSupportLoading(false)
    }
  }, [])

  const loadPartsWorkflows = useCallback(async () => {
    setIsPartsLoading(true)
    setPartsError(null)
    try {
      const res = await fetch('/api/parts-order/workflows?status=all', { cache: 'no-store' })
      const json = (await res.json()) as { workflows?: PartsWorkflow[]; error?: string }
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load parts workflows')
      }
      setPartsWorkflows(Array.isArray(json.workflows) ? json.workflows : [])
    } catch (error) {
      setPartsError(error instanceof Error ? error.message : 'Failed to load parts workflows')
    } finally {
      setIsPartsLoading(false)
    }
  }, [])

  const loadDocsFolderCount = useCallback(async () => {
    try {
      const res = await fetch('/api/completed-documents?limit=500', { cache: 'no-store' })
      const json = (await res.json()) as { documents?: unknown[] }
      if (!res.ok || !Array.isArray(json.documents)) return
      setDocsFolderCount(json.documents.length)
    } catch {}
  }, [])

  const loadMechanics = useCallback(async () => {
    setMechanicsError(null)
    try {
      const res = await fetch('/api/mechanics?includeInactive=1&seedDefault=1', { cache: 'no-store' })
      const json = (await res.json()) as {
        mechanics?: MechanicOption[]
        error?: string
        warning?: string
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load mechanics')
      const rows = Array.isArray(json.mechanics)
        ? json.mechanics.filter((row) => row.is_active !== false)
        : []
      setMechanics(rows.length > 0 ? rows : DEFAULT_MECHANIC_OPTIONS)
      setMechanicsError(null)
    } catch {
      setMechanics(DEFAULT_MECHANIC_OPTIONS)
      setMechanicsError(null)
    }
  }, [])

  const closeSupportThread = useCallback(
    async (threadId: string) => {
      setIsSupportLoading(true)
      setSupportError(null)
      try {
        const res = await fetch('/api/support/threads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId, status: 'closed' }),
        })
        const json = (await res.json()) as { thread?: SupportThread; error?: string }
        if (!res.ok) {
          throw new Error(json.error || 'Failed to close support thread')
        }
        setSelectedSupportThreadId(null)
        setSupportMessages([])
        await loadSupportThreads()
      } catch (error) {
        setSupportError(error instanceof Error ? error.message : 'Failed to close support thread')
      } finally {
        setIsSupportLoading(false)
      }
    },
    [loadSupportThreads]
  )

  const selectedSupportThread = useMemo(
    () => supportThreads.find((thread) => thread.id === selectedSupportThreadId) ?? null,
    [selectedSupportThreadId, supportThreads]
  )
  const requestStatusById = useMemo(() => {
    const map = new Map<string, string>()
    for (const request of requests) {
      map.set(request.id, request.status)
    }
    return map
  }, [requests])
  const requestById = useMemo(() => {
    const map = new Map<string, MaintenanceRequest>()
    for (const request of requests) {
      map.set(request.id, request)
    }
    return map
  }, [requests])
  const recommendedMechanicId = useMemo(() => {
    if (mechanics.length === 0) return ''
    const load = new Map<string, number>()
    for (const mechanic of mechanics) load.set(mechanic.id, 0)
    for (const request of requests) {
      if (request.status !== 'pending' && request.status !== 'in_progress') continue
      if (!request.assignedMechanicId) continue
      if (!load.has(request.assignedMechanicId)) continue
      load.set(request.assignedMechanicId, (load.get(request.assignedMechanicId) ?? 0) + 1)
    }
    let bestId = mechanics[0]?.id || ''
    let bestScore = Number.POSITIVE_INFINITY
    for (const mechanic of mechanics) {
      const score = load.get(mechanic.id) ?? 0
      if (score < bestScore) {
        bestScore = score
        bestId = mechanic.id
      }
    }
    return bestId
  }, [mechanics, requests])
  const sortedSupportThreads = useMemo(() => {
    const getThreadRank = (thread: SupportThread) => {
      const state = getEffectiveSupportWorkflowState(thread, requestStatusById)
      return state === 'completed' || state === 'closed' ? 1 : 0
    }
    return [...supportThreads].sort((a, b) => {
      const rankDiff = getThreadRank(a) - getThreadRank(b)
      if (rankDiff !== 0) return rankDiff
      const ta = new Date(a.updated_at).getTime()
      const tb = new Date(b.updated_at).getTime()
      return tb - ta
    })
  }, [requestStatusById, supportThreads])
  const filteredSupportThreads = useMemo(() => {
    const matchesFilter = (thread: SupportThread) => {
      const workflowState = getEffectiveSupportWorkflowState(thread, requestStatusById)
      if (statusFilter === 'all') return true
      if (statusFilter === 'pending') {
        return workflowState === 'pending' || workflowState === 'ready_for_dispatch'
      }
      if (statusFilter === 'in_progress') {
        return workflowState === 'in_progress'
      }
      if (statusFilter === 'paperwork') {
        return workflowState === 'paperwork'
      }
      return workflowState === 'completed' || workflowState === 'closed'
    }
    return sortedSupportThreads.filter(matchesFilter)
  }, [requestStatusById, sortedSupportThreads, statusFilter])
  const requestListRows = useMemo(() => {
    const linkedRequestIds = new Set(
      supportThreads
        .map((thread) => (typeof thread.maintenance_request_id === 'string' ? thread.maintenance_request_id : ''))
        .filter(Boolean)
    )

    const threadRows: RequestListRow[] = sortedSupportThreads.map((thread) => {
      const workflowState = getEffectiveSupportWorkflowState(thread, requestStatusById)
      const linkedRequestId = typeof thread.maintenance_request_id === 'string' ? thread.maintenance_request_id : ''
      return {
        key: `thread:${thread.id}`,
        kind: 'thread',
        thread,
        workflowState,
        linkedRequestId,
        canGenerateInvoice:
          linkedRequestId.length > 0 && workflowState === 'paperwork',
        timestamp: thread.updated_at,
        storeName: thread.store_name,
        summary: isAttachmentLabelNoise(thread.summary || '') ? '' : thread.summary || '',
        urgency: thread.urgency,
      }
    })

    const orphanRequestRows: RequestListRow[] = requests
      .filter((request) => !linkedRequestIds.has(request.id))
      .map((request) => ({
        key: `request:${request.id}`,
        kind: 'request' as const,
        request,
        workflowState: request.status,
        linkedRequestId: request.id,
        canGenerateInvoice: request.status === 'in_progress',
        timestamp: request.createdAt.toISOString(),
        storeName: request.storeName,
        summary: request.symptom || request.faultLocation || '',
        urgency: request.urgency === 'urgent' ? 'urgent' : 'normal',
      }))

    const matchesFilter = (row: RequestListRow) => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'pending') {
        return row.workflowState === 'pending' || row.workflowState === 'ready_for_dispatch'
      }
      if (statusFilter === 'in_progress') {
        return row.workflowState === 'in_progress'
      }
      if (statusFilter === 'paperwork') {
        return row.workflowState === 'paperwork'
      }
      return row.workflowState === 'completed' || row.workflowState === 'closed'
    }

    const getRank = (state: string) => {
      if (state === 'pending' || state === 'ready_for_dispatch') return 0
      if (state === 'in_progress') return 1
      if (state === 'paperwork' || state === 'awaiting_invoice') return 2
      if (state === 'completed' || state === 'closed') return 3
      return 4
    }

    return [...threadRows, ...orphanRequestRows]
      .filter(matchesFilter)
      .sort((a, b) => {
        if (statusFilter === 'all') {
          const rankDiff = getRank(a.workflowState) - getRank(b.workflowState)
          if (rankDiff !== 0) return rankDiff
        }
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })
  }, [requestStatusById, requests, sortedSupportThreads, statusFilter, supportThreads])
  const selectedSupportWorkflowState = useMemo(
    () =>
      selectedSupportThread ? getEffectiveSupportWorkflowState(selectedSupportThread, requestStatusById) : 'pending',
    [requestStatusById, selectedSupportThread]
  )

  useEffect(() => {
    setDispatchForm(buildDispatchForm(selectedSupportThread))
    setSupportActionMessage(null)
  }, [selectedSupportThread])

  useEffect(() => {
    if (!selectedSupportThread) return
    setDispatchForm((prev) => ({
      ...prev,
      mechanicId: prev.mechanicId || recommendedMechanicId || '',
    }))
  }, [recommendedMechanicId, selectedSupportThread])

  useEffect(() => {
    if (!selectedSupportThread) return
    const latestUserText =
      [...supportMessages]
        .reverse()
        .find(
          (message) =>
            message.role === 'user' &&
            message.content.trim().length > 0 &&
            !isAttachmentLabelNoise(message.content.trim())
        )
        ?.content
        .trim() ?? ''
    if (!latestUserText) return
    setDispatchForm((prev) => {
      const needsFaultLocation = prev.faultLocation.trim().length === 0
      const needsSymptom = prev.symptom.trim().length === 0
      if (!needsFaultLocation && !needsSymptom) return prev
      return {
        ...prev,
        faultLocation: needsFaultLocation ? latestUserText : prev.faultLocation,
        symptom: needsSymptom ? latestUserText : prev.symptom,
      }
    })
  }, [selectedSupportThread, supportMessages])

  const dispatchMissingFields = useMemo(() => {
    const missing: string[] = []
    if (!dispatchForm.mechanicId.trim()) missing.push('mechanicId')
    if (!dispatchForm.machineName.trim()) missing.push('machineName')
    if (!dispatchForm.machineSerial.trim()) missing.push('machineSerial')
    if (!dispatchForm.faultLocation.trim()) missing.push('faultLocation')
    if (!dispatchForm.symptom.trim()) missing.push('symptom')
    if (!dispatchForm.preferredDate.trim()) missing.push('preferredDate')
    if (!dispatchForm.visitDate.trim()) missing.push('visitDate')
    return missing
  }, [dispatchForm])

  const openInvoiceEditor = useCallback(
    (requestId: string) => {
      if (!requestId) return
      router.push(`/management/invoice?requestId=${encodeURIComponent(requestId)}`)
    },
    [router]
  )

  const handleOpenDocsFolder = useCallback(() => {
    router.push('/management/docs')
  }, [router])

  const handleDispatchToMechanic = useCallback(async () => {
    if (!selectedSupportThread) return
    setSupportActionMessage(null)
    setIsDispatching(true)
    try {
      const res = await fetch('/api/support/threads/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: selectedSupportThread.id,
          ...dispatchForm,
        }),
      })
      const json = (await res.json()) as {
        error?: string
        missingFields?: string[]
        request?: { id: string }
      }
      if (!res.ok) {
        const detail =
          Array.isArray(json.missingFields) && json.missingFields.length > 0
            ? ` (${json.missingFields.join(', ')})`
            : ''
        throw new Error((json.error || 'Failed to dispatch to mechanic') + detail)
      }
      setSupportActionMessage(
        `Sent to mechanic successfully. Request ID: ${json.request?.id ?? 'created'}`
      )
      const latestRequests = await fetchMaintenanceRequests({ limit: 300 })
      const mapped = latestRequests.map(mapRequestFromApi)
      setRequests(mapped)
      setStatusFilter('in_progress')
      if (json.request?.id) {
        const created = mapped.find((item) => item.id === json.request?.id) ?? null
        if (created) setSelectedRequest(created)
      }
      await Promise.all([loadSupportThreads(), loadPartsWorkflows()])
      await loadSupportMessages(selectedSupportThread.id)
    } catch (error) {
      setSupportActionMessage(error instanceof Error ? error.message : 'Failed to dispatch to mechanic')
    } finally {
      setIsDispatching(false)
    }
  }, [dispatchForm, loadPartsWorkflows, loadSupportMessages, loadSupportThreads, selectedSupportThread])

  const handleGeneratePartsInvoice = useCallback(
    async (workflowId: string) => {
      setPartsActionMessage(null)
      setIssuingPartsWorkflowId(workflowId)
      try {
        const res = await fetch(`/api/parts-order/workflows/${encodeURIComponent(workflowId)}/invoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issuedBy: 'management_portal' }),
        })
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(json.error || 'Failed to generate parts invoice')
        }
        const blob = await res.blob()
        const disposition = res.headers.get('Content-Disposition')
        const matched = disposition?.match(/filename="([^"]+)"/)
        const filename = matched?.[1] || 'parts-invoice.pdf'
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = filename
        anchor.rel = 'noopener'
        anchor.click()
        URL.revokeObjectURL(url)
        setPartsActionMessage(`Invoice generated for workflow ${workflowId}.`)
        await Promise.all([loadPartsWorkflows(), loadDocsFolderCount()])
      } catch (error) {
        setPartsActionMessage(error instanceof Error ? error.message : 'Failed to generate parts invoice')
      } finally {
        setIssuingPartsWorkflowId(null)
      }
    },
    [loadDocsFolderCount, loadPartsWorkflows]
  )

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const rows = await fetchMaintenanceRequests({ limit: 300 })
      setRequests(rows.map(mapRequestFromApi))
      await Promise.all([loadSupportThreads(), loadPartsWorkflows(), loadMechanics(), loadDocsFolderCount()])
    } catch (error) {
      console.error('Failed to refresh maintenance requests:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const rows = await fetchMaintenanceRequests({ limit: 300 })
        setRequests(rows.map(mapRequestFromApi))
        await Promise.all([loadSupportThreads(), loadPartsWorkflows(), loadMechanics(), loadDocsFolderCount()])
      } catch (error) {
        console.error('Failed to load maintenance requests:', error)
      }
    }
    void load()
  }, [loadDocsFolderCount, loadMechanics, loadPartsWorkflows, loadSupportThreads])

  const handleToday = () => {
    if (scrollRef.current) {
      const todayIndex = days.findIndex(day => isToday(day))
      if (todayIndex !== -1) {
        const cellWidth = 70
        const containerWidth = scrollRef.current.clientWidth
        const scrollPosition = (todayIndex * cellWidth) - (containerWidth / 2) + (cellWidth / 2)
        scrollRef.current.scrollTo({ left: Math.max(0, scrollPosition), behavior: 'smooth' })
      }
    }
  }

  const filteredRequests = requests.filter(req => {
    return statusFilter === 'all' || req.status === statusFilter
  })

  const getRequestsForStoreAndDate = (storeId: string, date: Date) => {
    const getStatusSortRank = (status: string) => {
      if (status === 'pending') return 0
      if (status === 'in_progress') return 1
      if (status === 'completed') return 2
      return 3
    }
    return filteredRequests
      .filter(
        (req) =>
          req.storeId === storeId &&
          req.scheduledDate &&
          isSameDay(req.scheduledDate, date)
      )
      .sort((a, b) => {
        const rankDiff = getStatusSortRank(a.status) - getStatusSortRank(b.status)
        if (rankDiff !== 0) return rankDiff
        return a.createdAt.getTime() - b.createdAt.getTime()
      })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-orange-500'
      case 'in_progress':
        return 'bg-yellow-500'
      case 'completed':
        return 'bg-green-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getUrgencyBorder = (status: string, urgency: string) => {
    if (status === 'completed') return ''
    switch (urgency) {
      case 'urgent':
        return 'border-l-4 border-l-red-500'
      case 'normal':
        return 'border-l-4 border-l-blue-400'
      case 'estimate':
        return 'border-l-4 border-l-purple-400'
      default:
        return ''
    }
  }

  const maintenanceCounts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    in_progress: requests.filter((r) => r.status === 'in_progress').length,
    completed: requests.filter((r) => r.status === 'completed').length,
  }

  const supportCounts = supportThreads.reduce(
    (acc, thread) => {
      const workflowState = getEffectiveSupportWorkflowState(thread, requestStatusById)
      acc.all += 1
      if (workflowState === 'pending' || workflowState === 'ready_for_dispatch') {
        acc.pending += 1
      } else if (workflowState === 'in_progress') {
        acc.in_progress += 1
      } else if (workflowState === 'paperwork') {
        acc.paperwork += 1
      } else if (workflowState === 'completed' || workflowState === 'closed') {
        acc.completed += 1
      }
      return acc
    },
    { all: 0, pending: 0, in_progress: 0, paperwork: 0, completed: 0 }
  )

  const partsCounts = partsWorkflows.reduce(
    (acc, workflow) => {
      acc.all += 1
      if (workflow.status === 'pending') {
        acc.pending += 1
      } else if (workflow.status === 'processing') {
        acc.paperwork += 1
      } else if (workflow.status === 'completed') {
        acc.completed += 1
      }
      return acc
    },
    { all: 0, pending: 0, paperwork: 0, completed: 0 }
  )

  const paperworkMonthlyCount = useMemo(() => {
    const now = new Date()

    const supportPaperwork = supportThreads.reduce((count, thread) => {
      const workflowState = getEffectiveSupportWorkflowState(thread, requestStatusById)
      if (workflowState !== 'paperwork') return count

      const linkedRequestId = typeof thread.maintenance_request_id === 'string' ? thread.maintenance_request_id : ''
      const linkedRequest = linkedRequestId ? requestById.get(linkedRequestId) : undefined
      const dueDate =
        linkedRequest?.scheduledDate ??
        linkedRequest?.createdAt ??
        toValidDate(thread.updated_at) ??
        toValidDate(thread.created_at)
      if (!dueDate) return count
      return isSameYearMonth(dueDate, now) ? count + 1 : count
    }, 0)

    const partsPaperwork = partsWorkflows.reduce((count, workflow) => {
      if (workflow.status !== 'processing') return count
      const dueDate = toValidDate(workflow.updated_at) ?? toValidDate(workflow.created_at)
      if (!dueDate) return count
      return isSameYearMonth(dueDate, now) ? count + 1 : count
    }, 0)

    return supportPaperwork + partsPaperwork
  }, [partsWorkflows, requestById, requestStatusById, supportThreads])

  const statusCounts = {
    all: maintenanceCounts.all + supportCounts.all + partsCounts.all,
    pending: maintenanceCounts.pending + supportCounts.pending + partsCounts.pending,
    in_progress: maintenanceCounts.in_progress + supportCounts.in_progress,
    paperwork: paperworkMonthlyCount,
    completed: maintenanceCounts.completed + supportCounts.completed + partsCounts.completed,
  }

  /** カレンダー下リスト：上部タブと同じ statusFilter（デフォルト＝全部） */
  const listFilterLabel =
    statusFilter === 'all'
      ? t('all')
      : statusFilter === 'pending'
        ? t('pending')
        : statusFilter === 'in_progress'
          ? t('inProgress')
          : statusFilter === 'paperwork'
            ? 'Paperwork'
            : t('completed')

  // 翻訳から曜日を取得
  const weekdays = t.raw('weekdays') as string[]
  
  const getDayOfWeek = (date: Date) => {
    return weekdays[date.getDay()]
  }
  
  const getMonthLabel = (date: Date) => {
    const monthNum = date.getMonth() + 1
    return t('month', { month: monthNum })
  }

  /** ガントに読み込んでいる日付列の範囲（先頭日〜最終日の年月） */
  const monthRangeText = useMemo(() => {
    if (totalDays <= 0) return ''
    const first = startDate
    const last = addDays(startDate, totalDays - 1)
    const sameYearMonth =
      first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()
    const fmt = (d: Date) =>
      t('monthYear', { year: d.getFullYear(), month: d.getMonth() + 1 })
    return sameYearMonth ? fmt(first) : `${fmt(first)} — ${fmt(last)}`
  }, [startDate, totalDays, t])

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingLeft: '6px', paddingRight: '6px' }}>
      <Header showBack title={t('title')} titleClassName="ml-1.5" />
      
      <main className="px-4 py-4 pb-8">
        {/* Summary Cards */}
        <div
          className="grid gap-2 mb-4"
          style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}
        >
          <button
            onClick={() => setStatusFilter('all')}
            className={`p-3 rounded-xl text-center transition-all ${
              statusFilter === 'all' 
                ? 'bg-gray-800 text-white shadow-lg' 
                : 'bg-white text-gray-700 shadow-sm hover:shadow-md'
            }`}
          >
            <p className="text-xl font-bold">{statusCounts.all}</p>
            <p className="text-xs">{t('all')}</p>
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`p-3 rounded-xl text-center transition-all ${
              statusFilter === 'pending' 
                ? 'bg-orange-500 text-white shadow-lg' 
                : 'bg-white text-gray-700 shadow-sm hover:shadow-md'
            }`}
          >
            <p className="text-xl font-bold">{statusCounts.pending}</p>
            <p className="text-xs">{t('pending')}</p>
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`p-3 rounded-xl text-center transition-all ${
              statusFilter === 'in_progress' 
                ? 'bg-yellow-500 text-gray-900 shadow-lg' 
                : 'bg-white text-gray-700 shadow-sm hover:shadow-md'
            }`}
          >
            <p className="text-xl font-bold">{statusCounts.in_progress}</p>
            <p className="text-xs">{t('inProgress')}</p>
          </button>
          <button
            onClick={() => setStatusFilter('paperwork')}
            className={`p-3 rounded-xl text-center transition-all ${
              statusFilter === 'paperwork'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white text-gray-700 shadow-sm hover:shadow-md'
            }`}
          >
            <p className="text-xl font-bold">{statusCounts.paperwork}</p>
            <p className="text-xs">Paperwork</p>
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`p-3 rounded-xl text-center transition-all ${
              statusFilter === 'completed' 
                ? 'bg-green-500 text-white shadow-lg' 
                : 'bg-white text-gray-700 shadow-sm hover:shadow-md'
            }`}
          >
            <p className="text-xl font-bold">{statusCounts.completed}</p>
            <p className="text-xs">{t('completed')}</p>
          </button>
          <button
            onClick={handleOpenDocsFolder}
            className="p-3 rounded-xl text-center transition-all bg-white text-gray-700 shadow-sm hover:shadow-md"
          >
            <p className="text-xl font-bold">{docsFolderCount}</p>
            <p className="text-xs">Docs Folder</p>
          </button>
        </div>
        {/* Calendar Navigation */}
        <div className="flex items-center justify-between mb-4 bg-white rounded-xl p-3 shadow-sm">
          <div />
          <div />
        </div>

        {/* Legend */}
        <div className="bg-white rounded-xl px-3 shadow-sm" style={{ marginTop: '0', paddingTop: '6px', paddingBottom: '6px', marginBottom: '10px' }}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              onClick={handleToday}
              className="px-4 py-2 text-sm bg-zinc-900 text-white rounded-full hover:bg-zinc-800 transition-colors font-medium"
              style={{ minWidth: '150px', minHeight: '46px', fontSize: '15px', paddingLeft: '18px', paddingRight: '18px' }}
            >
              {t('goToToday')}
            </button>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600" style={{ marginLeft: '6px' }}>{t('status')}:</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span className="text-gray-500">{t('pending')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span className="text-gray-500">{t('inProgress')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-600 rounded"></div>
                <span className="text-gray-500">Paperwork</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-gray-500">{t('completed')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600" style={{ marginLeft: '6px' }}>{t('urgency')}:</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border-l-4 border-l-red-500 bg-gray-200 rounded-r"></div>
                <span className="text-gray-500">{t('urgentLabel')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border-l-4 border-l-blue-400 bg-gray-200 rounded-r"></div>
                <span className="text-gray-500">{t('normalLabel')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border-l-4 border-l-purple-400 bg-gray-200 rounded-r"></div>
                <span className="text-gray-500">{t('estimateLabel')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm text-gray-500" style={{ marginLeft: '6px' }}>
            {t('scrollHint')}
          </p>
        </div>

        {/* Gantt Chart Calendar */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto" ref={scrollRef}>
            <table className="w-full min-w-[900px]">
              {/* Header Row - Dates */}
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 z-10 bg-gray-50 w-32 min-w-[128px] px-3 py-2 text-left text-sm font-semibold text-gray-700 border-r border-gray-200">
                    <span style={{ marginLeft: '6px' }}>{t('storeName')}</span>
                  </th>
                  {/* 左端センチネル */}
                  <th ref={leftSentinelRef} className="w-1 min-w-[1px] p-0 bg-gray-50"></th>
                  {days.map((day) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6
                    const isTodayDate = isToday(day)
                    const isFirstOfMonth = day.getDate() === 1
                    return (
                      <th 
                        key={day.toISOString()} 
                        className={`px-1 py-2 text-center min-w-[70px] border-r border-gray-100 ${
                          isTodayDate 
                            ? 'bg-zinc-900 text-white' 
                            : isWeekend 
                            ? 'bg-gray-100' 
                            : 'bg-gray-50'
                        } ${isFirstOfMonth ? 'border-l-2 border-l-gray-400' : ''}`}
                      >
                        {isFirstOfMonth && (
                          <div className={`text-[10px] font-bold ${isTodayDate ? 'text-white' : 'text-gray-600'}`}>
                            {getMonthLabel(day)}
                          </div>
                        )}
                        <div className={`text-xs ${isTodayDate ? 'text-white' : isWeekend ? 'text-gray-500' : 'text-gray-500'}`}>
                          {getDayOfWeek(day)}
                        </div>
                        <div className={`text-sm font-semibold ${isTodayDate ? 'text-white' : 'text-gray-800'}`}>
                          {format(day, 'd')}
                        </div>
                      </th>
                    )
                  })}
                  {/* 右端センチネル */}
                  <th ref={rightSentinelRef} className="w-1 min-w-[1px] p-0 bg-gray-50"></th>
                </tr>
              </thead>
              
              {/* Body - Stores and their maintenance items */}
              <tbody>
                {storesWithRequests.map((store) => (
                  <tr key={store.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white px-3 py-3 border-r border-gray-200">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          {isLatinLocale ? (
                            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                              <span className="font-medium text-gray-800 text-sm leading-tight">
                                {store.nameEn}
                              </span>
                              <span className="text-[11px] text-gray-500 leading-tight">{store.name}</span>
                            </div>
                          ) : (
                            <>
                              <p className="font-medium text-gray-800 text-sm truncate">{store.name}</p>
                              <p className="text-xs text-gray-400 truncate">{store.nameEn}</p>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* 左端センチネル対応の空セル */}
                    <td className="w-1 min-w-[1px] p-0"></td>
                    {days.map((day) => {
                      const dayRequests = getRequestsForStoreAndDate(store.id, day)
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6
                      const isTodayDate = isToday(day)
                      const isFirstOfMonth = day.getDate() === 1
                      
                      return (
                        <td 
                          key={day.toISOString()} 
                          className={`px-1 py-2 border-r border-gray-100 align-top ${
                            isTodayDate 
                              ? 'bg-zinc-100' 
                              : isWeekend 
                              ? 'bg-gray-50' 
                              : ''
                          } ${isFirstOfMonth ? 'border-l-2 border-l-gray-400' : ''}`}
                        >
                          <div className="space-y-1">
                            {dayRequests.map((req) => (
                              <button
                                key={req.id}
                                onClick={() => setSelectedRequest(req)}
                                className={`w-full text-left px-2 py-1 rounded text-xs ${getStatusColor(req.status)} text-white ${getUrgencyBorder(req.status, req.urgency)} hover:opacity-80 transition-opacity truncate`}
                              >
                                {req.machineModel ?? req.itemLabel}
                                {req.machineSerial ? ` (${req.machineSerial})` : ''}
                              </button>
                            ))}
                          </div>
                        </td>
                      )
                    })}
                    {/* 右端センチネル対応の空セル */}
                    <td className="w-1 min-w-[1px] p-0"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Parts Order Queue */}
        <div className="mt-4 bg-white rounded-xl shadow-sm overflow-hidden" style={{ marginBottom: '16px' }}>
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-800" style={{ marginLeft: '6px' }}>
              {t('partsOrderQueue')}
            </h2>
            <div />
          </div>
          {partsError ? (
            <div className="px-4 py-4 text-sm text-red-600">Failed to load parts queue: {partsError}</div>
          ) : partsWorkflows.length === 0 ? (
            <div
              className="px-4 text-sm text-gray-500"
              style={{ minHeight: '42px', display: 'flex', alignItems: 'center', paddingTop: '10px', paddingBottom: '10px' }}
            >
              {t('noPartsWorkflows')}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {partsWorkflows.map((workflow) => (
                <li key={workflow.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {workflow.order_no} / {workflow.store_name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {workflow.store_id} · {new Date(workflow.created_at).toLocaleString()}
                      </p>
                      <p className="mt-1">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${getWorkflowBadgeClass(workflow.status)}`}>
                          {workflow.status === 'processing' ? t('processing') : workflow.status}
                        </span>
                      </p>
                    </div>
                    {workflow.status === 'processing' ? (
                      <button
                        type="button"
                        onClick={() => void handleGeneratePartsInvoice(workflow.id)}
                        disabled={issuingPartsWorkflowId === workflow.id}
                        className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {issuingPartsWorkflowId === workflow.id ? 'Generating...' : t('generateInvoice')}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {partsActionMessage ? (
            <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-700">{partsActionMessage}</p>
          ) : null}
        </div>

        {/* Requests (single list) */}
        <div className="mt-4 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2" style={{ marginLeft: '6px' }}>
              <MessageCircle className="w-4 h-4" />
              {`Requests（${listFilterLabel}）`}
            </h2>
            <div />
          </div>
          {selectedSupportThreadId && (
            <div className="border-b border-gray-100 p-4 bg-gray-50/40">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-800">{t('conversation')}</h3>
                <button
                  type="button"
                  onClick={() => void closeSupportThread(selectedSupportThreadId)}
                  disabled={isSupportLoading}
                  className="px-4 py-3 text-sm rounded-md bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
                  style={{ minWidth: '145px', minHeight: '48px', fontSize: '15px', paddingLeft: '16px', paddingRight: '16px' }}
                >
                  {t('closeThread')}
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 bg-white rounded-lg p-3 border border-gray-200">
                {supportMessages.length === 0 ? (
                  <p className="text-xs text-gray-500">No messages.</p>
                ) : (
                  supportMessages.map((message) => {
                    const attachments = getSupportAttachments(message.meta)
                    const textContent = message.content.trim()
                    const showMessageText = !isAttachmentLabelNoise(textContent)
                    const isAttachmentOnly = attachments.length > 0 && !showMessageText
                    const isUser = message.role === 'user'
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={
                            isAttachmentOnly
                              ? 'inline-block rounded-xl border border-gray-200 bg-white p-1'
                              : `inline-block max-w-[88%] rounded-xl text-sm whitespace-pre-wrap ${
                                  isUser
                                    ? 'bg-zinc-900 text-white'
                                    : 'bg-white border border-gray-200 text-gray-800'
                                }`
                          }
                          style={
                            isAttachmentOnly
                              ? undefined
                              : {
                                  minWidth: '280px',
                                  paddingLeft: '24px',
                                  paddingRight: '24px',
                                  paddingTop: '12px',
                                  paddingBottom: '12px',
                                }
                          }
                        >
                          {showMessageText ? <p style={{ lineHeight: 1.4 }}>{message.content}</p> : null}
                          {attachments.length > 0 && (
                            <div className={`${showMessageText ? 'mt-2' : 'mt-0.5'}`}>
                              {attachments.length === 1 ? (
                                <a
                                  href={attachments[0]!.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-block rounded-md overflow-hidden border border-gray-200 bg-white"
                                >
                                  {attachments[0]!.source === 'video' ? (
                                    <div className="flex h-[120px] w-[220px] items-center justify-center text-[10px] text-gray-600 bg-gray-100">
                                      VIDEO
                                    </div>
                                  ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={attachments[0]!.url}
                                      alt="support attachment"
                                      className="block object-contain bg-white"
                                      style={{ width: '220px', height: '120px' }}
                                    />
                                  )}
                                </a>
                              ) : (
                                <div className="grid grid-cols-2 gap-2">
                                  {attachments.map((att, index) => (
                                    <a
                                      key={`${message.id}_${index}`}
                                      href={att.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block rounded-md overflow-hidden border border-gray-200 bg-white"
                                    >
                                      {att.source === 'video' ? (
                                        <div className="h-24 w-full flex items-center justify-center text-[10px] text-gray-600 bg-gray-100">
                                          VIDEO
                                        </div>
                                      ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={att.url}
                                          alt="support attachment"
                                          className="block object-contain bg-white"
                                          style={{ width: '160px', height: '96px' }}
                                        />
                                      )}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {selectedSupportThread ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    <p>
                      {t('workflow')}: <span className="font-semibold">{selectedSupportWorkflowState}</span>
                    </p>
                    <p className="mt-1">
                      {t('linkedRequest')}: <span className="font-semibold">{selectedSupportThread.maintenance_request_id || '-'}</span>
                    </p>
                    <p className="mt-1">
                      Linked store:{' '}
                      <span className="font-semibold">
                        {selectedSupportThread.store_name} ({selectedSupportThread.store_id})
                      </span>
                    </p>
                  </div>

                  {selectedSupportWorkflowState === 'pending' &&
                    !selectedSupportThread.maintenance_request_id && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-sm font-semibold text-gray-900">{t('sendToMechanic')}</p>
                      <div className="mt-2">
                        <label className="mb-1 block text-xs text-gray-600">Linked store</label>
                        <input
                          value={`${selectedSupportThread.store_name} (${selectedSupportThread.store_id})`}
                          readOnly
                          className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-800"
                          style={{ minHeight: '42px' }}
                        />
                      </div>
                      <div className="mt-2 space-y-2">
                        <select
                          value={dispatchForm.mechanicId}
                          onChange={(event) =>
                            setDispatchForm((prev) => ({ ...prev, mechanicId: event.target.value }))
                          }
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800"
                          style={{ minHeight: '42px' }}
                        >
                          <option value="">Select mechanic *</option>
                          {mechanics.map((mechanic) => (
                            <option key={mechanic.id} value={mechanic.id}>
                              {mechanic.name} ({mechanic.email})
                            </option>
                          ))}
                        </select>
                        {mechanicsError ? (
                          <p className="text-xs text-red-600">Failed to load mechanics: {mechanicsError}</p>
                        ) : null}
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          value={dispatchForm.machineName}
                          onChange={(event) =>
                            setDispatchForm((prev) => ({ ...prev, machineName: event.target.value }))
                          }
                          placeholder="Machine name *"
                          className="rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800"
                          style={{ minHeight: '42px' }}
                        />
                        <input
                          value={dispatchForm.machineModel}
                          onChange={(event) =>
                            setDispatchForm((prev) => ({ ...prev, machineModel: event.target.value }))
                          }
                          placeholder="Machine model"
                          className="rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800"
                          style={{ minHeight: '42px' }}
                        />
                        <input
                          value={dispatchForm.machineSerial}
                          onChange={(event) =>
                            setDispatchForm((prev) => ({ ...prev, machineSerial: event.target.value }))
                          }
                          placeholder="Machine serial *"
                          className="rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800"
                          style={{ minHeight: '42px' }}
                        />
                        <input
                          value={dispatchForm.faultLocation}
                          onChange={(event) =>
                            setDispatchForm((prev) => ({ ...prev, faultLocation: event.target.value }))
                          }
                          placeholder="Fault location *"
                          className="rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800"
                          style={{ minHeight: '42px' }}
                        />
                        <input
                          type="date"
                          value={dispatchForm.preferredDate}
                          onChange={(event) =>
                            setDispatchForm((prev) => ({ ...prev, preferredDate: event.target.value }))
                          }
                          className="rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800"
                          style={{ minHeight: '42px' }}
                        />
                        <input
                          type="date"
                          value={dispatchForm.visitDate}
                          onChange={(event) =>
                            setDispatchForm((prev) => ({ ...prev, visitDate: event.target.value }))
                          }
                          className="rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800"
                          style={{ minHeight: '42px' }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-600">
                        Left date: customer requested date. Right date: mechanic visit date.
                      </p>
                      <textarea
                        value={dispatchForm.symptom}
                        onChange={(event) =>
                          setDispatchForm((prev) => ({ ...prev, symptom: event.target.value }))
                        }
                        placeholder="Symptom *"
                        className="mt-2 h-40 w-full rounded-md border border-gray-300 bg-white px-3 py-4 text-sm text-gray-800"
                      />
                      <p className="mt-2 text-xs text-gray-600">
                        {dispatchMissingFields.length > 0
                          ? 'Please fill in blank required fields.'
                          : 'Ready to send to mechanic.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleDispatchToMechanic()}
                        disabled={isDispatching || dispatchMissingFields.length > 0}
                        className="mt-2 rounded-md bg-zinc-900 px-4 py-4 text-sm font-semibold text-white disabled:opacity-50"
                        style={{ width: '100%', minHeight: '56px', fontSize: '16px' }}
                      >
                        {isDispatching ? 'Sending...' : t('sendToMechanic')}
                      </button>
                    </div>
                  )}

                  {selectedSupportWorkflowState === 'paperwork' ? (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                      <p className="text-sm font-semibold text-purple-900">Step 2: Complete by Invoice</p>
                      <button
                        type="button"
                        onClick={() => openInvoiceEditor(selectedSupportThread.maintenance_request_id || '')}
                        disabled={!selectedSupportThread.maintenance_request_id}
                        className="mt-2 rounded-md px-4 py-4 text-sm font-semibold disabled:opacity-50"
                        style={{
                          width: '100%',
                          minHeight: '52px',
                          backgroundColor: '#6d28d9',
                          color: '#ffffff',
                          border: '2px solid #312e81',
                        }}
                      >
                        Open Invoice Editor
                      </button>
                      <p className="mt-2 text-xs text-purple-800">
                        {!selectedSupportThread.maintenance_request_id
                          ? 'No linked request yet.'
                          : 'Open the invoice page and finalize there.'}
                      </p>
                    </div>
                  ) : null}

                  {supportActionMessage ? (
                    <p className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                      {supportActionMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {supportError ? (
            <div className="px-4 py-4 text-sm text-red-600">
              Failed to load support logs: {supportError}
            </div>
          ) : requestListRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">No requests for this filter.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {requestListRows.map((row) => {
                const workflowState = row.workflowState
                const linkedRequestId = row.linkedRequestId
                const canGenerateInvoice = row.canGenerateInvoice
                return (
                  <li key={row.key}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (row.kind === 'thread') {
                          void loadSupportMessages(row.thread.id)
                          return
                        }
                        setSelectedRequest(row.request)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          if (row.kind === 'thread') {
                            void loadSupportMessages(row.thread.id)
                            return
                          }
                          setSelectedRequest(row.request)
                        }
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                        row.kind === 'thread' && selectedSupportThreadId === row.thread.id ? 'bg-gray-50' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800">{row.storeName}</p>
                        <span
                          className={`text-sm px-3 py-1 rounded-full ${
                            row.urgency === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                          }`}
                          style={{ minWidth: '80px', textAlign: 'center' }}
                        >
                          {row.urgency === 'urgent' ? 'Urgent' : 'Normal'}
                        </span>
                      </div>
                      <div className="mt-1">
                        <span
                          className={`text-sm px-3 py-1 rounded-full ${getWorkflowBadgeClass(workflowState)}`}
                          style={{ minWidth: '160px', display: 'inline-flex', justifyContent: 'center' }}
                        >
                          workflow: {workflowState}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{new Date(row.timestamp).toLocaleString()}</p>
                      {row.summary ? <p className="text-xs text-gray-600 mt-1 line-clamp-2">{row.summary}</p> : null}
                      {canGenerateInvoice ? (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              openInvoiceEditor(linkedRequestId)
                            }}
                            disabled={!linkedRequestId}
                            className="rounded-md bg-purple-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            style={{ minWidth: '200px', minHeight: '44px', paddingLeft: '18px', paddingRight: '18px' }}
                          >
                            Open Invoice Editor
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

        </div>

      </main>

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedRequest(null)}
          />
          <div className="relative bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className={`p-4 ${getStatusColor(selectedRequest.status)}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  {isLatinLocale ? (
                    <>
                      <h3 className="text-lg font-bold text-white leading-snug" style={{ marginLeft: '6px' }}>
                        {selectedRequest.storeNameEn}
                      </h3>
                      <p className="text-white/80 text-sm mt-0.5" style={{ marginLeft: '6px' }}>{selectedRequest.storeName}</p>
                    </>
                  ) : (
                    <>
                      <h3 className="text-lg font-bold text-white leading-snug" style={{ marginLeft: '6px' }}>
                        {selectedRequest.storeName}
                      </h3>
                      <p className="text-white/80 text-sm mt-0.5" style={{ marginLeft: '6px' }}>{selectedRequest.storeNameEn}</p>
                    </>
                  )}
                </div>
                <button 
                  onClick={() => setSelectedRequest(null)}
                  className="p-1 rounded-full hover:bg-white/20 transition-colors shrink-0"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2" style={{ marginLeft: '6px' }}>
                {selectedRequest.status === 'pending' && <AlertCircle className="w-5 h-5 text-orange-500" />}
                {selectedRequest.status === 'in_progress' && <Wrench className="w-5 h-5 text-yellow-500" />}
                {selectedRequest.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedRequest.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                  selectedRequest.status === 'in_progress' ? 'bg-yellow-100 text-yellow-900' :
                  'bg-green-100 text-green-800'
                }`}>
                  {t(selectedRequest.status)}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedRequest.urgency === 'urgent' ? 'bg-red-100 text-red-800' :
                  selectedRequest.urgency === 'normal' ? 'bg-blue-100 text-blue-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {selectedRequest.urgency === 'urgent' ? `🔴 ${t('urgentLabel')}` : 
                   selectedRequest.urgency === 'normal' ? `🔵 ${t('normalLabel')}` : `🟣 ${t('estimateLabel')}`}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Wrench className="w-5 h-5 text-gray-400 mt-0.5" style={{ marginLeft: '6px' }} />
                  <div style={{ marginLeft: '6px' }}>
                    <p className="text-sm text-gray-500">{t('maintenanceItem')}</p>
                    <p className="font-medium text-gray-800">
                      {selectedRequest.machineName ?? selectedRequest.machineModel ?? selectedRequest.itemLabel}
                      {selectedRequest.machineSerial ? ` / ${selectedRequest.machineSerial}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedRequest.faultLocation ?? selectedRequest.areaLabel}
                    </p>
                  </div>
                </div>

                {selectedRequest.symptom ? (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-gray-400 mt-0.5" style={{ marginLeft: '6px' }} />
                    <div style={{ marginLeft: '6px' }}>
                      <p className="text-sm text-gray-500">症状</p>
                      <p className="font-medium text-gray-800">{selectedRequest.symptom}</p>
                    </div>
                  </div>
                ) : null}

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" style={{ marginLeft: '6px' }} />
                  <div style={{ marginLeft: '6px' }}>
                    <p className="text-sm text-gray-500">{t('scheduledDate')}</p>
                    <p className="font-medium text-gray-800">
                      {selectedRequest.scheduledDate ? format(selectedRequest.scheduledDate, 'yyyy/MM/dd') : '-'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" style={{ marginLeft: '6px' }} />
                  <div style={{ marginLeft: '6px' }}>
                    <p className="text-sm text-gray-500">{t('requestedAt')}</p>
                    <p className="font-medium text-gray-800">
                      {format(selectedRequest.createdAt, 'yyyy/MM/dd HH:mm')}
                    </p>
                  </div>
                </div>

                {selectedRequest.completedAt && (
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" style={{ marginLeft: '6px' }} />
                    <div style={{ marginLeft: '6px' }}>
                      <p className="text-sm text-green-600">{t('completedAt')}</p>
                      <p className="font-medium text-green-800">
                        {format(selectedRequest.completedAt, 'yyyy/MM/dd HH:mm')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Vendor */}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-500" style={{ marginLeft: '6px' }}>{t('vendor')}</p>
                <p className="font-medium text-gray-800" style={{ marginLeft: '6px' }}>{selectedRequest.vendorName}</p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
