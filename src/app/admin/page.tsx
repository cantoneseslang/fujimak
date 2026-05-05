'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, ChevronLeft, Lock, Mail, Plus, UserCog, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { type MaintenanceRequestRecord } from '@/lib/maintenance'
import { STORES } from '@/lib/constants'
import { formatAngelPizzaStoreLine } from '@/lib/angelStores'

interface NotificationEmail {
  id: string
  email: string
}

interface SupportThread {
  id: string
  store_name: string
  status: 'open' | 'closed'
  workflow_state?: string | null
  contact: Record<string, unknown> | null
  updated_at: string
}

interface MechanicRecord {
  id: string
  name: string
  english_name: string | null
  sir_name: string | null
  family_name: string | null
  phone_number: string | null
  email: string
  login_code: string | null
  is_active: boolean
}

type MechanicDraft = {
  englishName: string
  sirName: string
  familyName: string
  phoneNumber: string
  emailAddress: string
  isActive: boolean
}

interface PartsWorkflow {
  id: string
  order_no: string
  store_name: string
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  updated_at: string
}

type CustomerRow = {
  key: string
  name: string
  email: string
  phone: string
  stores: string[]
  latestAt: string
  supportThreadIds: string[]
  maintenanceRequestIds: string[]
}

const DEFAULT_ORDER_EMAIL = 'bestinksalesman+fujimakdemo@gmail.com'
const DEFAULT_MECHANIC_ROWS = [
  { key: 'mechanica', englishName: 'mechanicA', emailAddress: 'mechanica@fujimak.local' },
  { key: 'mechanicb', englishName: 'mechanicB', emailAddress: 'mechanicb@fujimak.local' },
  { key: 'mechanicc', englishName: 'mechanicC', emailAddress: 'mechanicc@fujimak.local' },
] as const

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeSupportState(thread: SupportThread) {
  const raw = asText(thread.workflow_state)
  if (raw === 'awaiting_invoice') return 'paperwork'
  if (raw) return raw
  return thread.status === 'closed' ? 'closed' : 'pending'
}

