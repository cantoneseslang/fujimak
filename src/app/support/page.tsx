'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import ChatbotWidget from '@/components/ChatbotWidget'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { formatAngelPizzaStoreLabel } from '@/lib/angelStores'
import { STORES } from '@/lib/constants'

export default function SupportPage() {
  const router = useRouter()
  const locale = useLocale()
  const tCommon = useTranslations('common')
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [hasReadStorage, setHasReadStorage] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const storeId = localStorage.getItem('selectedStoreId')
      setHasReadStorage(true)
      if (!storeId) {
        router.push('/stores')
        return
      }
      setSelectedStoreId(storeId)
    })
    return () => cancelAnimationFrame(frame)
  }, [router])

  const selectedStore = selectedStoreId
    ? (STORES.find((store) => store.id === selectedStoreId) ?? null)
    : null

  if (!hasReadStorage) {
    return (
      <div className="h-[100dvh] bg-white flex flex-col overflow-hidden">
        <Header />
        <main className="flex flex-1 min-h-0 items-center justify-center overflow-hidden">
          <Loader2 className="h-10 w-10 animate-spin text-zinc-400" aria-hidden />
          <span className="sr-only">{tCommon('loading')}</span>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!selectedStoreId) {
    return (
      <div className="h-[100dvh] bg-white flex flex-col overflow-hidden">
        <Header />
        <main className="flex flex-1 min-h-0 items-center justify-center overflow-hidden">
          <Loader2 className="h-10 w-10 animate-spin text-zinc-400" aria-hidden />
          <span className="sr-only">{tCommon('loading')}</span>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!selectedStore) {
    return (
      <div className="h-[100dvh] bg-white flex flex-col overflow-hidden">
        <Header />
        <main className="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 overflow-hidden px-6">
          <p className="text-center text-sm text-zinc-600">{tCommon('error')}</p>
          <button
            type="button"
            onClick={() => router.push('/stores')}
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-900"
          >
            {tCommon('back')}
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="h-[100dvh] bg-white flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 min-h-0 overflow-hidden">
        <ChatbotWidget
          storeId={selectedStore.id}
          storeName={formatAngelPizzaStoreLabel(selectedStore)}
          locale={locale}
          renderMode="page"
        />
      </main>
      <BottomNav />
    </div>
  )
}

