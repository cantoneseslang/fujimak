'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Clock, CheckCircle, AlertCircle, XCircle, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { fetchMaintenanceRequests, type MaintenanceRequestRecord } from '@/lib/maintenance'

type SupportThread = {
  id: string
  store_id: string | null
  store_name: string | null
  status: 'open' | 'closed'
  urgency: 'urgent' | 'normal' | null
  summary: string | null
  created_at: string
  updated_at: string
}

type SupportMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  meta: Record<string, unknown> | null
  created_at: string
}

type SupportAttachment = {
  url: string
  mimeType: string
  source: 'image' | 'video'
}

export default function HistoryPage() {
  const [filter, setFilter] = useState<string>('all')
  const [requests, setRequests] = useState<MaintenanceRequestRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [supportLoading, setSupportLoading] = useState(true)
  const [supportError, setSupportError] = useState<string | null>(null)
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([])
  const [supportMessagesByThread, setSupportMessagesByThread] = useState<Record<string, SupportMessage[]>>({})
  const [expandedSupportThreadId, setExpandedSupportThreadId] = useState<string | null>(null)
  const [supportMessageLoadingThreadId, setSupportMessageLoadingThreadId] = useState<string | null>(null)
  const t = useTranslations('history')
  const tItems = useTranslations('items')
  const tAreas = useTranslations('areas')
  const safeItemLabel = (itemId: string | null) => {
    if (!itemId) return '-'
    try {
      return tItems(itemId)
    } catch {
      return itemId
    }
  }

  const getSupportAttachments = (meta: Record<string, unknown> | null): SupportAttachment[] => {
    if (!meta || typeof meta !== 'object') return []
    const raw = (meta as { attachments?: unknown }).attachments
    if (!Array.isArray(raw)) return []

    return raw
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const candidate = entry as { url?: unknown; mimeType?: unknown; source?: unknown }
        if (typeof candidate.url !== 'string' || candidate.url.length === 0) return null
        const mimeType = typeof candidate.mimeType === 'string' ? candidate.mimeType : 'application/octet-stream'
        const source: 'image' | 'video' =
          candidate.source === 'video' || mimeType.startsWith('video/') ? 'video' : 'image'

        return {
          url: candidate.url,
          mimeType,
          source,
        } satisfies SupportAttachment
      })
      .filter((v): v is SupportAttachment => v !== null)
  }

  useEffect(() => {
    const id = localStorage.getItem('selectedStoreId')

    if (!id) {
      setRequests([])
      setIsLoading(false)
      setSupportThreads([])
      setSupportLoading(false)
      return
    }

    const loadMaintenance = async () => {
      try {
        const list = await fetchMaintenanceRequests({ storeId: id, limit: 200 })
        setRequests(list)
      } catch (error) {
        console.error('Failed to load maintenance history:', error)
      } finally {
        setIsLoading(false)
      }
    }

    const loadSupportThreads = async () => {
      setSupportLoading(true)
      setSupportError(null)
      try {
        const res = await fetch(`/api/support/threads?status=all&storeId=${encodeURIComponent(id)}`, {
          cache: 'no-store',
        })
        const json = (await res.json()) as { threads?: SupportThread[]; error?: string }
        if (!res.ok) throw new Error(json.error || 'Failed to load support history')
        setSupportThreads(json.threads ?? [])
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to load support history'
        setSupportError(msg)
      } finally {
        setSupportLoading(false)
      }
    }

    void loadMaintenance()
    void loadSupportThreads()
  }, [])

  const loadSupportMessages = async (threadId: string) => {
    setSupportError(null)
    setSupportMessageLoadingThreadId(threadId)
    try {
      const res = await fetch(`/api/support/messages?threadId=${encodeURIComponent(threadId)}`, {
        cache: 'no-store',
      })
      const json = (await res.json()) as { messages?: SupportMessage[]; error?: string }
      if (!res.ok) throw new Error(json.error || 'Failed to load support messages')
      setSupportMessagesByThread((prev) => ({ ...prev, [threadId]: json.messages ?? [] }))
      setExpandedSupportThreadId(threadId)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load support messages'
      setSupportError(msg)
    } finally {
      setSupportMessageLoadingThreadId(null)
    }
  }

  const statusConfig = {
    pending: { 
      icon: <Clock className="w-5 h-5" />, 
      color: 'text-orange-500 bg-orange-50',
      label: t('status.pending')
    },
    in_progress: { 
      icon: <AlertCircle className="w-5 h-5" />, 
      color: 'text-blue-500 bg-blue-50',
      label: t('status.in_progress')
    },
    completed: { 
      icon: <CheckCircle className="w-5 h-5" />, 
      color: 'text-green-500 bg-green-50',
      label: t('status.completed')
    },
    cancelled: { 
      icon: <XCircle className="w-5 h-5" />, 
      color: 'text-gray-500 bg-gray-50',
      label: t('status.cancelled')
    },
  }

  const filters = [
    { id: 'all', label: t('filterAll') },
    { id: 'pending', label: t('status.pending') },
    { id: 'in_progress', label: t('status.in_progress') },
    { id: 'completed', label: t('status.completed') },
  ]

  const filteredRequests = filter === 'all' 
    ? requests 
    : requests.filter(r => r.status === filter)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header showBack title={t('title')} />
      
      {/* Filter Tabs */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 overflow-x-auto">
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-zinc-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <main className="px-4 py-4">
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">
            <Clock className="w-16 h-16 mx-auto mb-4 opacity-50 animate-pulse" />
            <p>{t('filterAll')}...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>{t('noHistory')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request) => {
              const status = statusConfig[request.status]
              return (
                <div 
                  key={request.id}
                  className="bg-white rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-800">
                        {request.machine_name ??
                          request.machine_model ??
                          safeItemLabel(request.item_id)}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {request.fault_location ??
                          (request.category_id ? tAreas(request.category_id) : '-')}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm ${status.color}`}>
                      {status.icon}
                      <span>{status.label}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{new Date(request.created_at).toLocaleString()}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      request.urgency === 'urgent' ? 'bg-red-100 text-red-600' :
                      request.urgency === 'normal' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {request.urgency === 'urgent' ? '急ぎ' : 
                       request.urgency === 'normal' ? '普通' : '見積もり'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <section className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-gray-700" />
              <h2 className="text-sm font-semibold text-gray-800">{t('supportSectionTitle')}</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">{t('supportTapToOpen')}</p>
          </div>

          {supportLoading ? (
            <div className="px-4 py-6 text-sm text-gray-500">{t('supportLoading')}</div>
          ) : supportError ? (
            <div className="px-4 py-6 text-sm text-red-600">
              {t('supportLoadFailed')}: {supportError}
            </div>
          ) : supportThreads.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">{t('supportNoHistory')}</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {supportThreads.map((thread) => {
                const isExpanded = expandedSupportThreadId === thread.id
                const supportMessages = supportMessagesByThread[thread.id] ?? []
                const isMessageLoading = supportMessageLoadingThreadId === thread.id
                return (
                  <div key={thread.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (isExpanded) {
                          setExpandedSupportThreadId(null)
                          return
                        }
                        if (supportMessagesByThread[thread.id]) {
                          setExpandedSupportThreadId(thread.id)
                          return
                        }
                        void loadSupportMessages(thread.id)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{t('supportRequestTitle')}</p>
                          <p className="text-xs text-gray-600 truncate">{thread.summary || t('supportNoSummary')}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(thread.updated_at || thread.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-1 rounded-full text-[11px] font-medium ${
                              thread.status === 'closed' ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {thread.status === 'closed' ? t('supportClosed') : t('supportOpen')}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4">
                        <h3 className="text-xs font-semibold text-gray-600 mb-2">{t('supportConversation')}</h3>
                        {isMessageLoading ? (
                          <p className="text-xs text-gray-500">{t('supportLoading')}</p>
                        ) : supportMessages.length === 0 ? (
                          <p className="text-xs text-gray-500">{t('supportNoMessages')}</p>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto rounded-lg bg-gray-50 p-3">
                            {supportMessages.map((message) => {
                              const attachments = getSupportAttachments(message.meta)
                              return (
                                <div
                                  key={message.id}
                                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`max-w-[88%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                                      message.role === 'user'
                                        ? 'bg-zinc-900 text-white'
                                        : 'bg-white border border-gray-200 text-gray-800'
                                    }`}
                                  >
                                    {message.content}
                                    {attachments.length > 0 && (
                                      <div className="mt-2 space-y-2">
                                        {attachments.map((att) => (
                                          <div key={`${message.id}_${att.url}`} className="rounded-md overflow-hidden border border-gray-200 bg-white">
                                            {att.source === 'video' ? (
                                              <video src={att.url} controls playsInline preload="metadata" className="w-full max-h-56 bg-black" />
                                            ) : (
                                              // eslint-disable-next-line @next/next/no-img-element
                                              <img src={att.url} alt="support attachment" className="w-full max-h-56 object-contain bg-white" />
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
