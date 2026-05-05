'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { 
  Building2, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Calendar,
  MapPin,
  Phone,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Wrench,
  DollarSign,
  TrendingUp
} from 'lucide-react'
import Header from '@/components/Header'
import { STORES, DEFAULT_VENDORS, MAINTENANCE_ITEMS, MAINTENANCE_CATEGORIES } from '@/lib/constants'
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'

type MaintenanceStatus = 'pending' | 'accepted' | 'in_progress' | 'completed'

interface MaintenanceRequest {
  id: string
  storeId: string
  storeName: string
  storeNameEn: string
  address: string
  phone: string
  category: string
  item: string
  itemId: string
  urgency: string
  remarks: string
  requestDate: Date
  preferredDate: Date
  preferredTimeStart: string
  preferredTimeEnd: string
  status: MaintenanceStatus
  vendorId: string
  completedDate?: Date
  cost?: number
}

// デモデータ - itemIdは既存の翻訳キーを使用
const DEMO_REQUESTS: MaintenanceRequest[] = [
  {
    id: '1',
    storeId: 'sha-tin-centre',
    storeName: '沙田中心店',
    storeNameEn: 'Sha Tin Centre',
    address: '新界沙田橫壆街2-16號沙田中心3樓32A及69A號舖',
    phone: '23100388',
    category: 'kitchen',
    item: 'sushi-lane',
    itemId: 'sushi-lane',
    urgency: 'urgent',
    remarks: '',
    requestDate: new Date('2026-01-10'),
    preferredDate: new Date('2026-01-13'),
    preferredTimeStart: '09:00',
    preferredTimeEnd: '12:00',
    status: 'pending',
    vendorId: 'fujimak'
  },
  {
    id: '2',
    storeId: 'tsuen-wan',
    storeName: '荃灣店',
    storeNameEn: 'Tsuen Wan',
    address: '新界荃灣蕙荃路22-66綠楊坊2樓S20-23號',
    phone: '28966228',
    category: 'electrical',
    item: 'lighting',
    itemId: 'lighting',
    urgency: 'normal',
    remarks: '',
    requestDate: new Date('2026-01-11'),
    preferredDate: new Date('2026-01-15'),
    preferredTimeStart: '14:00',
    preferredTimeEnd: '17:00',
    status: 'accepted',
    vendorId: 'lifesupport'
  },
  {
    id: '3',
    storeId: 'yuen-long',
    storeName: '元朗店',
    storeNameEn: 'Yuen Long',
    address: '新界元朗教育路1號元朗千色匯2樓1號舖',
    phone: '27136388',
    category: 'plumbing',
    item: 'drain-pipe',
    itemId: 'drain-pipe',
    urgency: 'normal',
    remarks: '',
    requestDate: new Date('2026-01-08'),
    preferredDate: new Date('2026-01-12'),
    preferredTimeStart: '10:00',
    preferredTimeEnd: '12:00',
    status: 'in_progress',
    vendorId: 'lifesupport'
  },
  {
    id: '4',
    storeId: 'mong-kok',
    storeName: '旺角店',
    storeNameEn: 'Mong Kok',
    address: '九龍旺角彌敦道628號瓊華中心地庫',
    phone: '26887010',
    category: 'kitchen',
    item: 'showcase-fridge',
    itemId: 'showcase-fridge',
    urgency: 'urgent',
    remarks: '',
    requestDate: new Date('2026-01-05'),
    preferredDate: new Date('2026-01-06'),
    preferredTimeStart: '09:00',
    preferredTimeEnd: '11:00',
    status: 'completed',
    vendorId: 'fujimak',
    completedDate: new Date('2026-01-06'),
    cost: 2500
  },
  {
    id: '5',
    storeId: 'causeway-bay',
    storeName: '銅鑼灣店',
    storeNameEn: 'Causeway Bay',
    address: '銅鑼灣駱克道463-483號銅鑼灣廣場2期3樓3A號舖',
    phone: '23020298',
    category: 'hvac',
    item: 'ac-ventilation',
    itemId: 'ac-ventilation',
    urgency: 'normal',
    remarks: '',
    requestDate: new Date('2026-01-03'),
    preferredDate: new Date('2026-01-05'),
    preferredTimeStart: '13:00',
    preferredTimeEnd: '16:00',
    status: 'completed',
    vendorId: 'lifesupport',
    completedDate: new Date('2026-01-05'),
    cost: 1800
  },
  {
    id: '6',
    storeId: 'tai-po',
    storeName: '大埔店',
    storeNameEn: 'Tai Po',
    address: '大埔安邦路8及10號大埔超級城B區1樓128號舖',
    phone: '26631108',
    category: 'kitchen',
    item: 'fryer',
    itemId: 'fryer',
    urgency: 'quote',
    remarks: '',
    requestDate: new Date('2026-01-02'),
    preferredDate: new Date('2026-01-10'),
    preferredTimeStart: '10:00',
    preferredTimeEnd: '12:00',
    status: 'completed',
    vendorId: 'fujimak',
    completedDate: new Date('2026-01-10'),
    cost: 15000
  }
]

