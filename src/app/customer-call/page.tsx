'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PhoneCall, Send } from 'lucide-react'
import Header from '@/components/Header'
import { formatAngelPizzaStoreLabel } from '@/lib/angelStores'
import {
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_ITEMS,
  STORES,
  URGENCY_LEVELS,
} from '@/lib/constants'
import { createMaintenanceRequest } from '@/lib/maintenance'
import { useInvalidateMaintenanceLists } from '@/hooks/useMaintenanceRequests'
import { getStoreMachines } from '@/lib/storeMachines'

export default function CustomerCallPage() {
  const router = useRouter()
  const invalidateMaintenance = useInvalidateMaintenanceLists()
  const searchParams = useSearchParams()

  const initialSummary = useMemo(
    () => searchParams.get('summary') || '',
    [searchParams]
  )

  const [callerName, setCallerName] = useState('')
  const [phone, setPhone] = useState('')
  const [summary, setSummary] = useState(initialSummary)
  const [categoryId, setCategoryId] = useState('kitchen')
  const [itemId, setItemId] = useState('hoshizaki')
  const [urgency, setUrgency] = useState<'urgent' | 'normal' | 'estimate'>('normal')
  const [preferredDate, setPreferredDate] = useState(() =>
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedStore, setSelectedStore] = useState<(typeof STORES)[0] | null>(null)

  useEffect(() => {
    const storeId = localStorage.getItem('selectedStoreId')
    setSelectedStore(STORES.find((store) => store.id === storeId) ?? STORES[0] ?? null)
  }, [])

  const itemOptions = MAINTENANCE_ITEMS[categoryId as keyof typeof MAINTENANCE_ITEMS] || []

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedStore) return
    setIsSubmitting(true)
    try {
      const defaultStoreMachine = getStoreMachines(selectedStore.id)[0]
      const machine = defaultStoreMachine?.machine
      const createdRequest = await createMaintenanceRequest({
        storeId: selectedStore.id,
        storeName: formatAngelPizzaStoreLabel(selectedStore),
        categoryId,
        itemId,
        machineId: machine?.id ?? 'customer-call-machine',
        machineName: machine?.displayName ?? 'Customer Call Device',
        machineModel: machine?.modelCode,
        machineSerial: defaultStoreMachine?.machineSerial ?? 'UNKNOWN',
        faultLocation: itemId,
        symptom: summary,
        urgency,
        remarks: summary,
        preferredDate,
        preferredStartTime: '09:00',
        preferredEndTime: '12:00',
        source: 'customer_call',
        requestedBy: callerName || 'Customer',
        requestedPhone: phone || undefined,
        troubleshootingSummary: initialSummary || undefined,
        vendorName: 'Fujimak Service Desk',
      })

      invalidateMaintenance()

      await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'maintenance',
          storeName: formatAngelPizzaStoreLabel(selectedStore),
          requestId: createdRequest.id,
          machineName: createdRequest.machine_name,
          machineModel: createdRequest.machine_model,
          machineSerial: createdRequest.machine_serial,
          faultLocation: createdRequest.fault_location,
          symptom: createdRequest.symptom,
          urgency: createdRequest.urgency,
          preferredDate: createdRequest.preferred_date,
          preferredStartTime: createdRequest.preferred_start_time,
          preferredEndTime: createdRequest.preferred_end_time,
          recipientMode: 'settings',
          deviceInfo: {
            device: navigator.userAgent,
            screenSize: `${window.screen.width} x ${window.screen.height}`,
            language: navigator.language,
          },
        }),
      })

      alert('呼び出し依頼を送信しました。')
      router.push('/dashboard')
    } catch (error) {
      console.error('Failed to submit customer call:', error)
      alert('送信に失敗しました。時間をおいて再試行してください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <Header showBack title="顧客呼び出し" />

      <main className="px-4 py-6">
        <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-2">
            <PhoneCall className="w-5 h-5 text-zinc-900" />
            <h2 className="font-semibold text-gray-800">Fujimak Customer Call</h2>
          </div>
          <p className="text-sm text-gray-500">
            顧客からの依頼を保守ワークフローへ登録します。送信後は管理画面に即時反映されます。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">顧客名</label>
            <input
              value={callerName}
              onChange={(event) => setCallerName(event.target.value)}
              placeholder="例: Fujimak 担当者"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">連絡先電話番号</label>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="例: 090-1234-5678"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">カテゴリ</label>
            <select
              value={categoryId}
              onChange={(event) => {
                const nextCategory = event.target.value
                setCategoryId(nextCategory)
                const firstItem = MAINTENANCE_ITEMS[nextCategory as keyof typeof MAINTENANCE_ITEMS]?.[0]
                if (firstItem) setItemId(firstItem.id)
              }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5"
            >
              {MAINTENANCE_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name_ja}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">項目</label>
            <select
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5"
            >
              {itemOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name_ja}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">緊急度</label>
            <div className="grid grid-cols-3 gap-2">
              {URGENCY_LEVELS.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => setUrgency(level.id as 'urgent' | 'normal' | 'estimate')}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    urgency === level.id ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {level.name_ja}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">希望日</label>
            <input
              type="date"
              value={preferredDate}
              onChange={(event) => setPreferredDate(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">症状・要望</label>
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={4}
              placeholder="顧客から聞いた内容を記録してください"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 resize-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-zinc-900 text-white py-3.5 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
            {isSubmitting ? '送信中...' : '呼び出し依頼を送信'}
          </button>
        </form>
      </main>
    </div>
  )
}
