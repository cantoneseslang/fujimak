'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

type Mechanic = {
  id: string
  name: string
  email: string
  login_code?: string | null
}

type MaintenanceRequest = {
  id: string
  store_id: string
  store_name: string
  machine_name: string | null
  machine_serial: string | null
  fault_location: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_date: string | null
  preferred_date: string
}

type MechanicNotification = {
  id: string
  title: string
  body: string
  is_read: boolean
  created_at: string
}

const MECHANIC_PROFILE_KEY = 'mechanic-board-profile-v1'
const REQUESTS_CACHE_KEY = 'mechanic-board-requests-cache-v1'

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export default function MechanicBoardPage() {
  const router = useRouter()
  const tm = useTranslations('mechanic')
  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [mechanicsError, setMechanicsError] = useState<string | null>(null)
  const [selectedMechanicId, setSelectedMechanicId] = useState<string>('')
  const [inputCode, setInputCode] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [notifications, setNotifications] = useState<MechanicNotification[]>([])
  const [loadingBoard, setLoadingBoard] = useState(false)
  const didRestoreMechanicFromStorage = useRef(false)
  const didAutoLoadBoard = useRef(false)

  const selectedMechanic = useMemo(
    () => mechanics.find((mechanic) => mechanic.id === selectedMechanicId) ?? null,
    [mechanics, selectedMechanicId]
  )

  const loadMechanics = useCallback(async () => {
    setMechanicsError(null)
    try {
      const res = await fetch('/api/mechanics?seedDefault=1', { cache: 'no-store' })
      const json = (await res.json()) as { mechanics?: Mechanic[]; error?: string }
      if (!res.ok) throw new Error(json.error || 'Failed to load mechanics')
      setMechanics(Array.isArray(json.mechanics) ? json.mechanics : [])
    } catch (error) {
      setMechanics([])
      setMechanicsError(error instanceof Error ? error.message : 'Failed to load mechanics')
    }
  }, [])

  const loadBoard = useCallback(async (mechanicId: string) => {
    if (!mechanicId) return
    setLoadingBoard(true)
    try {
      const [requestsRes, notificationsRes] = await Promise.all([
        fetch(`/api/mechanics/${encodeURIComponent(mechanicId)}/requests`, { cache: 'no-store' }),
        fetch(`/api/mechanics/${encodeURIComponent(mechanicId)}/notifications`, { cache: 'no-store' }),
      ])
      const requestsJson = (await requestsRes.json()) as { requests?: MaintenanceRequest[]; error?: string }
      const notificationsJson = (await notificationsRes.json()) as {
        notifications?: MechanicNotification[]
        error?: string
      }
      if (!requestsRes.ok) throw new Error(requestsJson.error || 'Failed to load assigned requests')
      if (!notificationsRes.ok) throw new Error(notificationsJson.error || 'Failed to load notifications')
      const nextRequests = Array.isArray(requestsJson.requests) ? requestsJson.requests : []
      setRequests(nextRequests)
      localStorage.setItem(REQUESTS_CACHE_KEY, JSON.stringify(nextRequests))
      setNotifications(Array.isArray(notificationsJson.notifications) ? notificationsJson.notifications : [])
    } catch (error) {
      setNotifications([])
      setLoginError(error instanceof Error ? error.message : 'Failed to load board')
    } finally {
      setLoadingBoard(false)
    }
  }, [])

  useEffect(() => {
    void loadMechanics()
  }, [loadMechanics])

  /** Restore saved mechanic only after the server list is loaded — stale UUIDs cause empty boards forever */
  useEffect(() => {
    if (mechanics.length === 0 || didRestoreMechanicFromStorage.current) return
    didRestoreMechanicFromStorage.current = true
    const raw = localStorage.getItem(MECHANIC_PROFILE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as { mechanicId?: unknown }
      const savedId = asText(parsed.mechanicId)
      if (!savedId) return
      const exists = mechanics.some((m) => m.id === savedId)
      if (exists) {
        setSelectedMechanicId(savedId)
      } else {
        localStorage.removeItem(MECHANIC_PROFILE_KEY)
        setSelectedMechanicId(mechanics[0]?.id ?? '')
        setLoginError('Saved mechanic profile was reset. Continue with the default mechanic or switch account.')
      }
    } catch {
      localStorage.removeItem(MECHANIC_PROFILE_KEY)
      setSelectedMechanicId(mechanics[0]?.id ?? '')
    }
  }, [mechanics])

  useEffect(() => {
    if (selectedMechanicId || mechanics.length === 0) return
    setSelectedMechanicId(mechanics[0]?.id ?? '')
  }, [mechanics, selectedMechanicId])

  useEffect(() => {
    const raw = localStorage.getItem(REQUESTS_CACHE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed) && parsed.length > 0) {
        setRequests(parsed as MaintenanceRequest[])
      }
    } catch {
      localStorage.removeItem(REQUESTS_CACHE_KEY)
    }
  }, [])

  useEffect(() => {
    if (!selectedMechanicId || didAutoLoadBoard.current) return
    didAutoLoadBoard.current = true
    void loadBoard(selectedMechanicId)
  }, [loadBoard, selectedMechanicId])

  const handleEnterBoard = () => {
    setLoginError(null)
    const effectiveMechanic = selectedMechanic ?? mechanics[0] ?? null
    if (!effectiveMechanic) {
      setLoginError('Please choose a mechanic account.')
      return
    }
    if (!selectedMechanicId) {
      setSelectedMechanicId(effectiveMechanic.id)
    }
    const expectedCode = asText(effectiveMechanic.login_code)
    if (expectedCode && expectedCode !== inputCode.trim()) {
      setLoginError('Invalid login code.')
      return
    }
    localStorage.setItem(
      MECHANIC_PROFILE_KEY,
      JSON.stringify({
        mechanicId: effectiveMechanic.id,
        mechanicName: effectiveMechanic.name,
        mechanicEmail: effectiveMechanic.email,
      })
    )
    void loadBoard(effectiveMechanic.id)
  }

  const openWorkScreen = (request: MaintenanceRequest) => {
    localStorage.setItem('selectedStoreId', request.store_id)
    router.push(`/mechanic?requestId=${encodeURIComponent(request.id)}`)
  }

  const markNotificationRead = async (notificationId: string) => {
    if (!selectedMechanicId) return
    try {
      await fetch(`/api/mechanics/${encodeURIComponent(selectedMechanicId)}/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, markRead: true }),
      })
      setNotifications((prev) =>
        prev.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item))
      )
    } catch {
      // best effort
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showBack backHref="/dashboard" title={tm('boardTitle')} />

      <main className="px-4 py-5 sm:px-4 sm:py-6" style={{ paddingBottom: '300px' }}>
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            Login and check your assigned schedule, then open the work screen.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px_auto]">
            <select
              value={selectedMechanicId}
              onChange={(event) => setSelectedMechanicId(event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-800"
              style={{ minHeight: '44px' }}
            >
              <option value="">Select mechanic</option>
              {mechanics.map((mechanic) => (
                <option key={mechanic.id} value={mechanic.id}>
                  {mechanic.name} ({mechanic.email})
                </option>
              ))}
            </select>
            <input
              value={inputCode}
              onChange={(event) => setInputCode(event.target.value)}
              placeholder="Login code (optional)"
              className="rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-800"
              style={{ minHeight: '44px' }}
            />
            <button
              type="button"
              onClick={handleEnterBoard}
              className="rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white"
              style={{ minHeight: '44px' }}
            >
              Enter
            </button>
          </div>
          {mechanicsError ? <p className="mt-2 text-xs text-red-600">{mechanicsError}</p> : null}
          {loginError ? <p className="mt-2 text-xs text-red-600">{loginError}</p> : null}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Assigned Jobs</h2>
            <button
              type="button"
              onClick={() => selectedMechanicId && void loadBoard(selectedMechanicId)}
              className="rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-700"
              style={{ minHeight: '36px' }}
            >
              Refresh
            </button>
          </div>
          {loadingBoard ? <p className="text-sm text-gray-500">Loading...</p> : null}
          {!loadingBoard && requests.length === 0 ? (
            <p className="text-sm text-gray-500">No assigned jobs.</p>
          ) : !loadingBoard ? (
            <div className="space-y-2">
              {requests.map((request) => (
                <div key={request.id} className="rounded-lg border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-gray-900">{request.store_name}</p>
                  <p className="text-xs text-gray-600">
                    {request.machine_name || '-'} / {request.machine_serial || '-'}
                  </p>
                  <p className="text-xs text-gray-600">{request.fault_location || '-'}</p>
                  <p className="text-xs text-gray-500">
                    {request.scheduled_date || request.preferred_date || '-'} / {request.status}
                  </p>
                  <button
                    type="button"
                    onClick={() => openWorkScreen(request)}
                    className="mt-2 rounded-md bg-blue-600 px-4 py-3 text-xs font-semibold text-white"
                    style={{ minHeight: '32px' }}
                  >
                    Open Work Screen
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Notifications</h2>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500">No notifications.</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => void markNotificationRead(item.id)}
                  className={`w-full rounded-lg border p-3 text-left ${
                    item.is_read ? 'border-gray-200 bg-white' : 'border-blue-200 bg-blue-50'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-600">{item.body}</p>
                  <p className="mt-1 text-[11px] text-gray-500">{new Date(item.created_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
      </main>

      <BottomNav />
    </div>
  )
}