export default function VendorPage() {
  const [selectedVendor, setSelectedVendor] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [requests, setRequests] = useState<MaintenanceRequest[]>(DEMO_REQUESTS)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showBilling, setShowBilling] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const t = useTranslations('vendor')
  const tItems = useTranslations('items')
  const tCommon = useTranslations('common')
  const locale = useLocale()

  // アイテム名を翻訳
  const getItemName = (itemId: string) => {
    try {
      return tItems(itemId)
    } catch {
      return itemId
    }
  }

  // 月名を多言語化
  const getMonthDisplay = (date: Date) => {
    const year = date.getFullYear()
    const monthIndex = date.getMonth()
    const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    const monthName = tCommon(`months.${monthKeys[monthIndex]}`)
    
    if (locale === 'en' || locale === 'tl') {
      return `${monthName} ${year}`
    }
    return `${year}${tCommon('year')} ${monthName}`
  }

  const getStatusColor = (status: MaintenanceStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'accepted': return 'bg-blue-100 text-blue-800'
      case 'in_progress': return 'bg-purple-100 text-purple-800'
      case 'completed': return 'bg-green-100 text-green-800'
    }
  }

  const getStatusLabel = (status: MaintenanceStatus) => {
    switch (status) {
      case 'pending': return t('status.pending')
      case 'accepted': return t('status.accepted')
      case 'in_progress': return t('status.inProgress')
      case 'completed': return t('status.completed')
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return 'bg-red-500'
      case 'normal': return 'bg-blue-500'
      case 'quote': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

  const getUrgencyLabel = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return t('urgency.urgent')
      case 'normal': return t('urgency.normal')
      case 'quote': return t('urgency.quote')
      default: return urgency
    }
  }

  const filteredRequests = requests.filter(req => {
    if (selectedVendor !== 'all' && req.vendorId !== selectedVendor) return false
    if (statusFilter !== 'all' && req.status !== statusFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return req.storeName.toLowerCase().includes(query) || 
             req.storeNameEn.toLowerCase().includes(query) ||
             req.item.toLowerCase().includes(query)
    }
    return true
  })

  const updateStatus = (id: string, newStatus: MaintenanceStatus) => {
    setRequests(prev => prev.map(req => {
      if (req.id === id) {
        return {
          ...req,
          status: newStatus,
          completedDate: newStatus === 'completed' ? new Date() : req.completedDate
        }
      }
      return req
    }))
  }

  const updateCost = (id: string, cost: number) => {
    setRequests(prev => prev.map(req => {
      if (req.id === id) {
        return { ...req, cost }
      }
      return req
    }))
  }

  // 月末集計
  const getMonthlyBilling = (vendorId: string, month: Date) => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    
    return requests.filter(req => {
      if (vendorId !== 'all' && req.vendorId !== vendorId) return false
      if (req.status !== 'completed' || !req.completedDate) return false
      return isWithinInterval(req.completedDate, { start, end })
    })
  }

  const lifesupportBilling = getMonthlyBilling('lifesupport', selectedMonth)
  const fujimakBilling = getMonthlyBilling('fujimak', selectedMonth)

  const totalLifesupport = lifesupportBilling.reduce((sum, req) => sum + (req.cost || 0), 0)
  const totalFujimak = fujimakBilling.reduce((sum, req) => sum + (req.cost || 0), 0)

  // 統計
  const stats = {
    pending: requests.filter(r => r.status === 'pending').length,
    inProgress: requests.filter(r => r.status === 'accepted' || r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
    total: requests.length
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title={t('title')} showBack />
      
      <main className="px-4 py-6 pb-8">
        {/* タブ切り替え */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setShowBilling(false)}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              !showBilling ? 'bg-zinc-900 text-white' : 'bg-white text-gray-600'
            }`}
          >
            <Wrench className="w-5 h-5 inline-block mr-2" />
            {t('requests')}
          </button>
          <button
            onClick={() => setShowBilling(true)}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              showBilling ? 'bg-zinc-900 text-white' : 'bg-white text-gray-600'
            }`}
          >
            <DollarSign className="w-5 h-5 inline-block mr-2" />
            {t('billing')}
          </button>
        </div>

        {!showBilling ? (
          <>
            {/* 統計カード */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-white rounded-xl p-3 shadow-sm text-center">
                <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                <div className="text-xs text-gray-500">{t('stats.total')}</div>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 shadow-sm text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-xs text-yellow-600">{t('stats.pending')}</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 shadow-sm text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
                <div className="text-xs text-blue-600">{t('stats.inProgress')}</div>
              </div>
              <div className="bg-green-50 rounded-xl p-3 shadow-sm text-center">
                <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-xs text-green-600">{t('stats.completed')}</div>
              </div>
            </div>

            {/* フィルター */}
            <div className="bg-white rounded-xl p-4 shadow-sm mb-4 space-y-3">
              {/* 業者選択 */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedVendor('all')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedVendor === 'all' ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t('allVendors')}
                </button>
                <button
                  onClick={() => setSelectedVendor('lifesupport')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedVendor === 'lifesupport' ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  LIFESUPPORT
                </button>
                <button
                  onClick={() => setSelectedVendor('fujimak')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    selectedVendor === 'fujimak' ? 'bg-zinc-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Fujimak
                </button>
              </div>

              {/* ステータスフィルター */}
              <div className="flex gap-2 overflow-x-auto">
                {['all', 'pending', 'accepted', 'in_progress', 'completed'].map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`py-1.5 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      statusFilter === status ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {status === 'all' ? t('allStatus') : getStatusLabel(status as MaintenanceStatus)}
                  </button>
                ))}
              </div>

              {/* 検索 */}
              <div>
                <input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>

            {/* 依頼一覧 */}
            <div className="space-y-3">
              {filteredRequests.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                  {t('noRequests')}
                </div>
              ) : (
                filteredRequests.map(request => (
                  <div key={request.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {/* ヘッダー */}
                    <div 
                      className="p-4 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${getUrgencyColor(request.urgency)}`} />
                            <span className="font-medium text-gray-800">{request.storeName}</span>
                            <span className="text-sm text-gray-500">{request.storeNameEn}</span>
                          </div>
                          <p className="text-sm text-gray-600">{getItemName(request.itemId)}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                              {getStatusLabel(request.status)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {format(request.preferredDate, 'MM/dd')} {request.preferredTimeStart}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            {request.vendorId === 'lifesupport' ? 'LIFESUPPORT' : 'Fujimak'}
                          </span>
                          {expandedId === request.id ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 詳細 */}
                    {expandedId === request.id && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
                        {/* 店舗情報 */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            <span>{request.address}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-4 h-4" />
                            <span>{request.phone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <span>{format(request.preferredDate, 'yyyy/MM/dd')} {request.preferredTimeStart} - {request.preferredTimeEnd}</span>
                          </div>
                        </div>

                        {/* 備考 */}
                        {request.remarks && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                              <FileText className="w-4 h-4" />
                              <span>{t('remarks')}</span>
                            </div>
                            <p className="text-sm text-gray-700">{request.remarks}</p>
                          </div>
                        )}

                        {/* 金額入力（完了時） */}
                        {request.status === 'completed' && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">{t('cost')}:</span>
                            <input
                              type="number"
                              value={request.cost || ''}
                              onChange={(e) => updateCost(request.id, Number(e.target.value))}
                              className="w-32 px-3 py-1 border border-gray-200 rounded-lg text-right"
                              placeholder="0"
                            />
                            <span className="text-sm text-gray-500">HKD</span>
                          </div>
                        )}

                        {/* ステータス更新ボタン */}
                        {request.status !== 'completed' && (
                          <div className="flex gap-2">
                            {request.status === 'pending' && (
                              <button
                                onClick={() => updateStatus(request.id, 'accepted')}
                                className="flex-1 py-2 bg-blue-500 text-white rounded-lg font-medium"
                              >
                                {t('accept')}
                              </button>
                            )}
                            {request.status === 'accepted' && (
                              <button
                                onClick={() => updateStatus(request.id, 'in_progress')}
                                className="flex-1 py-2 bg-purple-500 text-white rounded-lg font-medium"
                              >
                                {t('startWork')}
                              </button>
                            )}
                            {request.status === 'in_progress' && (
                              <button
                                onClick={() => updateStatus(request.id, 'completed')}
                                className="flex-1 py-2 bg-green-500 text-white rounded-lg font-medium"
                              >
                                {t('complete')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* 請求・集計画面 */
          <div className="space-y-6">
            {/* 月選択 */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronDown className="w-5 h-5 rotate-90" />
                </button>
                <span className="text-lg font-medium">
                  {getMonthDisplay(selectedMonth)}
                </span>
                <button
                  onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronDown className="w-5 h-5 -rotate-90" />
                </button>
              </div>
            </div>

            {/* 合計サマリー */}
            <div className="bg-gradient-to-r from-zinc-900 to-zinc-700 rounded-xl p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-6 h-6" />
                <span className="font-medium">{t('monthlyTotal')}</span>
              </div>
              <div className="text-4xl font-bold">
                HKD {(totalLifesupport + totalFujimak).toLocaleString()}
              </div>
              <div className="text-sm opacity-80 mt-2">
                {lifesupportBilling.length + fujimakBilling.length} {t('completedItems')}
              </div>
            </div>

            {/* LIFESUPPORT */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-800">LIFESUPPORT (HK) LIMITED</h3>
                    <p className="text-sm text-gray-500">{lifesupportBilling.length} {t('items')}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-zinc-900">HKD {totalLifesupport.toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {lifesupportBilling.map(req => (
                  <div key={req.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{req.storeName}</div>
                      <div className="text-xs text-gray-500">{getItemName(req.itemId)} - {req.completedDate && format(req.completedDate, 'MM/dd')}</div>
                    </div>
                    <div className="text-sm font-medium">HKD {(req.cost || 0).toLocaleString()}</div>
                  </div>
                ))}
                {lifesupportBilling.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">{t('noCompletedItems')}</div>
                )}
              </div>
            </div>

            {/* Fujimak */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-800">Fujimak</h3>
                    <p className="text-sm text-gray-500">{fujimakBilling.length} {t('items')}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-zinc-900">HKD {totalFujimak.toLocaleString()}</div>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {fujimakBilling.map(req => (
                  <div key={req.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{req.storeName}</div>
                      <div className="text-xs text-gray-500">{getItemName(req.itemId)} - {req.completedDate && format(req.completedDate, 'MM/dd')}</div>
                    </div>
                    <div className="text-sm font-medium">HKD {(req.cost || 0).toLocaleString()}</div>
                  </div>
                ))}
                {fujimakBilling.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">{t('noCompletedItems')}</div>
                )}
              </div>
            </div>

            {/* エクスポートボタン */}
            <button className="w-full py-4 bg-white rounded-xl shadow-sm font-medium text-gray-700 flex items-center justify-center gap-2">
              <Download className="w-5 h-5" />
              {t('exportCSV')}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
