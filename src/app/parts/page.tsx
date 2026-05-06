'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Minus, Plus, ShoppingCart, Loader2 } from 'lucide-react'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { formatAngelPizzaStoreLabel } from '@/lib/angelStores'
import { STORES } from '@/lib/constants'
import { PARTS_CATALOG } from '@/lib/partsCatalog'
import { getStoreMachines } from '@/lib/storeMachines'
import {
  PARTS_ORDER_DRAFT_KEY,
  type PartsOrderDraft,
  calculateOrderTotals,
} from '@/lib/partsOrder'

export default function PartsPage() {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [hasReadStorage, setHasReadStorage] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [currency, setCurrency] = useState('PHP')
  const [feedback, setFeedback] = useState<{ type: 'error'; message: string } | null>(null)
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null)
  const [recommendedOnly, setRecommendedOnly] = useState(false)
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('parts')
  const tCommon = useTranslations('common')

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setSelectedStoreId(localStorage.getItem('selectedStoreId'))
      setHasReadStorage(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const selectedStore = useMemo(
    () => STORES.find((store) => store.id === selectedStoreId) ?? null,
    [selectedStoreId]
  )
  const storeMachines = useMemo(
    () => (selectedStore ? getStoreMachines(selectedStore.id) : []),
    [selectedStore]
  )
  const effectiveMachineId = selectedMachineId ?? storeMachines[0]?.machineId ?? null
  const selectedMachineEntry = useMemo(
    () => storeMachines.find((entry) => entry.machineId === effectiveMachineId) ?? null,
    [effectiveMachineId, storeMachines]
  )
  const selectedMachine = selectedMachineEntry?.machine ?? null
  const recommendedPartIds = useMemo(
    () => new Set(selectedMachine?.recommendedPartIds ?? []),
    [selectedMachine]
  )
  const visibleParts = useMemo(() => {
    const source =
      recommendedOnly && recommendedPartIds.size > 0
        ? PARTS_CATALOG.filter((item) => recommendedPartIds.has(item.id))
        : PARTS_CATALOG
    return [...source].sort((a, b) => Number(recommendedPartIds.has(b.id)) - Number(recommendedPartIds.has(a.id)))
  }, [recommendedOnly, recommendedPartIds])

  useEffect(() => {
    if (!hasReadStorage) return
    if (!selectedStoreId) {
      router.push('/stores')
    }
  }, [hasReadStorage, router, selectedStoreId])

  const selectedItems = useMemo(
    () =>
      PARTS_CATALOG.filter((item) => (quantities[item.id] ?? 0) > 0).map((item) => ({
        id: item.id,
        name: item.name,
        specs: item.specs,
        quantity: quantities[item.id] ?? 0,
        unitPrice: Number(unitPrices[item.id] ?? item.defaultUnitPrice ?? 0),
        imageId: item.imageId,
      })),
    [quantities, unitPrices]
  )

  const { totalUnits, totalAmount } = useMemo(() => calculateOrderTotals(selectedItems), [selectedItems])

  const updateQuantity = (partId: string, nextValue: number) => {
    setFeedback(null)
    setQuantities((prev) => {
      const value = Math.max(0, Math.min(999, nextValue))
      if (value === 0) {
        const cloned = { ...prev }
        delete cloned[partId]
        return cloned
      }
      return { ...prev, [partId]: value }
    })
  }

  const updateUnitPrice = (partId: string, raw: string) => {
    setFeedback(null)
    const trimmed = raw.trim()
    if (trimmed === '' || trimmed === '.') {
      setUnitPrices((prev) => {
        const next = { ...prev }
        delete next[partId]
        return next
      })
      return
    }
    const num = Number(trimmed)
    if (Number.isNaN(num)) return
    setUnitPrices((prev) => ({ ...prev, [partId]: Math.max(0, num) }))
  }

  const handleCreateOrderSheet = () => {
    if (!selectedStore) return
    if (selectedItems.length === 0) {
      setFeedback({ type: 'error', message: t('selectAtLeastOne') })
      return
    }
    if (selectedItems.some((item) => item.unitPrice <= 0)) {
      setFeedback({ type: 'error', message: t('priceRequired') })
      return
    }

    const draft: PartsOrderDraft = {
      storeId: selectedStore.id,
      storeName: formatAngelPizzaStoreLabel(selectedStore),
      locale,
      notes,
      recipient: 'Fujimak',
      currency,
      createdAt: new Date().toISOString(),
      machineId: selectedMachine?.id,
      machineName: selectedMachine?.displayName,
      machineModel: selectedMachine?.modelCode,
      machineSerial: selectedMachineEntry?.machineSerial,
      items: selectedItems,
    }
    localStorage.setItem(PARTS_ORDER_DRAFT_KEY, JSON.stringify(draft))
    router.push('/parts/confirm')
  }

  if (!hasReadStorage || !selectedStoreId) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title={t('title')} />
        <main className="flex flex-col items-center justify-center px-4 pt-16 pb-8">
          <Loader2 className="h-10 w-10 animate-spin text-zinc-400" aria-hidden />
          <span className="sr-only">{tCommon('loading')}</span>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!selectedStore) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Header title={t('title')} />
        <main className="flex flex-col items-center px-4 pt-16 pb-8">
          <p className="text-center text-sm text-zinc-600">{tCommon('error')}</p>
          <button
            type="button"
            onClick={() => router.push('/stores')}
            className="mt-6 rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-900"
          >
            {tCommon('back')}
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  const formattedTotal = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(totalAmount)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title={t('title')} />

      <main className="space-y-4 px-4 py-6 pb-24">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500" style={{ marginLeft: '6px' }}>{t('selectedStore')}</p>
          <p className="text-lg font-semibold text-zinc-900" style={{ marginLeft: '6px' }}>
            {formatAngelPizzaStoreLabel(selectedStore)} ({selectedStore.id})
          </p>
          {selectedStore.name_en !== selectedStore.name_zh ? (
            <p className="text-sm text-zinc-500" style={{ marginLeft: '6px' }}>{selectedStore.name_en}</p>
          ) : null}
          <p className="mt-2 text-sm text-zinc-600" style={{ marginLeft: '6px' }}>
            {t('fromStore')}:{' '}
            <span className="font-semibold text-zinc-900">
              {formatAngelPizzaStoreLabel(selectedStore)} ({selectedStore.id})
            </span>
          </p>
          <p className="text-sm text-zinc-600" style={{ marginLeft: '6px' }}>
            {t('toRecipient')}: <span className="font-semibold text-zinc-900">Fujimak</span>
          </p>

          <div className="mt-4 border-t border-zinc-200 pt-3">
            <p className="text-sm font-semibold text-zinc-800" style={{ marginLeft: '6px' }}>{t('machineLinkageTitle')}</p>
            <label className="mt-2 block text-sm text-zinc-600" style={{ marginLeft: '6px' }}>{t('selectedMachine')}</label>
            <select
              value={effectiveMachineId ?? ''}
              onChange={(event) => setSelectedMachineId(event.target.value || null)}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
              style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
            >
              {storeMachines.map((entry) => (
                <option key={`${entry.machineId}-${entry.machineSerial}`} value={entry.machineId}>
                  {(entry.machine?.displayName ?? entry.machineId) + ` / ${entry.machineSerial}`}
                </option>
              ))}
            </select>
            {selectedMachine ? (
              <p className="mt-2 text-xs text-zinc-500" style={{ marginLeft: '6px' }}>
                {t('machineModel')}: {selectedMachine.modelCode} / {t('machineSerial')}:{' '}
                {selectedMachineEntry?.machineSerial ?? '-'}
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRecommendedOnly(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  !recommendedOnly ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                {t('filterAllParts')}
              </button>
              <button
                type="button"
                onClick={() => setRecommendedOnly(true)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  recommendedOnly ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                {t('filterRecommended')}
              </button>
            </div>
          </div>
        </div>

        {visibleParts.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">
            {t('noRecommendedParts')}
          </div>
        ) : null}

        {visibleParts.map((item) => {
          const quantity = quantities[item.id] ?? 0
          const unitPriceStored = unitPrices[item.id]
          const unitPriceInputValue =
            unitPriceStored === undefined || unitPriceStored === 0 ? '' : unitPriceStored
          const isRecommended = recommendedPartIds.has(item.id)
          return (
            <section key={item.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                <Image
                  src={`/api/parts-image/${item.imageId}?v=2`}
                  alt={item.name}
                  width={732}
                  height={384}
                  sizes="(max-width: 768px) 100vw, 732px"
                  unoptimized
                  className="h-44 w-full object-contain"
                />
              </div>

              <div className="mt-3 flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold text-zinc-900" style={{ marginLeft: '6px' }}>{item.name}</h2>
                {isRecommended ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                    {t('recommendedBadge')}
                  </span>
                ) : null}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-zinc-600" style={{ marginLeft: '6px' }}>
                {item.specs.map((spec, idx) => (
                  <li key={`${item.id}-${idx}`}>- {spec}</li>
                ))}
              </ul>

              <div
                className="mt-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
                style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
              >
                <span className="text-sm font-medium text-zinc-700">{t('quantity')}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, quantity - 1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700"
                    aria-label={`decrease ${item.name}`}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-8 text-center text-base font-semibold text-zinc-900">{quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, quantity + 1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-700"
                    aria-label={`increase ${item.name}`}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div
                className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
              >
                <label className="mb-1 block text-sm font-medium text-zinc-700">{t('unitPrice')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitPriceInputValue}
                  onChange={(e) => updateUnitPrice(item.id, e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                />
              </div>
            </section>
          )
        })}

        <section className="mb-20 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-zinc-900" style={{ marginLeft: '6px' }}>{t('orderSummary')}</h3>
          <p className="mt-1 text-sm text-zinc-600" style={{ marginLeft: '6px' }}>
            {t('itemsSelected')}: <span className="font-semibold text-zinc-900">{selectedItems.length}</span> /{' '}
            {t('totalUnits')}: <span className="font-semibold text-zinc-900">{totalUnits}</span>
          </p>
          <p className="mt-1 text-sm text-zinc-600" style={{ marginLeft: '6px' }}>
            {t('totalAmount')}: <span className="font-semibold text-zinc-900">{formattedTotal}</span>
          </p>

          <label className="mt-3 block text-sm font-medium text-zinc-700" style={{ marginLeft: '6px' }}>{t('currency')}</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
            style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
          >
            <option value="PHP">PHP</option>
            <option value="JPY">JPY</option>
            <option value="HKD">HKD</option>
            <option value="USD">USD</option>
          </select>

          <button
            type="button"
            onClick={handleCreateOrderSheet}
            className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm"
            style={{ backgroundColor: '#18181b', color: '#ffffff' }}
          >
            <ShoppingCart className="h-4 w-4 shrink-0 text-white" />
            {t('createOrderSheet')}
          </button>

          <label className="mt-3 block text-sm font-medium text-zinc-700" style={{ marginLeft: '6px' }}>{t('notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 h-24 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
            placeholder={t('notesPlaceholder')}
            style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
          />

          {feedback ? (
            <p
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {feedback.message}
            </p>
          ) : null}
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
