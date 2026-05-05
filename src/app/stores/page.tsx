'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MapPin, Phone, ChevronRight } from 'lucide-react'
import Header from '@/components/Header'
import { formatAngelPizzaStoreLabel, formatAngelPizzaStoreLine } from '@/lib/angelStores'
import { STORES } from '@/lib/constants'

export default function StoreSelectPage() {
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSelecting, setIsSelecting] = useState(false)
  const [storeLimit, setStoreLimit] = useState(10)
  const [enabledStoreIds, setEnabledStoreIds] = useState<string[]>(
    STORES.slice(0, 10).map((store) => store.id)
  )
  const selectingRef = useRef(false)
  const tabsScrollRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()
  const t = useTranslations('storeSelect')

  useEffect(() => {
    if (tabsScrollRef.current) {
      tabsScrollRef.current.scrollLeft = 0
    }
  }, [])

  useEffect(() => {
    const loadStoreAccess = async () => {
      try {
        const res = await fetch('/api/settings/store-access', { cache: 'no-store' })
        const json = (await res.json()) as { limit?: number; enabledStoreIds?: string[] }
        if (!res.ok) return
        const limit = Number.isFinite(json.limit) && (json.limit as number) > 0 ? Number(json.limit) : 10
        const ids = Array.isArray(json.enabledStoreIds)
          ? json.enabledStoreIds
          : STORES.slice(0, limit).map((store) => store.id)
        setStoreLimit(limit)
        setEnabledStoreIds(ids)
      } catch {
        // Keep default top-10 configuration.
      }
    }
    void loadStoreAccess()
  }, [])

  const regions: { id: string; label: string }[] = useMemo(() => {
    const uniqueRegions = Array.from(new Set(STORES.map((store) => store.region))).sort()
    return [{ id: 'all', label: t('allRegions') }, ...uniqueRegions.map((region) => ({ id: region, label: region }))]
  }, [t])
  const allRegion = regions[0]
  const specificRegions = regions.slice(1)

  const filteredStores = useMemo(() => {
    return STORES.filter((store) => {
      const matchesRegion = selectedRegion === 'all' || store.region === selectedRegion
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        searchQuery === '' ||
        store.name.toLowerCase().includes(q) ||
        store.name_en.toLowerCase().includes(q) ||
        store.name_zh.toLowerCase().includes(q) ||
        store.id.includes(searchQuery.trim()) ||
        formatAngelPizzaStoreLabel(store).toLowerCase().includes(q) ||
        formatAngelPizzaStoreLine(store).toLowerCase().includes(q)
      return matchesRegion && matchesSearch
    })
  }, [selectedRegion, searchQuery])

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

  const handleStoreSelect = async (storeId: string) => {
    if (!enabledStoreIds.includes(storeId)) return
    // 連打・二重発火ガード（同時複数送信を防止）
    if (selectingRef.current) return
    selectingRef.current = true
    setIsSelecting(true)

    localStorage.setItem('selectedStoreId', storeId)
    
    // 店舗選択通知を送信
    const store = STORES.find(s => s.id === storeId)
    try {
      await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'store_select',
          storeName: store ? formatAngelPizzaStoreLabel(store) : '',
          deviceInfo: getDeviceInfo()
        })
      })
    } catch (err) {
      console.error('Failed to send notification:', err)
    }
    
    router.push('/dashboard')
  }

  return (
    <div className="h-[100dvh] bg-gray-50 flex flex-col overflow-hidden">
      <Header showMenu title={t('title')} />
      
      <main className="flex-1 overflow-y-auto scrollbar-hide pb-6">
        {/* Search Bar */}
        <div className="px-4 py-4 bg-white border-b border-gray-100">
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-4 text-lg bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
            style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
          />
        </div>

        {/* Region Tabs */}
        <div className="px-4 py-4 bg-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button
              key={allRegion.id}
              onClick={() => setSelectedRegion(allRegion.id)}
              style={{
                minWidth: '128px',
                minHeight: '48px',
                padding: '12px 20px',
                backgroundColor: selectedRegion === allRegion.id ? '#18181b' : '#f3f4f6',
                color: selectedRegion === allRegion.id ? '#ffffff' : '#4b5563',
                border: selectedRegion === allRegion.id ? '1px solid #18181b' : '1px solid #e5e7eb',
              }}
              className="shrink-0 inline-flex items-center justify-center rounded-full text-base font-medium whitespace-nowrap transition-colors"
            >
              {allRegion.label}
            </button>

            <div ref={tabsScrollRef} className="overflow-x-auto overflow-y-hidden scrollbar-hide flex-1 h-12">
              <div className="flex w-max gap-3 h-12">
                {specificRegions.map((region) => (
                  <button
                    key={region.id}
                    onClick={() => setSelectedRegion(region.id)}
                    style={{
                      minWidth: '140px',
                      minHeight: '48px',
                      padding: '12px 24px',
                      backgroundColor: selectedRegion === region.id ? '#18181b' : '#f3f4f6',
                      color: selectedRegion === region.id ? '#ffffff' : '#4b5563',
                      border: selectedRegion === region.id ? '1px solid #18181b' : '1px solid #e5e7eb',
                    }}
                    className="inline-flex items-center justify-center rounded-full text-center text-base font-medium whitespace-nowrap transition-colors h-12"
                  >
                    {region.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Store List */}
        <div className="px-4 py-4">
          <div className="space-y-4">
            {filteredStores.map((store) => (
              (() => {
                const isEnabled = enabledStoreIds.includes(store.id)
                return (
              <button
                key={store.id}
                onClick={() => handleStoreSelect(store.id)}
                disabled={isSelecting || !isEnabled}
                aria-disabled={isSelecting || !isEnabled}
                className={`w-full rounded-xl py-5 px-5 shadow-sm transition-all text-left group ${
                  isSelecting || !isEnabled
                    ? 'bg-gray-100 opacity-70 cursor-not-allowed'
                    : 'bg-white hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1" style={{ marginLeft: '6px' }}>
                    <h3
                      className={`font-semibold text-lg transition-colors ${
                        isEnabled ? 'text-gray-800 group-hover:text-zinc-900' : 'text-gray-500'
                      }`}
                    >
                      {formatAngelPizzaStoreLine(store)}
                    </h3>
                    <p className={`text-base mt-1 ${isEnabled ? 'text-gray-500' : 'text-gray-400'}`}>
                      {store.name_zh}
                    </p>
                    {store.name_en !== store.name_zh ? (
                      <p className={`text-base mt-0.5 ${isEnabled ? 'text-gray-500' : 'text-gray-400'}`}>
                        {store.name_en}
                      </p>
                    ) : null}
                    
                    <div
                      className={`flex items-center gap-2 mt-3 text-base ${
                        isEnabled ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    >
                      <MapPin className="w-5 h-5" />
                      <span className="line-clamp-1">{store.address}</span>
                    </div>
                    
                    {store.phone ? (
                      <div
                        className={`flex items-center gap-2 mt-2 text-base ${
                          isEnabled ? 'text-gray-500' : 'text-gray-400'
                        }`}
                      >
                        <Phone className="w-5 h-5" />
                        <span>{store.phone}</span>
                      </div>
                    ) : null}
                    {!isEnabled ? (
                      <p className="mt-2 text-xs text-gray-400">
                        This store is locked by current plan (limit: {storeLimit}).
                      </p>
                    ) : null}
                  </div>
                  
                  <div className="flex items-center">
                    <span
                      className={`px-3 py-2 text-sm font-medium rounded-full mr-2 ${
                        isEnabled ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {store.region}
                    </span>
                    <ChevronRight
                      className={`w-6 h-6 transition-colors ${
                        isEnabled ? 'text-gray-400 group-hover:text-zinc-900' : 'text-gray-300'
                      }`}
                    />
                  </div>
                </div>
              </button>
                )
              })()
            ))}
          </div>
          
          {filteredStores.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {t('searchPlaceholder')}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