export default function AdminPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequestRecord[]>([])
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([])
  const [partsWorkflows, setPartsWorkflows] = useState<PartsWorkflow[]>([])
  const [mechanics, setMechanics] = useState<MechanicRecord[]>([])

  const [loginNotification, setLoginNotification] = useState(false)
  const [storeSelectNotification, setStoreSelectNotification] = useState(false)
  const [maintenanceNotification, setMaintenanceNotification] = useState(false)
  const [notificationEmails, setNotificationEmails] = useState<NotificationEmail[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  const [isSavingMechanics, setIsSavingMechanics] = useState(false)
  const [mechanicDrafts, setMechanicDrafts] = useState<Record<string, MechanicDraft>>({})
  const [expandedMechanicRows, setExpandedMechanicRows] = useState<Record<string, boolean>>({})

  const [storeLimit, setStoreLimit] = useState(10)
  const [enabledStoreIds, setEnabledStoreIds] = useState<string[]>([])
  const [isSavingStoreAccess, setIsSavingStoreAccess] = useState(false)
  const [storeAccessMessage, setStoreAccessMessage] = useState<string | null>(null)
  const [showStoreAccessList, setShowStoreAccessList] = useState(false)
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null)
  const [customerDraft, setCustomerDraft] = useState({ name: '', email: '', phone: '' })
  const [isSavingCustomer, setIsSavingCustomer] = useState(false)
  const [customerActionMessage, setCustomerActionMessage] = useState<string | null>(null)

  const ADMIN_PASSWORD = 'fujimak2026'

  const loadMaintenanceData = useCallback(async () => {
    try {
      const res = await fetch('/api/maintenance?limit=300', { cache: 'no-store' })
      const json = (await res.json()) as { requests?: MaintenanceRequestRecord[] }
      setMaintenanceRequests(Array.isArray(json.requests) ? json.requests : [])
    } catch {
      setMaintenanceRequests([])
    }
  }, [])

  const loadSupportThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/support/threads?status=all', { cache: 'no-store' })
      const json = (await res.json()) as { threads?: SupportThread[] }
      setSupportThreads(Array.isArray(json.threads) ? json.threads : [])
    } catch {
      setSupportThreads([])
    }
  }, [])

  const loadPartsWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/parts-order/workflows?status=all', { cache: 'no-store' })
      const json = (await res.json()) as { workflows?: PartsWorkflow[] }
      setPartsWorkflows(Array.isArray(json.workflows) ? json.workflows : [])
    } catch {
      setPartsWorkflows([])
    }
  }, [])

  const loadMechanics = useCallback(async () => {
    try {
      const res = await fetch('/api/mechanics?includeInactive=1&seedDefault=1', { cache: 'no-store' })
      const json = (await res.json()) as { mechanics?: MechanicRecord[] }
      setMechanics(Array.isArray(json.mechanics) ? json.mechanics : [])
    } catch {
      setMechanics([])
    }
  }, [])

  const loadStoreAccess = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/store-access', { cache: 'no-store' })
      const json = (await res.json()) as {
        limit?: number
        enabledStoreIds?: string[]
      }
      if (!res.ok) throw new Error('Failed to load store access settings')
      const limit = Number.isFinite(json.limit) && (json.limit as number) > 0 ? Number(json.limit) : 10
      const ids = Array.isArray(json.enabledStoreIds) ? json.enabledStoreIds : []
      setStoreLimit(limit)
      setEnabledStoreIds(ids)
    } catch {
      setStoreLimit(10)
      setEnabledStoreIds(STORES.slice(0, 10).map((store) => store.id))
    }
  }, [])

  const loadNotificationSettings = useCallback(async () => {
    try {
      const { data: settings } = await supabase.from('notification_settings').select('*')
      if (settings) {
        settings.forEach((row: { setting_key: string; enabled: boolean }) => {
          if (row.setting_key === 'login_notification') setLoginNotification(row.enabled)
          if (row.setting_key === 'store_select_notification') setStoreSelectNotification(row.enabled)
          if (row.setting_key === 'maintenance_notification') setMaintenanceNotification(row.enabled)
        })
      }
      const { data: emails } = await supabase
        .from('notification_emails')
        .select('*')
        .order('created_at', { ascending: true })
      setNotificationEmails(Array.isArray(emails) ? (emails as NotificationEmail[]) : [])
    } catch {
      setNotificationEmails([])
    }
  }, [])

  const ensureDefaultMechanics = useCallback(async () => {
    await fetch('/api/mechanics?includeInactive=1&seedDefault=1', { cache: 'no-store' })
    await loadMechanics()
  }, [loadMechanics])

  const ensureDefaultOrderEmail = useCallback(async () => {
    const { data } = await supabase
      .from('notification_emails')
      .select('id')
      .eq('email', DEFAULT_ORDER_EMAIL)
      .maybeSingle()
    const hasDefault = Boolean(data)
    if (hasDefault) return
    try {
      await supabase.from('notification_emails').insert({ email: DEFAULT_ORDER_EMAIL })
    } catch {
      // Best effort only
    }
    await loadNotificationSettings()
  }, [loadNotificationSettings])

  const refreshBoard = useCallback(async () => {
    await Promise.all([
      loadMaintenanceData(),
      loadSupportThreads(),
      loadPartsWorkflows(),
      loadMechanics(),
      loadNotificationSettings(),
      loadStoreAccess(),
    ])
    await ensureDefaultMechanics()
    await ensureDefaultOrderEmail()
  }, [
    ensureDefaultMechanics,
    ensureDefaultOrderEmail,
    loadMaintenanceData,
    loadMechanics,
    loadNotificationSettings,
    loadPartsWorkflows,
    loadStoreAccess,
    loadSupportThreads,
  ])

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth')
    if (auth === 'true') {
      setIsAuthenticated(true)
      void refreshBoard()
    }
  }, [refreshBoard])

  const maintenanceCounts = useMemo(
    () => ({
      pending: maintenanceRequests.filter((row) => row.status === 'pending').length,
      inProgress: maintenanceRequests.filter((row) => row.status === 'in_progress').length,
      completed: maintenanceRequests.filter((row) => row.status === 'completed').length,
      cancelled: maintenanceRequests.filter((row) => row.status === 'cancelled').length,
    }),
    [maintenanceRequests]
  )

  const supportCounts = useMemo(
    () =>
      supportThreads.reduce(
        (acc, row) => {
          const workflow = normalizeSupportState(row)
          if (workflow === 'pending' || workflow === 'ready_for_dispatch') acc.pending += 1
          else if (workflow === 'in_progress') acc.inProgress += 1
          else if (workflow === 'paperwork') acc.awaitingInvoice += 1
          else if (workflow === 'completed' || workflow === 'closed') acc.completed += 1
          return acc
        },
        { pending: 0, inProgress: 0, awaitingInvoice: 0, completed: 0 }
      ),
    [supportThreads]
  )

  const partsCounts = useMemo(
    () =>
      partsWorkflows.reduce(
        (acc, row) => {
          if (row.status === 'pending') acc.pending += 1
          else if (row.status === 'processing') acc.processing += 1
          else if (row.status === 'completed') acc.completed += 1
          else if (row.status === 'cancelled') acc.cancelled += 1
          return acc
        },
        { pending: 0, processing: 0, completed: 0, cancelled: 0 }
      ),
    [partsWorkflows]
  )

  const customers = useMemo<CustomerRow[]>(() => {
    const map = new Map<string, CustomerRow>()
    const upsert = (params: {
      name: string
      email: string
      phone: string
      storeName: string
      latestAt: string
      sourceType: 'support' | 'maintenance'
      sourceId: string
    }) => {
      const hasContact =
        asText(params.name).length > 0 ||
        asText(params.email).length > 0 ||
        asText(params.phone).length > 0
      if (!hasContact) return
      const name = asText(params.name) || '-'
      const email = asText(params.email)
      const phone = asText(params.phone)
      const storeName = asText(params.storeName) || '-'
      const key = email || phone || `${name}:${storeName}`
      const current = map.get(key)
      if (!current) {
        map.set(key, {
          key,
          name,
          email: email || '-',
          phone: phone || '-',
          stores: [storeName],
          latestAt: params.latestAt,
          supportThreadIds: params.sourceType === 'support' ? [params.sourceId] : [],
          maintenanceRequestIds: params.sourceType === 'maintenance' ? [params.sourceId] : [],
        })
        return
      }
      if (!current.stores.includes(storeName)) current.stores.push(storeName)
      if (Date.parse(params.latestAt) > Date.parse(current.latestAt)) {
        current.latestAt = params.latestAt
      }
      if (current.name === '-' && name !== '-') current.name = name
      if (current.email === '-' && email) current.email = email
      if (current.phone === '-' && phone) current.phone = phone
      if (params.sourceType === 'support' && !current.supportThreadIds.includes(params.sourceId)) {
        current.supportThreadIds.push(params.sourceId)
      }
      if (params.sourceType === 'maintenance' && !current.maintenanceRequestIds.includes(params.sourceId)) {
        current.maintenanceRequestIds.push(params.sourceId)
      }
    }

    supportThreads.forEach((thread) => {
      const contact = thread.contact && typeof thread.contact === 'object' ? thread.contact : {}
      upsert({
        name: asText((contact as Record<string, unknown>).name) || asText((contact as Record<string, unknown>).surname),
        email: asText((contact as Record<string, unknown>).email),
        phone: asText((contact as Record<string, unknown>).phone),
        storeName: thread.store_name,
        latestAt: thread.updated_at,
        sourceType: 'support',
        sourceId: thread.id,
      })
    })

    maintenanceRequests.forEach((request) => {
      upsert({
        name: asText(request.requested_by),
        email: asText(request.requested_email),
        phone: asText(request.requested_phone),
        storeName: request.store_name,
        latestAt: request.updated_at,
        sourceType: 'maintenance',
        sourceId: request.id,
      })
    })

    return Array.from(map.values()).sort(
      (a, b) => Date.parse(b.latestAt || '1970-01-01') - Date.parse(a.latestAt || '1970-01-01')
    )
  }, [maintenanceRequests, supportThreads])

  const selectedCustomer = useMemo(
    () => customers.find((row) => row.key === selectedCustomerKey) ?? null,
    [customers, selectedCustomerKey]
  )

  useEffect(() => {
    if (!selectedCustomerKey) return
    if (!customers.some((row) => row.key === selectedCustomerKey)) {
      setSelectedCustomerKey(null)
      setCustomerDraft({ name: '', email: '', phone: '' })
    }
  }, [customers, selectedCustomerKey])

  const fixedMechanicRows = useMemo(() => {
    return DEFAULT_MECHANIC_ROWS.map((seed) => {
      const existing =
        mechanics.find((row) => {
          const normalizedName = (row.english_name ?? row.name ?? '').trim().toLowerCase()
          const normalizedEmail = row.email.trim().toLowerCase()
          return normalizedName === seed.key || normalizedEmail === seed.emailAddress
        }) ?? null
      return {
        id: existing?.id ?? `default-${seed.key}`,
        exists: Boolean(existing),
        englishName: existing?.english_name ?? existing?.name ?? seed.englishName,
        sirName: existing?.sir_name ?? '',
        familyName: existing?.family_name ?? '',
        phoneNumber: existing?.phone_number ?? '',
        emailAddress: existing?.email ?? seed.emailAddress,
        isActive: existing?.is_active ?? true,
      }
    })
  }, [mechanics])

  useEffect(() => {
    setMechanicDrafts((prev) => {
      const next: Record<string, MechanicDraft> = {}
      for (const row of fixedMechanicRows) {
        const existing = prev[row.id]
        next[row.id] = existing ?? {
          englishName: row.englishName,
          sirName: row.sirName,
          familyName: row.familyName,
          phoneNumber: row.phoneNumber,
          emailAddress: row.emailAddress,
          isActive: row.isActive,
        }
      }
      return next
    })
  }, [fixedMechanicRows])

  useEffect(() => {
    setExpandedMechanicRows((prev) => {
      const next: Record<string, boolean> = {}
      for (const row of fixedMechanicRows) {
        next[row.id] = prev[row.id] ?? false
      }
      return next
    })
  }, [fixedMechanicRows])

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== ADMIN_PASSWORD) {
      setError('パスワードが正しくありません')
      return
    }

    setIsAuthenticated(true)
    sessionStorage.setItem('admin_auth', 'true')
    setError('')
    await refreshBoard()

    try {
      await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'login',
          deviceInfo: {
            device: navigator.userAgent,
            screenSize: `${window.screen.width} x ${window.screen.height}`,
            language: navigator.language,
          },
        }),
      })
    } catch {
      // best effort
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth')
    setIsAuthenticated(false)
    setPassword('')
  }

  const updateNotificationSetting = async (key: string, enabled: boolean) => {
    setIsSavingSettings(true)
    try {
      await supabase
        .from('notification_settings')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('setting_key', key)
      if (key === 'login_notification') setLoginNotification(enabled)
      if (key === 'store_select_notification') setStoreSelectNotification(enabled)
      if (key === 'maintenance_notification') setMaintenanceNotification(enabled)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const addEmail = async () => {
    const normalized = newEmail.trim().toLowerCase()
    if (!normalized.includes('@')) return
    if (notificationEmails.some((entry) => entry.email.trim().toLowerCase() === normalized)) return
    try {
      const { data, error: insertError } = await supabase
        .from('notification_emails')
        .insert({ email: normalized })
        .select()
        .single()
      if (insertError) throw insertError
      if (data) {
        setNotificationEmails((prev) => [...prev, data as NotificationEmail])
        setNewEmail('')
      }
    } catch {
      // best effort
    }
  }

  const removeEmail = async (id: string) => {
    try {
      await supabase.from('notification_emails').delete().eq('id', id)
      setNotificationEmails((prev) => prev.filter((entry) => entry.id !== id))
    } catch {
      // best effort
    }
  }

  const selectCustomerRow = (row: CustomerRow) => {
    setSelectedCustomerKey(row.key)
    setCustomerActionMessage(null)
    setCustomerDraft({
      name: row.name === '-' ? '' : row.name,
      email: row.email === '-' ? '' : row.email,
      phone: row.phone === '-' ? '' : row.phone,
    })
  }

  const saveCustomerProfile = async () => {
    if (!selectedCustomer) return
    setIsSavingCustomer(true)
    setCustomerActionMessage(null)
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supportThreadIds: selectedCustomer.supportThreadIds,
          maintenanceRequestIds: selectedCustomer.maintenanceRequestIds,
          name: customerDraft.name,
          email: customerDraft.email,
          phone: customerDraft.phone,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || 'Failed to update customer')
      await Promise.all([loadSupportThreads(), loadMaintenanceData()])
      setCustomerActionMessage('顧客情報を更新しました。')
    } catch (error) {
      setCustomerActionMessage(error instanceof Error ? error.message : '顧客情報の更新に失敗しました。')
    } finally {
      setIsSavingCustomer(false)
    }
  }

  const deleteCustomerProfile = async () => {
    if (!selectedCustomer) return
    setIsSavingCustomer(true)
    setCustomerActionMessage(null)
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supportThreadIds: selectedCustomer.supportThreadIds,
          maintenanceRequestIds: selectedCustomer.maintenanceRequestIds,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || 'Failed to delete customer')
      await Promise.all([loadSupportThreads(), loadMaintenanceData()])
      setSelectedCustomerKey(null)
      setCustomerDraft({ name: '', email: '', phone: '' })
      setCustomerActionMessage('顧客情報を削除しました。')
    } catch (error) {
      setCustomerActionMessage(error instanceof Error ? error.message : '顧客情報の削除に失敗しました。')
    } finally {
      setIsSavingCustomer(false)
    }
  }

  const updateMechanicDraft = (mechanicId: string, patch: Partial<MechanicDraft>) => {
    setMechanicDrafts((prev) => {
      const current = prev[mechanicId] ?? {
        englishName: '',
        sirName: '',
        familyName: '',
        phoneNumber: '',
        emailAddress: '',
        isActive: true,
      }
      return {
        ...prev,
        [mechanicId]: {
          ...current,
          ...patch,
        },
      }
    })
  }

  const saveMechanicProfile = async (mechanicId: string) => {
    const draft = mechanicDrafts[mechanicId]
    if (!draft) return
    const englishName = draft.englishName.trim()
    const emailAddress = draft.emailAddress.trim().toLowerCase()
    if (!englishName || !emailAddress.includes('@')) return
    setIsSavingMechanics(true)
    try {
      const payload = {
        englishName,
        sirName: draft.sirName.trim(),
        familyName: draft.familyName.trim(),
        phoneNumber: draft.phoneNumber.trim(),
        emailAddress,
        isActive: draft.isActive,
      }
      const isDefaultRow = mechanicId.startsWith('default-')
      const res = await fetch('/api/mechanics', {
        method: isDefaultRow ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isDefaultRow ? payload : { id: mechanicId, ...payload }),
      })
      if (!res.ok) throw new Error('Failed to update mechanic profile')
      await loadMechanics()
      setExpandedMechanicRows((prev) => ({ ...prev, [mechanicId]: false }))
    } finally {
      setIsSavingMechanics(false)
    }
  }

  const toggleStoreEnabled = (storeId: string, checked: boolean) => {
    setEnabledStoreIds((prev) => {
      const current = new Set(prev)
      if (checked) {
        if (current.size >= storeLimit) return prev
        current.add(storeId)
      } else {
        current.delete(storeId)
      }
      return Array.from(current)
    })
  }

  const saveStoreAccess = async () => {
    setIsSavingStoreAccess(true)
    setStoreAccessMessage(null)
    try {
      const res = await fetch('/api/settings/store-access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: storeLimit,
          enabledStoreIds,
        }),
      })
      const json = (await res.json()) as { error?: string; enabledStoreIds?: string[]; limit?: number }
      if (!res.ok) throw new Error(json.error || 'Failed to save store access settings')
      setEnabledStoreIds(Array.isArray(json.enabledStoreIds) ? json.enabledStoreIds : enabledStoreIds)
      if (typeof json.limit === 'number') setStoreLimit(Math.max(1, Math.floor(json.limit)))
      setStoreAccessMessage('保存しました')
    } catch (error) {
      setStoreAccessMessage(error instanceof Error ? error.message : '保存に失敗しました')
    } finally {
      setIsSavingStoreAccess(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4"
        style={{ paddingLeft: '6px', paddingRight: '6px' }}
      >
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 bg-zinc-100 rounded-full">
              <Lock className="w-8 h-8 text-zinc-900" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">管理者ログイン</h1>
          <p className="text-gray-500 text-center mb-6">アクセスするにはパスワードが必要です</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="パスワードを入力"
              className="w-full px-4 h-20 border border-gray-200 rounded-xl mb-4 text-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
              autoFocus
            />
            {error ? <p className="text-red-500 text-sm mb-4 text-center">{error}</p> : null}
            <button
              type="submit"
              className="w-full h-14 bg-zinc-900 text-white rounded-full font-medium text-lg hover:bg-zinc-800"
            >
              ログイン
            </button>
          </form>
          <button
            onClick={() => router.back()}
            className="w-full mt-4 h-14 text-gray-500 hover:text-gray-700 transition-colors"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingLeft: '6px', paddingRight: '6px' }}>
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-8 h-8 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">管理者ダッシュボード</h1>
          <button onClick={handleLogout} className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg">
            ログアウト
          </button>
        </div>
      </header>

      <div className="p-4 space-y-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800">店舗選択権限</h2>
            <button
              onClick={() => void saveStoreAccess()}
              disabled={isSavingStoreAccess}
              className="h-11 min-w-[110px] rounded-lg bg-zinc-900 px-8 text-sm font-semibold text-white disabled:opacity-50"
              style={{ minWidth: '160px', height: '48px' }}
            >
              保存
            </button>
          </div>
          <p className="text-xs text-gray-600">
            デフォルトは上から10店舗のみ選択可能。上限数と対象店舗をここで管理します。
          </p>
          <div className="mt-3 flex items-center gap-2">
            <label className="text-sm text-gray-700">選択可能店舗数</label>
            <input
              type="number"
              min={1}
              max={STORES.length}
              value={storeLimit}
              onChange={(event) => {
                const raw = Number.parseInt(event.target.value, 10)
                const next = Number.isFinite(raw) ? Math.max(1, Math.min(STORES.length, raw)) : 10
                setStoreLimit(next)
                setEnabledStoreIds((prev) => prev.slice(0, next))
              }}
              className="h-10 w-24 rounded-lg border border-gray-200 px-3 text-sm"
            />
            <span className="text-xs text-gray-500">
              選択中 {enabledStoreIds.length} / {storeLimit}
            </span>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowStoreAccessList((prev) => !prev)}
              className="h-12 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700"
            >
              {showStoreAccessList ? '店舗リストを隠す' : '店舗リストを表示'}
            </button>
          </div>
          {showStoreAccessList ? (
            <div className="mt-3 max-h-64 overflow-y-auto space-y-2 rounded-lg border border-gray-200 p-3">
              {STORES.map((store) => {
                const checked = enabledStoreIds.includes(store.id)
                const disabled = !checked && enabledStoreIds.length >= storeLimit
                return (
                  <label
                    key={store.id}
                    className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm ${
                      disabled ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(event) => toggleStoreEnabled(store.id, event.target.checked)}
                    />
                    <span>{formatAngelPizzaStoreLine(store)}</span>
                  </label>
                )
              })}
            </div>
          ) : null}
          {storeAccessMessage ? (
            <p className="mt-2 text-xs text-gray-600">{storeAccessMessage}</p>
          ) : null}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-4">Processing Status (Pending / Completed)</h2>
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800">Maintenance</p>
              <p className="text-xs text-gray-600 mt-2">Pending: {maintenanceCounts.pending}</p>
              <p className="text-xs text-gray-600">In Progress: {maintenanceCounts.inProgress}</p>
              <p className="text-xs text-gray-600">Completed: {maintenanceCounts.completed}</p>
              <p className="text-xs text-gray-600">Cancelled: {maintenanceCounts.cancelled}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800">Support</p>
              <p className="text-xs text-gray-600 mt-2">Pending: {supportCounts.pending}</p>
              <p className="text-xs text-gray-600">In Progress: {supportCounts.inProgress}</p>
              <p className="text-xs text-gray-600">Paperwork: {supportCounts.awaitingInvoice}</p>
              <p className="text-xs text-gray-600">Completed: {supportCounts.completed}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800">Parts Order</p>
              <p className="text-xs text-gray-600 mt-2">Pending: {partsCounts.pending}</p>
              <p className="text-xs text-gray-600">Processing: {partsCounts.processing}</p>
              <p className="text-xs text-gray-600">Completed: {partsCounts.completed}</p>
              <p className="text-xs text-gray-600">Cancelled: {partsCounts.cancelled}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800">Recent Parts Orders</p>
              {partsWorkflows.length === 0 ? (
                <p className="mt-2 text-xs text-gray-600">No parts orders yet.</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {partsWorkflows.slice(0, 3).map((workflow) => (
                    <p key={workflow.id} className="text-xs text-gray-600">
                      {workflow.order_no} / {workflow.status}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">顧客リスト</h2>
            <span className="mr-3 rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-600">{customers.length} 件</span>
          </div>
          {customers.length === 0 ? (
            <p className="text-sm text-gray-500">顧客データはまだありません。</p>
          ) : (
            <div className="space-y-2">
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {customers.map((row) => {
                  const isSelected = selectedCustomerKey === row.key
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => selectCustomerRow(row)}
                      className={`w-full rounded-xl border px-4 py-3 text-left ${
                        isSelected ? 'border-zinc-900 bg-zinc-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-800">{row.name}</p>
                      <p className="text-xs text-gray-600">Email: {row.email}</p>
                      <p className="text-xs text-gray-600">Phone: {row.phone}</p>
                      <p className="text-xs text-gray-500">Stores: {row.stores.join(', ')}</p>
                      <p className="text-xs text-gray-500">Last: {new Date(row.latestAt).toLocaleString('ja-JP')}</p>
                    </button>
                  )
                })}
              </div>

              {selectedCustomer ? (
                <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-sm font-semibold text-gray-800">選択中の顧客を編集</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      value={customerDraft.name}
                      onChange={(event) => setCustomerDraft((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Name"
                      className="rounded-md border border-gray-300 bg-white px-3 py-3 text-sm text-gray-800"
                    />
                    <input
                      type="email"
                      value={customerDraft.email}
                      onChange={(event) => setCustomerDraft((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="Email"
                      className="rounded-md border border-gray-300 bg-white px-3 py-3 text-sm text-gray-800"
                    />
                    <input
                      value={customerDraft.phone}
                      onChange={(event) => setCustomerDraft((prev) => ({ ...prev, phone: event.target.value }))}
                      placeholder="Phone"
                      className="rounded-md border border-gray-300 bg-white px-3 py-3 text-sm text-gray-800"
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveCustomerProfile()}
                      disabled={isSavingCustomer}
                      className="rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteCustomerProfile()}
                      disabled={isSavingCustomer}
                      className="rounded-md border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 disabled:opacity-50"
                    >
                      削除
                    </button>
                  </div>
                  {customerActionMessage ? (
                    <p className="mt-2 text-xs text-gray-600">{customerActionMessage}</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">一覧から顧客を選択すると編集/削除できます。</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <UserCog className="w-5 h-5 text-zinc-900" />
              メカニック管理
            </h2>
            <button
              onClick={() => void loadMechanics()}
              disabled={isSavingMechanics}
              className="h-11 min-w-[110px] rounded-lg border border-gray-200 bg-gray-50 px-8 text-sm disabled:opacity-50"
              style={{ minWidth: '160px', height: '48px' }}
            >
              更新
            </button>
          </div>

          <div className="mt-2 space-y-2">
            {fixedMechanicRows.map((row) => {
              const draft = mechanicDrafts[row.id]
              const englishName = draft?.englishName ?? row.englishName
              const emailAddress = draft?.emailAddress ?? row.emailAddress
              const isActive = draft?.isActive ?? row.isActive
              const isExpanded = expandedMechanicRows[row.id] ?? false
              return (
                <div key={row.id} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{englishName || '-'}</p>
                      <p className="text-xs text-gray-500">{emailAddress || '-'}</p>
                    </div>
                    <div className="mr-3 flex items-center gap-2">
                      <span
                        className={`rounded-lg px-3 py-2 text-sm font-medium ${
                          isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedMechanicRows((prev) => ({ ...prev, [row.id]: !(prev[row.id] ?? false) }))}
                        className="h-11 min-w-[110px] rounded-lg border border-gray-300 px-8 text-sm font-medium text-gray-700"
                        style={{ minWidth: '160px', height: '48px' }}
                      >
                        {isExpanded ? '閉じる' : row.exists ? '修正' : '登録'}
                      </button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-6">
                      <input
                        value={englishName}
                        onChange={(event) => updateMechanicDraft(row.id, { englishName: event.target.value })}
                        className="rounded-lg border border-gray-200 px-3 py-3 text-sm bg-white"
                        placeholder="English name"
                      />
                      <input
                        value={draft?.sirName ?? row.sirName}
                        onChange={(event) => updateMechanicDraft(row.id, { sirName: event.target.value })}
                        className="rounded-lg border border-gray-200 px-3 py-3 text-sm bg-white"
                        placeholder="Sir name"
                      />
                      <input
                        value={draft?.familyName ?? row.familyName}
                        onChange={(event) => updateMechanicDraft(row.id, { familyName: event.target.value })}
                        placeholder="Family name"
                        className="rounded-lg border border-gray-200 px-3 py-3 text-sm bg-white"
                      />
                      <input
                        value={draft?.phoneNumber ?? row.phoneNumber}
                        onChange={(event) => updateMechanicDraft(row.id, { phoneNumber: event.target.value })}
                        placeholder="Phone number"
                        className="rounded-lg border border-gray-200 px-3 py-3 text-sm bg-white"
                      />
                      <input
                        value={emailAddress}
                        onChange={(event) => updateMechanicDraft(row.id, { emailAddress: event.target.value })}
                        placeholder="Email address"
                        className="rounded-lg border border-gray-200 px-3 py-3 text-sm bg-white"
                      />
                      <div className="flex gap-2 items-center">
                        <label className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-2 text-xs text-gray-700 bg-white">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(event) => updateMechanicDraft(row.id, { isActive: event.target.checked })}
                          />
                          Active
                        </label>
                        <button
                          onClick={() => void saveMechanicProfile(row.id)}
                          disabled={isSavingMechanics}
                          className="h-11 min-w-[110px] rounded-lg bg-zinc-900 px-8 text-sm font-semibold text-white disabled:opacity-50"
                          style={{ minWidth: '160px', height: '48px' }}
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-zinc-900" />
            通知設定
          </h2>

          <div className="mb-8 space-y-4">
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <span className="text-gray-700">ログイン時に通知</span>
              <button
                onClick={() => void updateNotificationSetting('login_notification', !loginNotification)}
                disabled={isSavingSettings}
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  loginNotification ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    loginNotification ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <span className="text-gray-700">店舗選択時に通知</span>
              <button
                onClick={() => void updateNotificationSetting('store_select_notification', !storeSelectNotification)}
                disabled={isSavingSettings}
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  storeSelectNotification ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    storeSelectNotification ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <span className="text-gray-700">メンテナンス送信時に通知</span>
              <button
                onClick={() => void updateNotificationSetting('maintenance_notification', !maintenanceNotification)}
                disabled={isSavingSettings}
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  maintenanceNotification ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    maintenanceNotification ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </label>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              通知先メールアドレス
            </h3>
            <div className="space-y-2 mb-3">
              {notificationEmails.length === 0 ? (
                <p className="text-gray-400 text-base py-4">通知先が設定されていません</p>
              ) : (
                notificationEmails.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between h-16 px-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-700 text-base">{entry.email}</span>
                    <button onClick={() => void removeEmail(entry.id)} className="p-2 text-gray-400 hover:text-red-500">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="メールアドレスを入力"
                className="flex-1 px-4 h-16 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-zinc-900"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void addEmail()
                  }
                }}
              />
              <button
                onClick={() => void addEmail()}
                disabled={!newEmail || !newEmail.includes('@')}
                className="px-6 h-16 bg-zinc-900 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
/*
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, ChevronLeft, Lock, Mail, Plus, RefreshCw, UserCog, Wrench, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { type MaintenanceRequestRecord } from '@/lib/maintenance'

interface NotificationEmail {
  id: string
  email: string
}

interface SupportThread {
  id: string
  store_name: string
  status: 'open' | 'closed'
  workflow_state?: string | null
  contact: Record<string, unknown> | null
  updated_at: string
}

interface MechanicRecord {
  id: string
  name: string
  email: string
  login_code: string | null
  is_active: boolean
}

interface PartsWorkflow {
  id: string
  order_no: string
  store_name: string
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  updated_at: string
}

type CustomerRow = {
  key: string
  name: string
  email: string
  phone: string
  stores: string[]
  latestAt: string
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeSupportState(thread: SupportThread) {
  const raw = asText(thread.workflow_state)
  if (raw) return raw
  return thread.status === 'closed' ? 'closed' : 'pending'
}

export default function AdminPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequestRecord[]>([])
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([])
  const [partsWorkflows, setPartsWorkflows] = useState<PartsWorkflow[]>([])
  const [mechanics, setMechanics] = useState<MechanicRecord[]>([])
  const [isLoadingBoard, setIsLoadingBoard] = useState(false)

  const [loginNotification, setLoginNotification] = useState(false)
  const [storeSelectNotification, setStoreSelectNotification] = useState(false)
  const [maintenanceNotification, setMaintenanceNotification] = useState(false)
  const [notificationEmails, setNotificationEmails] = useState<NotificationEmail[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  const [newMechanicName, setNewMechanicName] = useState('')
  const [newMechanicEmail, setNewMechanicEmail] = useState('')
  const [newMechanicCode, setNewMechanicCode] = useState('')
  const [isSavingMechanics, setIsSavingMechanics] = useState(false)

  const ADMIN_PASSWORD = 'fujimak2026'

  const loadMaintenanceData = useCallback(async () => {
    try {
      const res = await fetch('/api/maintenance?limit=300', { cache: 'no-store' })
      const json = (await res.json()) as { requests?: MaintenanceRequestRecord[] }
      setMaintenanceRequests(Array.isArray(json.requests) ? json.requests : [])
    } catch {
      setMaintenanceRequests([])
    }
  }, [])

  const loadSupportThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/support/threads?status=all', { cache: 'no-store' })
      const json = (await res.json()) as { threads?: SupportThread[] }
      setSupportThreads(Array.isArray(json.threads) ? json.threads : [])
    } catch {
      setSupportThreads([])
    }
  }, [])

  const loadPartsWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/parts-order/workflows?status=all', { cache: 'no-store' })
      const json = (await res.json()) as { workflows?: PartsWorkflow[] }
      setPartsWorkflows(Array.isArray(json.workflows) ? json.workflows : [])
    } catch {
      setPartsWorkflows([])
    }
  }, [])

  const loadMechanics = useCallback(async () => {
    try {
      const res = await fetch('/api/mechanics?includeInactive=1', { cache: 'no-store' })
      const json = (await res.json()) as { mechanics?: MechanicRecord[] }
      setMechanics(Array.isArray(json.mechanics) ? json.mechanics : [])
    } catch {
      setMechanics([])
    }
  }, [])

  const loadNotificationSettings = useCallback(async () => {
    try {
      const { data: settings } = await supabase.from('notification_settings').select('*')
      if (settings) {
        settings.forEach((row: { setting_key: string; enabled: boolean }) => {
          if (row.setting_key === 'login_notification') setLoginNotification(row.enabled)
          if (row.setting_key === 'store_select_notification') setStoreSelectNotification(row.enabled)
          if (row.setting_key === 'maintenance_notification') setMaintenanceNotification(row.enabled)
        })
      }
      const { data: emails } = await supabase
        .from('notification_emails')
        .select('*')
        .order('created_at', { ascending: true })
      setNotificationEmails(Array.isArray(emails) ? (emails as NotificationEmail[]) : [])
    } catch {
      setNotificationEmails([])
    }
  }, [])

  const refreshBoard = useCallback(async () => {
    setIsLoadingBoard(true)
    try {
      await Promise.all([
        loadMaintenanceData(),
        loadSupportThreads(),
        loadPartsWorkflows(),
        loadMechanics(),
        loadNotificationSettings(),
      ])
    } finally {
      setIsLoadingBoard(false)
    }
  }, [loadMaintenanceData, loadMechanics, loadNotificationSettings, loadPartsWorkflows, loadSupportThreads])

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth')
    if (auth === 'true') {
      setIsAuthenticated(true)
      void refreshBoard()
    }
  }, [refreshBoard])

  const maintenanceCounts = useMemo(
    () => ({
      pending: maintenanceRequests.filter((row) => row.status === 'pending').length,
      inProgress: maintenanceRequests.filter((row) => row.status === 'in_progress').length,
      completed: maintenanceRequests.filter((row) => row.status === 'completed').length,
      cancelled: maintenanceRequests.filter((row) => row.status === 'cancelled').length,
    }),
    [maintenanceRequests]
  )

  const supportCounts = useMemo(
    () =>
      supportThreads.reduce(
        (acc, row) => {
          const workflow = normalizeSupportState(row)
          if (workflow === 'pending' || workflow === 'ready_for_dispatch') acc.pending += 1
          else if (workflow === 'in_progress') acc.inProgress += 1
          else if (workflow === 'paperwork') acc.awaitingInvoice += 1
          else if (workflow === 'completed' || workflow === 'closed') acc.completed += 1
          return acc
        },
        { pending: 0, inProgress: 0, awaitingInvoice: 0, completed: 0 }
      ),
    [supportThreads]
  )

  const partsCounts = useMemo(
    () =>
      partsWorkflows.reduce(
        (acc, row) => {
          if (row.status === 'pending') acc.pending += 1
          else if (row.status === 'processing') acc.processing += 1
          else if (row.status === 'completed') acc.completed += 1
          else if (row.status === 'cancelled') acc.cancelled += 1
          return acc
        },
        { pending: 0, processing: 0, completed: 0, cancelled: 0 }
      ),
    [partsWorkflows]
  )

  const customers = useMemo<CustomerRow[]>(() => {
    const map = new Map<string, CustomerRow>()
    const upsert = (params: {
      name: string
      email: string
      phone: string
      storeName: string
      latestAt: string
    }) => {
      const name = asText(params.name) || '-'
      const email = asText(params.email)
      const phone = asText(params.phone)
      const storeName = asText(params.storeName) || '-'
      const key = email || phone || `${name}:${storeName}`
      const current = map.get(key)
      if (!current) {
        map.set(key, {
          key,
          name,
          email: email || '-',
          phone: phone || '-',
          stores: [storeName],
          latestAt: params.latestAt,
        })
        return
      }
      if (!current.stores.includes(storeName)) current.stores.push(storeName)
      if (Date.parse(params.latestAt) > Date.parse(current.latestAt)) {
        current.latestAt = params.latestAt
      }
      if (current.name === '-' && name !== '-') current.name = name
      if (current.email === '-' && email) current.email = email
      if (current.phone === '-' && phone) current.phone = phone
    }

    supportThreads.forEach((thread) => {
      const contact = thread.contact && typeof thread.contact === 'object' ? thread.contact : {}
      upsert({
        name: asText((contact as Record<string, unknown>).name) || asText((contact as Record<string, unknown>).surname),
        email: asText((contact as Record<string, unknown>).email),
        phone: asText((contact as Record<string, unknown>).phone),
        storeName: thread.store_name,
        latestAt: thread.updated_at,
      })
    })

    maintenanceRequests.forEach((request) => {
      upsert({
        name: asText(request.requested_by),
        email: asText(request.requested_email),
        phone: asText(request.requested_phone),
        storeName: request.store_name,
        latestAt: request.updated_at,
      })
    })

    return Array.from(map.values()).sort(
      (a, b) => Date.parse(b.latestAt || '1970-01-01') - Date.parse(a.latestAt || '1970-01-01')
    )
  }, [maintenanceRequests, supportThreads])

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== ADMIN_PASSWORD) {
      setError('パスワードが正しくありません')
      return
    }

    setIsAuthenticated(true)
    sessionStorage.setItem('admin_auth', 'true')
    setError('')
    await refreshBoard()

    try {
      await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'login',
          deviceInfo: {
            device: navigator.userAgent,
            screenSize: `${window.screen.width} x ${window.screen.height}`,
            language: navigator.language,
          },
        }),
      })
    } catch {
      // best effort
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth')
    setIsAuthenticated(false)
    setPassword('')
  }

  const updateNotificationSetting = async (key: string, enabled: boolean) => {
    setIsSavingSettings(true)
    try {
      await supabase
        .from('notification_settings')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('setting_key', key)
      if (key === 'login_notification') setLoginNotification(enabled)
      if (key === 'store_select_notification') setStoreSelectNotification(enabled)
      if (key === 'maintenance_notification') setMaintenanceNotification(enabled)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const addEmail = async () => {
    const normalized = newEmail.trim().toLowerCase()
    if (!normalized.includes('@')) return
    if (notificationEmails.some((entry) => entry.email.trim().toLowerCase() === normalized)) return
    try {
      const { data, error: insertError } = await supabase
        .from('notification_emails')
        .insert({ email: normalized })
        .select()
        .single()
      if (insertError) throw insertError
      if (data) {
        setNotificationEmails((prev) => [...prev, data as NotificationEmail])
        setNewEmail('')
      }
    } catch {
      // best effort
    }
  }

  const removeEmail = async (id: string) => {
    try {
      await supabase.from('notification_emails').delete().eq('id', id)
      setNotificationEmails((prev) => prev.filter((entry) => entry.id !== id))
    } catch {
      // best effort
    }
  }

  const addMechanic = async () => {
    const name = newMechanicName.trim()
    const email = newMechanicEmail.trim().toLowerCase()
    if (!name || !email.includes('@')) return
    setIsSavingMechanics(true)
    try {
      const res = await fetch('/api/mechanics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          loginCode: newMechanicCode.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to add mechanic')
      setNewMechanicName('')
      setNewMechanicEmail('')
      setNewMechanicCode('')
      await loadMechanics()
    } finally {
      setIsSavingMechanics(false)
    }
  }

  const toggleMechanicActive = async (mechanic: MechanicRecord) => {
    setIsSavingMechanics(true)
    try {
      const res = await fetch('/api/mechanics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mechanic.id, isActive: !mechanic.is_active }),
      })
      if (!res.ok) throw new Error('Failed to update mechanic')
      await loadMechanics()
    } finally {
      setIsSavingMechanics(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4"
        style={{ paddingLeft: '6px', paddingRight: '6px' }}
      >
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 bg-zinc-100 rounded-full">
              <Lock className="w-8 h-8 text-zinc-900" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">管理者ログイン</h1>
          <p className="text-gray-500 text-center mb-6">アクセスするにはパスワードが必要です</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="パスワードを入力"
              className="w-full px-4 h-20 border border-gray-200 rounded-xl mb-4 text-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
              autoFocus
            />
            {error ? <p className="text-red-500 text-sm mb-4 text-center">{error}</p> : null}
            <button
              type="submit"
              className="w-full h-14 bg-zinc-900 text-white rounded-full font-medium text-lg hover:bg-zinc-800"
            >
              ログイン
            </button>
          </form>
          <button
            onClick={() => router.back()}
            className="w-full mt-4 h-14 text-gray-500 hover:text-gray-700 transition-colors"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingLeft: '6px', paddingRight: '6px' }}>
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-8 h-8 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">管理者ダッシュボード</h1>
          <button onClick={handleLogout} className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg">
            ログアウト
          </button>
        </div>
      </header>

      <div className="p-4 space-y-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800">運用ショートカット</h2>
            <button
              onClick={() => void refreshBoard()}
              disabled={isLoadingBoard}
              className="inline-flex h-11 min-w-[110px] items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-8 text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingBoard ? 'animate-spin' : ''}`} />
              更新
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              onClick={() => router.push('/management')}
              className="h-14 rounded-xl bg-zinc-900 text-white text-sm font-semibold"
            >
              処理ボードへ移動
            </button>
            <button
              onClick={() => router.push('/mechanic/board')}
              className="h-14 rounded-xl bg-blue-600 text-white text-sm font-semibold"
            >
              メカニックボードへ移動
            </button>
            <button
              onClick={() => router.push('/mechanic')}
              className="h-14 rounded-xl bg-green-600 text-white text-sm font-semibold"
            >
              メカニック作業画面へ移動
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-4">処理状況（Pending / Completed）</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800">Maintenance</p>
              <p className="text-xs text-gray-600 mt-2">Pending: {maintenanceCounts.pending}</p>
              <p className="text-xs text-gray-600">In Progress: {maintenanceCounts.inProgress}</p>
              <p className="text-xs text-gray-600">Completed: {maintenanceCounts.completed}</p>
              <p className="text-xs text-gray-600">Cancelled: {maintenanceCounts.cancelled}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800">Support</p>
              <p className="text-xs text-gray-600 mt-2">Pending: {supportCounts.pending}</p>
              <p className="text-xs text-gray-600">In Progress: {supportCounts.inProgress}</p>
              <p className="text-xs text-gray-600">Paperwork: {supportCounts.awaitingInvoice}</p>
              <p className="text-xs text-gray-600">Completed: {supportCounts.completed}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800">Parts Order</p>
              <p className="text-xs text-gray-600 mt-2">Pending: {partsCounts.pending}</p>
              <p className="text-xs text-gray-600">Processing: {partsCounts.processing}</p>
              <p className="text-xs text-gray-600">Completed: {partsCounts.completed}</p>
              <p className="text-xs text-gray-600">Cancelled: {partsCounts.cancelled}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">顧客リスト</h2>
            <span className="mr-3 rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-600">{customers.length} 件</span>
          </div>
          {customers.length === 0 ? (
            <p className="text-sm text-gray-500">顧客データはまだありません。</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {customers.map((row) => (
                <div key={row.key} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-gray-800">{row.name}</p>
                  <p className="text-xs text-gray-600">Email: {row.email}</p>
                  <p className="text-xs text-gray-600">Phone: {row.phone}</p>
                  <p className="text-xs text-gray-500">Stores: {row.stores.join(', ')}</p>
                  <p className="text-xs text-gray-500">Last: {new Date(row.latestAt).toLocaleString('ja-JP')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <UserCog className="w-5 h-5 text-zinc-900" />
              メカニック管理
            </h2>
            <button
              onClick={() => void loadMechanics()}
              disabled={isSavingMechanics}
              className="h-11 min-w-[110px] rounded-lg border border-gray-200 bg-gray-50 px-8 text-sm disabled:opacity-50"
            >
              更新
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={newMechanicName}
              onChange={(event) => setNewMechanicName(event.target.value)}
              placeholder="名前"
              className="rounded-xl border border-gray-200 px-4 h-16 text-base"
            />
            <input
              type="email"
              value={newMechanicEmail}
              onChange={(event) => setNewMechanicEmail(event.target.value)}
              placeholder="メール"
              className="rounded-xl border border-gray-200 px-4 h-16 text-base"
            />
            <input
              value={newMechanicCode}
              onChange={(event) => setNewMechanicCode(event.target.value)}
              placeholder="ログインコード(任意)"
              className="rounded-xl border border-gray-200 px-4 h-16 text-base"
            />
          </div>
          <button
            onClick={() => void addMechanic()}
            disabled={isSavingMechanics}
            className="mt-3 h-14 rounded-xl bg-zinc-900 px-6 text-white disabled:opacity-50"
          >
            メカニックを追加
          </button>

          <div className="mt-4 space-y-2">
            {mechanics.length === 0 ? (
              <p className="text-sm text-gray-500">メカニックはまだ登録されていません。</p>
            ) : (
              mechanics.map((row) => (
                <div key={row.id} className="rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{row.name}</p>
                      <p className="text-xs text-gray-500">{row.email}</p>
                    </div>
                    <button
                      onClick={() => void toggleMechanicActive(row)}
                      disabled={isSavingMechanics}
                      className={`h-11 min-w-[110px] rounded-lg px-6 text-sm font-semibold ${
                        row.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {row.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-zinc-900" />
            通知設定
          </h2>

          <div className="mb-8 space-y-4">
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <span className="text-gray-700">ログイン時に通知</span>
              <button
                onClick={() => void updateNotificationSetting('login_notification', !loginNotification)}
                disabled={isSavingSettings}
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  loginNotification ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    loginNotification ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <span className="text-gray-700">店舗選択時に通知</span>
              <button
                onClick={() => void updateNotificationSetting('store_select_notification', !storeSelectNotification)}
                disabled={isSavingSettings}
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  storeSelectNotification ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    storeSelectNotification ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </label>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <span className="text-gray-700">メンテナンス送信時に通知</span>
              <button
                onClick={() => void updateNotificationSetting('maintenance_notification', !maintenanceNotification)}
                disabled={isSavingSettings}
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  maintenanceNotification ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    maintenanceNotification ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </label>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              通知先メールアドレス
            </h3>
            <div className="space-y-2 mb-3">
              {notificationEmails.length === 0 ? (
                <p className="text-gray-400 text-base py-4">通知先が設定されていません</p>
              ) : (
                notificationEmails.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between h-16 px-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-700 text-base">{entry.email}</span>
                    <button onClick={() => void removeEmail(entry.id)} className="p-2 text-gray-400 hover:text-red-500">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="メールアドレスを入力"
                className="flex-1 px-4 h-16 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-zinc-900"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void addEmail()
                }}
              />
              <button
                onClick={() => void addEmail()}
                disabled={!newEmail || !newEmail.includes('@')}
                className="px-6 h-16 bg-zinc-900 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-zinc-900" />
            直近の部品オーダー
          </h2>
          {partsWorkflows.length === 0 ? (
            <p className="text-sm text-gray-500">部品オーダーはまだありません。</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {partsWorkflows.slice(0, 20).map((workflow) => (
                <div key={workflow.id} className="rounded-xl border border-gray-200 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-800">{workflow.order_no}</p>
                  <p className="text-xs text-gray-600">{workflow.store_name}</p>
                  <p className="text-xs text-gray-500">
                    {workflow.status} / {new Date(workflow.updated_at).toLocaleString('ja-JP')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
* /
/*
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { type MaintenanceRequestRecord, updateMaintenanceRequest } from '@/lib/maintenance'
import { 
  ChevronLeft, 
  Users, 
  Eye, 
  Globe, 
  Smartphone, 
  Monitor,
  TrendingUp,
  Clock,
  Lock,
  BarChart3,
  RefreshCw,
  ExternalLink,
  Bell,
  Mail,
  MessageCircle,
  Plus,
  X
} from 'lucide-react'

interface VisitorLog {
  id: string
  visitor_id: string
  page: string
  user_agent: string
  language: string
  screen_width: number
  screen_height: number
  referrer: string
  created_at: string
}

interface NotificationEmail {
  id: string
  email: string
}

interface SupportThread {
  id: string
  store_id: string
  store_name: string
  status: 'open' | 'closed'
  urgency: 'urgent' | 'normal' | null
  summary: string | null
  contact: Record<string, unknown> | null
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

interface MechanicRecord {
  id: string
  name: string
  email: string
  login_code: string | null
  is_active: boolean
}

export default function AdminPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [stats, setStats] = useState({
    totalVisits: 0,
    uniqueVisitors: 0,
    mobileUsers: 0,
    desktopUsers: 0,
    todayVisits: 0
  })

  // 通知設定
  const [loginNotification, setLoginNotification] = useState(false)
  const [storeSelectNotification, setStoreSelectNotification] = useState(false)
  const [maintenanceNotification, setMaintenanceNotification] = useState(false)
  const [notificationEmails, setNotificationEmails] = useState<NotificationEmail[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // 問い合わせ（サポートチャット）
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([])
  const [isSupportLoading, setIsSupportLoading] = useState(false)
  const [mechanics, setMechanics] = useState<MechanicRecord[]>([])
  const [newMechanicName, setNewMechanicName] = useState('')
  const [newMechanicEmail, setNewMechanicEmail] = useState('')
  const [newMechanicCode, setNewMechanicCode] = useState('')
  const [isSavingMechanics, setIsSavingMechanics] = useState(false)

  // メンテナンス案件（PC管理）
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequestRecord[]>([])
  const [maintenanceStats, setMaintenanceStats] = useState({
    open: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
    avgCompletionHours: 0,
  })
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(false)

  // 管理者パスワード
  const ADMIN_PASSWORD = 'fujimak2026'

  const loadVisitorData = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('visitor_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error

      const logs = data || []
      setVisitorLogs(logs)

      // 統計を計算
      const uniqueIDs = new Set(logs.map((log: VisitorLog) => log.visitor_id))
      const mobileCount = logs.filter((log: VisitorLog) => log.screen_width < 768).length
      const today = new Date().toDateString()
      const todayCount = logs.filter((log: VisitorLog) => 
        new Date(log.created_at).toDateString() === today
      ).length

      setStats({
        totalVisits: logs.length,
        uniqueVisitors: uniqueIDs.size,
        mobileUsers: mobileCount,
        desktopUsers: logs.length - mobileCount,
        todayVisits: todayCount
      })
    } catch (err) {
      console.error('Failed to load visitor data:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadNotificationSettings = useCallback(async () => {
    try {
      // 通知設定を取得
      const { data: settings } = await supabase
        .from('notification_settings')
        .select('*')

      if (settings) {
        settings.forEach((s: { setting_key: string; enabled: boolean }) => {
          if (s.setting_key === 'login_notification') setLoginNotification(s.enabled)
          if (s.setting_key === 'store_select_notification') setStoreSelectNotification(s.enabled)
          if (s.setting_key === 'maintenance_notification') setMaintenanceNotification(s.enabled)
        })
      }

      // 通知先メールを取得
      const { data: emails } = await supabase
        .from('notification_emails')
        .select('*')
        .order('created_at', { ascending: true })

      if (emails) setNotificationEmails(emails)
    } catch (err) {
      console.error('Failed to load notification settings:', err)
    }
  }, [])

  const loadSupportThreads = useCallback(async () => {
    setIsSupportLoading(true)
    try {
      const res = await fetch('/api/support/threads?status=open')
      const json = await res.json()
      setSupportThreads(json.threads || [])
    } catch (e) {
      console.error('Failed to load support threads:', e)
    } finally {
      setIsSupportLoading(false)
    }
  }, [])

  const loadMechanics = useCallback(async () => {
    try {
      const res = await fetch('/api/mechanics?includeInactive=1', { cache: 'no-store' })
      const json = (await res.json()) as { mechanics?: MechanicRecord[] }
      setMechanics(Array.isArray(json.mechanics) ? json.mechanics : [])
    } catch (error) {
      console.error('Failed to load mechanics:', error)
      setMechanics([])
    }
  }, [])

  const loadSupportMessages = useCallback(async (threadId: string) => {
    setIsSupportLoading(true)
    try {
      const res = await fetch(`/api/support/messages?threadId=${encodeURIComponent(threadId)}`)
      const json = await res.json()
      setSupportMessages(json.messages || [])
    } catch (e) {
      console.error('Failed to load support messages:', e)
    } finally {
      setIsSupportLoading(false)
    }
  }, [])

  const closeThread = useCallback(async (threadId: string) => {
    setIsSupportLoading(true)
    try {
      await fetch('/api/support/threads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, status: 'closed' }),
      })
      setSelectedThreadId(null)
      setSupportMessages([])
      await loadSupportThreads()
    } catch (e) {
      console.error('Failed to close support thread:', e)
    } finally {
      setIsSupportLoading(false)
    }
  }, [loadSupportThreads])

  const loadMaintenanceData = useCallback(async () => {
    setIsMaintenanceLoading(true)
    try {
      const res = await fetch('/api/maintenance?limit=300', { cache: 'no-store' })
      const json = (await res.json()) as { requests?: MaintenanceRequestRecord[] }
      const requests = json.requests ?? []
      setMaintenanceRequests(requests)

      const now = new Date()
      const open = requests.filter((request) => request.status === 'pending').length
      const inProgress = requests.filter((request) => request.status === 'in_progress').length
      const completedRows = requests.filter((request) => request.status === 'completed')
      const completed = completedRows.length
      const overdue = requests.filter((request) => {
        if (request.status === 'completed' || request.status === 'cancelled') return false
        return new Date(request.preferred_date) < now
      }).length

      const completionHours = completedRows
        .map((request) => {
          if (!request.completed_at) return null
          const createdAtMs = new Date(request.created_at).getTime()
          const completedAtMs = new Date(request.completed_at).getTime()
          if (Number.isNaN(createdAtMs) || Number.isNaN(completedAtMs) || completedAtMs < createdAtMs) {
            return null
          }
          return (completedAtMs - createdAtMs) / (1000 * 60 * 60)
        })
        .filter((value): value is number => typeof value === 'number')

      const avgCompletionHours =
        completionHours.length > 0
          ? Number(
              (completionHours.reduce((sum, hours) => sum + hours, 0) / completionHours.length).toFixed(1)
            )
          : 0

      setMaintenanceStats({
        open,
        inProgress,
        completed,
        overdue,
        avgCompletionHours,
      })
    } catch (error) {
      console.error('Failed to load maintenance data:', error)
    } finally {
      setIsMaintenanceLoading(false)
    }
  }, [])

  const handleMaintenanceStatusUpdate = useCallback(
    async (requestId: string, nextStatus: 'in_progress' | 'completed' | 'cancelled') => {
      try {
        await updateMaintenanceRequest(requestId, { status: nextStatus })
        await loadMaintenanceData()
      } catch (error) {
        console.error('Failed to update maintenance status:', error)
      }
    },
    [loadMaintenanceData]
  )

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth')
    if (auth === 'true') {
      setIsAuthenticated(true)
      loadVisitorData()
      loadNotificationSettings()
      loadSupportThreads()
      loadMaintenanceData()
      loadMechanics()
    }
  }, [loadMaintenanceData, loadMechanics, loadNotificationSettings, loadSupportThreads, loadVisitorData])

  // デバイス情報を取得する関数
  const getDeviceInfo = () => {
    const ua = navigator.userAgent
    let device = 'Unknown'
    
    if (/iPhone|iPad|iPod/.test(ua)) {
      device = 'Mobile (iOS Safari)'
    } else if (/Android/.test(ua)) {
      device = 'Mobile (Android)'
    } else if (/Windows/.test(ua)) {
      device = /Chrome/.test(ua) ? 'Desktop (Windows Chrome)' : /Firefox/.test(ua) ? 'Desktop (Windows Firefox)' : 'Desktop (Windows)'
    } else if (/Mac/.test(ua)) {
      device = /Chrome/.test(ua) ? 'Desktop (Mac Chrome)' : /Safari/.test(ua) ? 'Desktop (Mac Safari)' : 'Desktop (Mac)'
    }
    
    return {
      device,
      screenSize: `${window.screen.width} x ${window.screen.height}`,
      language: navigator.language
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      sessionStorage.setItem('admin_auth', 'true')
      setError('')
      loadVisitorData()
      loadNotificationSettings()
      loadSupportThreads()
      loadMaintenanceData()
      loadMechanics()
      
      // ログイン通知メールを送信（設定が有効な場合）
      try {
        await fetch('/api/send-notification', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            type: 'login',
            deviceInfo: getDeviceInfo()
          })
        })
      } catch (err) {
        console.error('Failed to send login notification:', err)
      }
    } else {
      setError('パスワードが正しくありません')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth')
    setIsAuthenticated(false)
    setPassword('')
  }

  const clearLogs = async () => {
    if (confirm('すべての訪問者ログを削除しますか？')) {
      try {
        await supabase.from('visitor_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        setVisitorLogs([])
        setStats({
          totalVisits: 0,
          uniqueVisitors: 0,
          mobileUsers: 0,
          desktopUsers: 0,
          todayVisits: 0
        })
      } catch (err) {
        console.error('Failed to clear logs:', err)
      }
    }
  }

  const updateNotificationSetting = async (key: string, enabled: boolean) => {
    setIsSavingSettings(true)
    try {
      await supabase
        .from('notification_settings')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('setting_key', key)

      if (key === 'login_notification') setLoginNotification(enabled)
      if (key === 'store_select_notification') setStoreSelectNotification(enabled)
      if (key === 'maintenance_notification') setMaintenanceNotification(enabled)
    } catch (err) {
      console.error('Failed to update setting:', err)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const addEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) return
    const normalized = newEmail.trim().toLowerCase()
    if (!normalized.includes('@')) return
    if (notificationEmails.some((e) => e.email.trim().toLowerCase() === normalized)) return
    
    try {
      const { data, error } = await supabase
        .from('notification_emails')
        .insert({ email: normalized })
        .select()
        .single()

      if (error) throw error
      if (data) {
        setNotificationEmails([...notificationEmails, data])
        setNewEmail('')
      }
    } catch (err) {
      console.error('Failed to add email:', err)
    }
  }

  const removeEmail = async (id: string) => {
    try {
      await supabase
        .from('notification_emails')
        .delete()
        .eq('id', id)

      setNotificationEmails(notificationEmails.filter(e => e.id !== id))
    } catch (err) {
      console.error('Failed to remove email:', err)
    }
  }

  const addMechanic = async () => {
    const name = newMechanicName.trim()
    const email = newMechanicEmail.trim().toLowerCase()
    if (!name || !email.includes('@')) return
    setIsSavingMechanics(true)
    try {
      const res = await fetch('/api/mechanics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          loginCode: newMechanicCode.trim() || null,
        }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error || 'Failed to add mechanic')
      }
      setNewMechanicName('')
      setNewMechanicEmail('')
      setNewMechanicCode('')
      await loadMechanics()
    } catch (error) {
      console.error('Failed to add mechanic:', error)
    } finally {
      setIsSavingMechanics(false)
    }
  }

  const toggleMechanicActive = async (row: MechanicRecord) => {
    setIsSavingMechanics(true)
    try {
      const res = await fetch('/api/mechanics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, isActive: !row.is_active }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error || 'Failed to update mechanic')
      }
      await loadMechanics()
    } catch (error) {
      console.error('Failed to toggle mechanic active state:', error)
    } finally {
      setIsSavingMechanics(false)
    }
  }

  // ログインフォーム
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 bg-zinc-100 rounded-full">
              <Lock className="w-8 h-8 text-zinc-900" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
            管理者ログイン
          </h1>
          <p className="text-gray-500 text-center mb-6">
            アクセスするにはパスワードが必要です
          </p>
          
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              className="w-full px-4 h-20 border border-gray-200 rounded-xl mb-4 text-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
            )}
            <button
              type="submit"
              className="w-full h-14 bg-zinc-900 text-white rounded-full font-medium text-lg hover:bg-zinc-800 transition-colors shadow-lg"
            >
              ログイン
            </button>
          </form>
          
          <button
            onClick={() => router.back()}
            className="w-full mt-4 h-16 text-gray-500 hover:text-gray-700 transition-colors"
          >
            戻る
          </button>
        </div>
      </div>
    )
  }

  // 管理者ダッシュボード
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー * /}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4">
          <button 
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-8 h-8 text-gray-700" />
          </button>
          
          <h1 className="text-xl font-bold text-gray-800">管理者ダッシュボード</h1>
          
          <button 
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            ログアウト
          </button>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* 問い合わせ（サポートチャット） * /}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-zinc-900" />
              問い合わせ（AIチャット）
            </h2>
            <button
              onClick={loadSupportThreads}
              disabled={isSupportLoading}
              className="px-4 py-2 text-sm bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
            >
              更新
            </button>
          </div>

          {supportThreads.length === 0 ? (
            <p className="text-gray-400 text-base py-6">未対応の問い合わせはありません</p>
          ) : (
            <div className="space-y-3">
              {supportThreads.map((th) => (
                <button
                  key={th.id}
                  onClick={() => {
                    setSelectedThreadId(th.id)
                    loadSupportMessages(th.id)
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    selectedThreadId === th.id
                      ? 'border-zinc-900 bg-zinc-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-800">{th.store_name}</span>
                      <span className="text-xs text-gray-500">{new Date(th.updated_at).toLocaleString()}</span>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      th.urgency === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {th.urgency === 'urgent' ? '緊急' : '通常'}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-700 line-clamp-2">
                    {th.summary || '（要約なし）'}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedThreadId && (
            <div className="mt-5 border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">会話ログ</h3>
                <button
                  onClick={() => closeThread(selectedThreadId)}
                  disabled={isSupportLoading}
                  className="px-4 py-2 text-sm bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                >
                  対応完了（Close）
                </button>
              </div>
              <div className="max-h-80 overflow-auto space-y-3 bg-gray-50 rounded-xl p-4">
                {supportMessages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-zinc-900 text-white'
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* メンテナンス案件セクション * /}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">メンテナンス案件管理</h2>
            <button
              onClick={loadMaintenanceData}
              disabled={isMaintenanceLoading}
              className="px-4 py-2 text-sm bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
            >
              更新
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
            <div className="rounded-xl bg-yellow-50 p-3">
              <p className="text-xs text-yellow-700">受付</p>
              <p className="text-xl font-semibold text-yellow-800">{maintenanceStats.open}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3">
              <p className="text-xs text-blue-700">対応中</p>
              <p className="text-xl font-semibold text-blue-800">{maintenanceStats.inProgress}</p>
            </div>
            <div className="rounded-xl bg-green-50 p-3">
              <p className="text-xs text-green-700">完了</p>
              <p className="text-xl font-semibold text-green-800">{maintenanceStats.completed}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-xs text-red-700">期限超過</p>
              <p className="text-xl font-semibold text-red-800">{maintenanceStats.overdue}</p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-xs text-zinc-700">平均対応時間</p>
              <p className="text-xl font-semibold text-zinc-800">{maintenanceStats.avgCompletionHours}h</p>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {maintenanceRequests.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">案件データはまだありません。</p>
            ) : (
              maintenanceRequests.slice(0, 30).map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-gray-200 px-4 py-3 flex flex-col gap-2 bg-white"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{request.store_name}</p>
                      <p className="text-xs text-gray-500">
                        {request.machine_name ?? request.machine_model ?? request.item_id ?? '-'}
                        {request.machine_serial ? ` / ${request.machine_serial}` : ''}
                      </p>
                      <p className="text-xs text-gray-400">
                        {request.fault_location ?? request.category_id ?? '-'}
                      </p>
                    </div>
                    <span className="text-xs rounded-full px-2 py-1 bg-gray-100 text-gray-700">
                      {request.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    希望日: {request.preferred_date} {request.preferred_start_time || '--:--'} -{' '}
                    {request.preferred_end_time || '--:--'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMaintenanceStatusUpdate(request.id, 'in_progress')}
                      className="px-3 py-1.5 text-xs rounded-lg bg-blue-500 text-white"
                    >
                      対応中
                    </button>
                    <button
                      onClick={() => handleMaintenanceStatusUpdate(request.id, 'completed')}
                      className="px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white"
                    >
                      完了
                    </button>
                    <button
                      onClick={() => handleMaintenanceStatusUpdate(request.id, 'cancelled')}
                      className="px-3 py-1.5 text-xs rounded-lg bg-gray-500 text-white"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* メカニック管理セクション * /}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">メカニック管理</h2>
            <button
              onClick={loadMechanics}
              disabled={isSavingMechanics}
              className="px-4 py-2 text-sm bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-50"
            >
              更新
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={newMechanicName}
              onChange={(event) => setNewMechanicName(event.target.value)}
              placeholder="名前"
              className="rounded-xl border border-gray-200 px-4 h-16 text-base"
            />
            <input
              type="email"
              value={newMechanicEmail}
              onChange={(event) => setNewMechanicEmail(event.target.value)}
              placeholder="メール"
              className="rounded-xl border border-gray-200 px-4 h-16 text-base"
            />
            <input
              value={newMechanicCode}
              onChange={(event) => setNewMechanicCode(event.target.value)}
              placeholder="ログインコード(任意)"
              className="rounded-xl border border-gray-200 px-4 h-16 text-base"
            />
          </div>
          <button
            onClick={addMechanic}
            disabled={isSavingMechanics}
            className="mt-3 h-14 rounded-xl bg-zinc-900 px-6 text-white disabled:opacity-50"
          >
            メカニックを追加
          </button>

          <div className="mt-4 space-y-2">
            {mechanics.length === 0 ? (
              <p className="text-sm text-gray-500">メカニックはまだ登録されていません。</p>
            ) : (
              mechanics.map((row) => (
                <div key={row.id} className="rounded-xl border border-gray-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{row.name}</p>
                      <p className="text-xs text-gray-500">{row.email}</p>
                    </div>
                    <button
                      onClick={() => void toggleMechanicActive(row)}
                      disabled={isSavingMechanics}
                      className={`h-11 min-w-[110px] rounded-lg px-6 text-sm font-semibold ${
                        row.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {row.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 通知設定セクション * /}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-zinc-900" />
            通知設定
          </h2>

          {/* 通知タイミング * /}
          <div className="mb-8">
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <span className="text-gray-700">ログイン時に通知</span>
              <button
                onClick={() => updateNotificationSetting('login_notification', !loginNotification)}
                disabled={isSavingSettings}
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  loginNotification ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span 
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    loginNotification ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </label>

            <div className="my-6 border-t border-gray-200"></div>

            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <span className="text-gray-700">店舗選択時に通知</span>
              <button
                onClick={() => updateNotificationSetting('store_select_notification', !storeSelectNotification)}
                disabled={isSavingSettings}
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  storeSelectNotification ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span 
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    storeSelectNotification ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </label>

            <div className="my-6 border-t border-gray-200"></div>

            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer">
              <span className="text-gray-700">メンテナンス送信時に通知</span>
              <button
                onClick={() => updateNotificationSetting('maintenance_notification', !maintenanceNotification)}
                disabled={isSavingSettings}
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  maintenanceNotification ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span 
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                    maintenanceNotification ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </label>

            <div className="my-6 border-t border-gray-200"></div>
          </div>

          {/* 通知先メールアドレス * /}
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              通知先メールアドレス
            </h3>

            {/* メール一覧 * /}
            <div className="space-y-2 mb-3">
              {notificationEmails.length === 0 ? (
                <p className="text-gray-400 text-base py-4">通知先が設定されていません</p>
              ) : (
                notificationEmails.map((email) => (
                  <div key={email.id} className="flex items-center justify-between h-16 px-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-700 text-base">{email.email}</span>
                    <button
                      onClick={() => removeEmail(email.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* メール追加フォーム * /}
            <div className="flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="メールアドレスを入力"
                className="flex-1 px-4 h-16 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
              />
              <button
                onClick={addEmail}
                disabled={!newEmail || !newEmail.includes('@')}
                className="px-6 h-16 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* 更新ボタン * /}
        <button
          onClick={loadVisitorData}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-4 bg-white rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? '読み込み中...' : 'データを更新'}
        </button>

        {/* 統計カード * /}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Eye className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-gray-500 text-sm">総アクセス数</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.totalVisits}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-gray-500 text-sm">ユニーク訪問者</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.uniqueVisitors}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-100 rounded-xl">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-gray-500 text-sm">今日のアクセス</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.todayVisits}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-100 rounded-xl">
                <Smartphone className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-gray-500 text-sm">モバイル</span>
            </div>
            <p className="text-3xl font-bold text-gray-800">{stats.mobileUsers}</p>
          </div>
        </div>

        {/* デバイス比率 * /}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            デバイス比率
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">モバイル</span>
                <span className="font-medium">
                  {stats.totalVisits > 0 ? Math.round((stats.mobileUsers / stats.totalVisits) * 100) : 0}%
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 rounded-full transition-all"
                  style={{ width: `${stats.totalVisits > 0 ? (stats.mobileUsers / stats.totalVisits) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">デスクトップ</span>
                <span className="font-medium">
                  {stats.totalVisits > 0 ? Math.round((stats.desktopUsers / stats.totalVisits) * 100) : 0}%
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${stats.totalVisits > 0 ? (stats.desktopUsers / stats.totalVisits) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Vercel Analytics リンク * /}
        <a 
          href="https://vercel.com/kirii/fujimak-maintenance/analytics"
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-5 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8" />
              <div>
                <h3 className="font-bold text-lg">Vercel Analytics</h3>
                <p className="text-gray-300 text-sm">詳細な分析データを表示</p>
              </div>
            </div>
            <ExternalLink className="w-6 h-6" />
          </div>
        </a>

        {/* 最近のアクセスログ * /}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              最近のアクセス
            </h2>
            {visitorLogs.length > 0 && (
              <button
                onClick={clearLogs}
                className="text-sm text-red-500 hover:text-red-700"
              >
                ログを削除
              </button>
            )}
          </div>
          
          {visitorLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>アクセスログがありません</p>
              <p className="text-sm mt-1">訪問者がアクセスすると記録されます</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {visitorLogs.slice(0, 50).map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className={`p-2 rounded-lg ${log.screen_width < 768 ? 'bg-orange-100' : 'bg-blue-100'}`}>
                    {log.screen_width < 768 ? (
                      <Smartphone className="w-4 h-4 text-orange-600" />
                    ) : (
                      <Monitor className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{log.page}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(log.created_at).toLocaleString('ja-JP')}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {log.screen_width}x{log.screen_height} • {log.language}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
*/
