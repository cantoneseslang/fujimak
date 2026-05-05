'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Wrench, History, Bell, HelpCircle, BookOpen, ShoppingCart, UserCog, RefreshCw, PenSquare } from 'lucide-react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import ChatbotWidget from '@/components/ChatbotWidget'
import { formatAngelPizzaStoreLabel, formatAngelPizzaStoreLine } from '@/lib/angelStores'
import { STORES } from '@/lib/constants'
import { fetchMaintenanceRequests } from '@/lib/maintenance'

const MECHANIC_OPERATION_MODE_KEY = 'mechanic-operation-mode-v1'

export default function DashboardPage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [storeReady, setStoreReady] = useState(false)
  const [operationMode, setOperationMode] = useState<'production' | 'demo'>('production')
  const [isModeConfirmOpen, setIsModeConfirmOpen] = useState(false)
  const [modeMessage, setModeMessage] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [notificationCount, setNotificationCount] = useState(0)
  const [recentRequests, setRecentRequests] = useState<
    { id: string; itemId: string | null; machineLabel: string | null; createdAt: string; status: string }[]
  >([])
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('dashboard')
  const tItems = useTranslations('items')
  const tHistory = useTranslations('history')
  const isLatinLocale = locale === 'en' || locale === 'tl'
  const modeDialogAutoCloseTimerRef = useRef<number | null>(null)
  const safeItemLabel = (itemId: string | null) => {
    if (!itemId) return '-'
    try {
      return tItems(itemId)
    } catch {
      return itemId
    }
  }

  useEffect(() => {
    const storeId = localStorage.getItem('selectedStoreId')
    const savedMode = localStorage.getItem(MECHANIC_OPERATION_MODE_KEY)
    if (savedMode === 'demo' || savedMode === 'production') {
      setOperationMode(savedMode)
    }
    setSelectedStoreId(storeId)
    if (!storeId) {
      setStoreReady(true)
      router.push('/stores')
      return
    }

    const loadCounts = async () => {
      try {
        const requests = await fetchMaintenanceRequests({ storeId, limit: 50 })
        const pending = requests.filter((request) => request.status === 'pending').length
        const pendingNotification = requests.filter(
          (request) => request.schedule_change_status === 'pending'
        ).length
        setPendingCount(pending)
        setNotificationCount(pendingNotification)
        setRecentRequests(
          requests.slice(0, 4).map((request) => ({
            id: request.id,
            itemId: request.item_id,
            machineLabel: request.machine_name ?? request.machine_model,
            createdAt: request.created_at,
            status: request.status,
          }))
        )
      } catch {
        setPendingCount(0)
        setNotificationCount(0)
        setRecentRequests([])
      } finally {
        setStoreReady(true)
      }
    }

    void loadCounts()
  }, [router])

  useEffect(() => {
    return () => {
      if (modeDialogAutoCloseTimerRef.current !== null) {
        window.clearTimeout(modeDialogAutoCloseTimerRef.current)
      }
    }
  }, [])

  const selectedStore = STORES.find((store) => store.id === selectedStoreId) ?? null

  if (!storeReady || !selectedStore) {
    return null
  }

  const primaryStoreName = isLatinLocale
    ? (selectedStore.name_en || selectedStore.name)
    : (selectedStore.name_zh || selectedStore.name)
  const secondaryStoreName = isLatinLocale
    ? (selectedStore.name_zh || selectedStore.name)
    : (selectedStore.name_en || selectedStore.name)
  const fixedQALabel = t('fixedQA')
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
    setModeMessage(
      nextMode === 'demo'
        ? 'Demo mode enabled. Sample job will be used in Mechanic.'
        : 'Production mode enabled. Demo sample is hidden in Mechanic.'
    )
  }

  const quickActions = [
    {
      icon: <Wrench className="w-10 h-10" />,
      label: t('newRequest'),
      href: '/maintenance',
      color: '#111111',
      badge: 0,
    },
    {
      icon: <UserCog className="w-10 h-10" />,
      label: t('mechanic'),
      href: '/mechanic/board',
      color: '#f97316',
      badge: 0,
    },
    {
      icon: (
        <div className="flex h-10 w-10 items-center justify-center">
          <PenSquare
            className="block h-10 w-10"
            style={{ transform: 'scale(0.8)', transformOrigin: 'center' }}
          />
        </div>
      ),
      label: 'Management',
      href: '/management',
      color: '#3b82f6',
      badge: notificationCount,
    },
    {
      icon: (
        <div className="flex h-10 w-10 items-center justify-center">
          <BookOpen
            className="block h-10 w-10"
            style={{ transform: 'scale(0.8)', transformOrigin: 'center' }}
          />
        </div>
      ),
      label: t('operationManual'),
      href: '/manual',
      color: '#10b981',
      badge: 0,
    },
    {
      icon: <HelpCircle className="w-10 h-10" />,
      label: fixedQALabel,
      href: '/troubleshooting',
      color: '#6366f1',
      badge: 0,
    },
    {
      icon: (
        <div className="flex h-10 w-10 items-center justify-center">
          <ShoppingCart
            className="block h-10 w-10"
            style={{ transform: 'scale(0.8)', transformOrigin: 'center' }}
          />
        </div>
      ),
      label: t('partsPurchase'),
      href: '/parts',
      color: '#111111',
      badge: 0,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header onRightButtonTripleClick={openModeConfirmDialog} />
      
      <main className="px-4 py-8">
        {modeMessage ? (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {modeMessage}
          </div>
        ) : null}
        {/* Store Section */}
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 text-center shadow-lg">
          <div className="rounded-t-2xl bg-black/20 px-4 py-7 pb-8 sm:px-6 sm:py-8">
            <h1 className="break-words text-xl font-bold leading-snug text-zinc-50 drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)] sm:text-2xl sm:leading-normal">
              {formatAngelPizzaStoreLine(selectedStore)}
            </h1>
            {secondaryStoreName !== primaryStoreName ? (
              <p className="text-zinc-200/95 text-base mt-1 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
                {secondaryStoreName}
              </p>
            ) : null}
          </div>
          
          <div className="rounded-b-2xl border-t border-zinc-300 bg-white px-4 py-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Bell className="w-6 h-6 text-zinc-800" />
              <span className="text-base font-semibold text-zinc-800">{t('pendingRequests')}:</span>
            </div>
            <span
              className="mx-auto mt-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold"
              style={{ backgroundColor: '#111111', color: '#ffffff' }}
            >
              {pendingCount}
            </span>
          </div>
        </div>

        <div className="h-6"></div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {quickActions.map((action) => (
            <button
              key={action.href}
              onClick={() => router.push(action.href)}
              className="flex flex-col items-center gap-4 py-8 px-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              <div className="relative">
                <div className="p-5 rounded-full text-white" style={{ backgroundColor: action.color }}>
                  {action.icon}
                </div>
                {action.badge > 0 && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {action.badge}
                  </div>
                )}
              </div>
              <span className="text-base font-medium text-gray-700 text-center">
                {action.label}
              </span>
            </button>
          ))}
        </div>

        {/* Store Info Card */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4 text-lg" style={{ marginLeft: '6px' }}>{t('storeInfo')}</h2>
          <div className="space-y-3 text-base text-gray-600">
            <p style={{ marginLeft: '6px' }}><span className="font-medium">{t('address')}:</span> {selectedStore.address}</p>
            <p style={{ marginLeft: '6px' }}><span className="font-medium">{t('phone')}:</span> {selectedStore.phone}</p>
            <p style={{ marginLeft: '6px' }}><span className="font-medium">{t('region')}:</span> {selectedStore.region}</p>
          </div>
          <button 
            onClick={() => router.push('/stores')}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2.5 text-base font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            style={{ marginLeft: '6px' }}
          >
            <RefreshCw className="h-4 w-4" />
            {t('changeStore')}
          </button>
        </div>

        {/* Spacer */}
        <div className="h-6"></div>

        {/* Recent Requests */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4 text-lg" style={{ marginLeft: '6px' }}>{t('recentRequests')}</h2>

          {recentRequests.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t('noRequests')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-lg border border-gray-100 p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {request.machineLabel ?? safeItemLabel(request.itemId)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(request.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs rounded-full px-2 py-1 bg-gray-100 text-gray-700">
                    {request.status === 'pending'
                      ? tHistory('status.pending')
                      : request.status === 'in_progress'
                        ? tHistory('status.in_progress')
                        : request.status === 'completed'
                          ? tHistory('status.completed')
                          : tHistory('status.cancelled')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {isModeConfirmOpen ? (
        <div
          className="fixed inset-0 z-[70] bg-black/45 p-4"
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

      <ChatbotWidget
        storeId={selectedStore.id}
        storeName={formatAngelPizzaStoreLabel(selectedStore)}
        locale={locale}
      />

      <BottomNav />
    </div>
  )
}
