'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import ChatbotWidget from '@/components/ChatbotWidget'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { formatAngelPizzaStoreLabel } from '@/lib/angelStores'
import { STORES } from '@/lib/constants'

export default function SupportPage() {
  const router = useRouter()
  const locale = useLocale()
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)

  useEffect(() => {
    const storeId = localStorage.getItem('selectedStoreId')
    if (!storeId) {
      router.push('/stores')
      return
    }
    setSelectedStoreId(storeId)
  }, [router])

  const selectedStore = selectedStoreId
    ? (STORES.find((store) => store.id === selectedStoreId) ?? null)
    : null

  if (!selectedStore) return null

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

