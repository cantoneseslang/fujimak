'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Clock, 
  Check, 
  MessageSquare,
  Building2,
  AlertCircle,
  Bell
} from 'lucide-react'
import Header from '@/components/Header'
import { STORES } from '@/lib/constants'
import { format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isSameDay, isToday, isBefore } from 'date-fns'
import type { MaintenanceRequestRecord } from '@/lib/maintenance'

type ScheduleNotification = MaintenanceRequestRecord

export default function NotificationsPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('notifications')
  const tCommon = useTranslations('common')
  const tAreas = useTranslations('areas')
  const tItems = useTranslations('items')
  const safeItemLabel = (itemId: string | null) => {
    if (!itemId) return '-'
    try {
      return tItems(itemId)
    } catch {
      return itemId
    }
  }
  const [selectedStoreId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem('selectedStoreId')
  )
  const [storeNotifications, setStoreNotifications] = useState<ScheduleNotification[]>([])
  const [selectedNotification, setSelectedNotification] = useState<ScheduleNotification | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [newProposedDate, setNewProposedDate] = useState<Date | null>(null)
  const [newStartHour, setNewStartHour] = useState(9)
  const [newStartMinute, setNewStartMinute] = useState(0)
  const [newEndHour, setNewEndHour] = useState(11)
  const [newEndMinute, setNewEndMinute] = useState(0)
  const [responseStatus, setResponseStatus] = useState<'idle' | 'approved' | 'rescheduled'>('idle')

  useEffect(() => {
    const storeId = selectedStoreId
    if (!storeId) {
      router.push('/stores')
      return
    }

    const loadNotifications = async () => {
      try {
        const res = await fetch(
          `/api/maintenance/notifications?storeId=${encodeURIComponent(storeId)}&status=pending`,
          { cache: 'no-store' }
        )
        if (!res.ok) return
        const json = (await res.json()) as { notifications?: ScheduleNotification[] }
        const notifications = json.notifications ?? []
        setStoreNotifications(notifications)
        if (notifications.length > 0) {
          setSelectedNotification(notifications[0])
        }
      } catch (error) {
        console.error('Failed to load schedule notifications:', error)
      }
    }

    void loadNotifications()
  }, [router, selectedStoreId])

  const selectedStore = STORES.find((store) => store.id === selectedStoreId) ?? null

  const handleApprove = async () => {
    if (!selectedNotification) return
    try {
      await fetch('/api/maintenance/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedNotification.id,
          action: 'approve',
        }),
      })
      setResponseStatus('approved')
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } catch (error) {
      console.error('Failed to approve schedule:', error)
    }
  }

  const handleRequestReschedule = () => {
    setShowCalendar(true)
  }

  const handleSubmitReschedule = async () => {
    if (!selectedNotification || !newProposedDate) return
    try {
      await fetch('/api/maintenance/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: selectedNotification.id,
          action: 'reschedule',
          newDate: format(newProposedDate, 'yyyy-MM-dd'),
          newStartTime: `${newStartHour.toString().padStart(2, '0')}:${newStartMinute
            .toString()
            .padStart(2, '0')}`,
          newEndTime: `${newEndHour.toString().padStart(2, '0')}:${newEndMinute
            .toString()
            .padStart(2, '0')}`,
        }),
      })
      setResponseStatus('rescheduled')
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } catch (error) {
      console.error('Failed to request reschedule:', error)
    }
  }

  if (responseStatus === 'approved') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-fade-in">
          <Check className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('approvedMessage')}</h2>
        <p className="text-gray-500 text-center">
          {t('approvedDetail')}
        </p>
      </div>
    )
  }

  if (responseStatus === 'rescheduled') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 animate-fade-in">
          <Calendar className="w-10 h-10 text-blue-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('rescheduledMessage')}</h2>
        <p className="text-gray-500 text-center">
          {t('rescheduledDetail')}
        </p>
      </div>
    )
  }

  // Demo vendor message based on locale (in real app, this would come from backend)
  const vendorMessage = {
    zh: `非常抱歉，1月15日已有安排。可否改為1月18日下午？`,
    ja: `誠に申し訳ございませんが、1月15日は予定が入っております。1月18日の午後に変更させていただけますでしょうか。`,
    en: `We apologize, but January 15th is not available. Would it be possible to reschedule to January 18th afternoon?`
  }

  // 通知がない場合の表示
  if (!selectedNotification || storeNotifications.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header showBack title={t('title')} />
        <main className="px-4 py-6">
          <div className="bg-white rounded-xl p-8 shadow-sm text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-600 mb-2">
              {tCommon('noResults')}
            </h2>
            <p className="text-gray-400 text-sm">
              {selectedStore?.name_zh}
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showBack title={t('title')} />
      
      <main className="px-4 py-6 pb-32">
        {/* Notification Card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-blue-500 text-white p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6" />
              <div>
                <h2 className="font-semibold text-lg">{t('scheduleChangeRequest')}</h2>
                <p className="text-blue-100 text-sm">
                  {format(new Date(selectedNotification.created_at), 'yyyy/MM/dd HH:mm')}
                </p>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Store & Item Info */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Building2 className="w-5 h-5 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800">{selectedStore?.name_zh}</p>
                <p className="text-sm text-gray-500">
                  {selectedNotification.machine_name ??
                    selectedNotification.machine_model ??
                    safeItemLabel(selectedNotification.item_id)}
                  {' - '}
                  {selectedNotification.fault_location ??
                    (selectedNotification.category_id ? tAreas(selectedNotification.category_id) : '-')}
                </p>
              </div>
            </div>
            
            {/* Vendor Message */}
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-gray-700">
                {vendorMessage[(locale as 'ja' | 'en' | 'zh') ?? 'en'] || vendorMessage.en}
              </p>
              <p className="text-xs text-gray-500 mt-2">— {selectedNotification.vendor_name || 'Fujimak Service'}</p>
            </div>
            
            {/* Date Comparison */}
            <div className="grid grid-cols-2 gap-4">
              {/* Original Request */}
              <div className="p-4 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-500 mb-2 font-medium">{t('originalSchedule')}</p>
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-800">
                    {selectedNotification.preferred_date
                      ? format(new Date(selectedNotification.preferred_date), 'M/d')
                      : '-'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {selectedNotification.preferred_start_time || '--:--'} -{' '}
                    {selectedNotification.preferred_end_time || '--:--'}
                  </span>
                </div>
              </div>
              
              {/* Vendor Proposed */}
              <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <p className="text-xs text-blue-600 mb-2 font-medium">{t('vendorProposed')}</p>
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-blue-800">
                    {selectedNotification.vendor_proposed_date
                      ? format(new Date(selectedNotification.vendor_proposed_date), 'M/d')
                      : '-'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-blue-700">
                    {selectedNotification.vendor_proposed_start_time || '--:--'} -{' '}
                    {selectedNotification.vendor_proposed_end_time || '--:--'}
                  </span>
                </div>
              </div>
            </div>

            {/* Month Calendar - Always visible */}
            <div className="bg-gray-50 rounded-xl p-4">
              {showCalendar && (
                <div className="flex items-center gap-2 text-gray-700 mb-4">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  <span className="font-medium">{t('selectNewDate')}</span>
                </div>
              )}
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {t('monthYear', { year: currentMonth.getFullYear(), month: currentMonth.getMonth() + 1 })}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {(t.raw('weekdays') as string[]).map((day, i) => (
                      <div 
                        key={i} 
                        className={`text-center text-sm font-medium py-2 ${
                          i === 6 ? 'text-blue-500' : 'text-gray-500'
                        }`}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar Days */}
                  <div className="grid grid-cols-7 gap-1">
                    {(() => {
                      const monthStart = startOfMonth(currentMonth)
                      const monthEnd = endOfMonth(currentMonth)
                      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
                      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
                      
                      const days = []
                      let day = calendarStart
                      
                      while (day <= calendarEnd) {
                        const currentDay = day
                        const isCurrentMonth = isSameMonth(currentDay, currentMonth)
                        const isSelected = newProposedDate && isSameDay(currentDay, newProposedDate)
                        const isPast = isBefore(currentDay, new Date()) && !isToday(currentDay)
                        const originalDate = selectedNotification.preferred_date
                          ? new Date(selectedNotification.preferred_date)
                          : null
                        const vendorProposedDate = selectedNotification.vendor_proposed_date
                          ? new Date(selectedNotification.vendor_proposed_date)
                          : null
                        const isOriginal = originalDate ? isSameDay(currentDay, originalDate) : false
                        const isVendorProposed = vendorProposedDate
                          ? isSameDay(currentDay, vendorProposedDate)
                          : false
                        const dayOfWeek = currentDay.getDay()
                        
                        days.push(
                          <button
                            key={currentDay.toISOString()}
                            onClick={() => !isPast && setNewProposedDate(currentDay)}
                            disabled={isPast}
                            className={`w-10 h-10 mx-auto flex items-center justify-center rounded-full text-sm font-medium transition-all relative ${
                              isSelected
                                ? 'bg-orange-500 text-white'
                                : isVendorProposed
                                ? 'bg-blue-500 text-white'
                                : isOriginal
                                ? 'bg-gray-400 text-white'
                                : isPast
                                ? 'text-gray-300 cursor-not-allowed'
                                : isToday(currentDay)
                                ? 'bg-green-500 text-white'
                                : !isCurrentMonth
                                ? 'text-gray-300'
                                : dayOfWeek === 0
                                ? 'text-gray-700 hover:bg-gray-100'
                                : dayOfWeek === 6
                                ? 'text-blue-500 hover:bg-blue-50'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {format(currentDay, 'd')}
                          </button>
                        )
                        day = addDays(day, 1)
                      }
                      
                      return days
                    })()}
                  </div>
                  
                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 mt-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                      <span className="text-gray-500">{t('legend.original')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-500">{t('legend.vendorProposed')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span className="text-gray-500">{t('legend.newProposed')}</span>
                    </div>
                  </div>
                </div>

            {/* Time Selection - Only when in reschedule mode and date selected */}
            {showCalendar && newProposedDate && (
              <div className="bg-white rounded-xl p-4 shadow-sm mt-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('preferredTime')}</h3>
                    
                    {/* Start Time */}
                    <div className="mb-6">
                      <label className="block text-sm text-gray-500 mb-2">{t('startTime')}</label>
                      <div className="flex items-center justify-center gap-4">
                        {/* Hour Picker */}
                        <div className="relative h-40 w-20 overflow-hidden">
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-gray-100 rounded-lg pointer-events-none z-0" />
                          <div 
                            className="absolute inset-0 overflow-y-auto scrollbar-hide snap-y snap-mandatory"
                            style={{ scrollbarWidth: 'none' }}
                            onScroll={(e) => {
                              const target = e.target as HTMLDivElement
                              const scrollTop = target.scrollTop
                              const itemHeight = 48
                              const selectedIndex = Math.round(scrollTop / itemHeight)
                              if (selectedIndex >= 0 && selectedIndex <= 23) {
                                setNewStartHour(selectedIndex)
                              }
                            }}
                          >
                            <div className="h-16" />
                            {Array.from({ length: 24 }, (_, i) => (
                              <div
                                key={i}
                                className={`h-12 flex items-center justify-center text-2xl font-medium snap-center ${
                                  newStartHour === i ? 'text-gray-900' : 'text-gray-400'
                                }`}
                              >
                                {i}
                              </div>
                            ))}
                            <div className="h-16" />
                          </div>
                        </div>
                        
                        <span className="text-2xl font-bold text-gray-400">:</span>
                        
                        {/* Minute Picker */}
                        <div className="relative h-40 w-20 overflow-hidden">
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-gray-100 rounded-lg pointer-events-none z-0" />
                          <div 
                            className="absolute inset-0 overflow-y-auto scrollbar-hide snap-y snap-mandatory"
                            style={{ scrollbarWidth: 'none' }}
                            onScroll={(e) => {
                              const target = e.target as HTMLDivElement
                              const scrollTop = target.scrollTop
                              const itemHeight = 48
                              const selectedIndex = Math.round(scrollTop / itemHeight)
                              const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
                              if (selectedIndex >= 0 && selectedIndex < minutes.length) {
                                setNewStartMinute(minutes[selectedIndex])
                              }
                            }}
                          >
                            <div className="h-16" />
                            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                              <div
                                key={m}
                                className={`h-12 flex items-center justify-center text-2xl font-medium snap-center ${
                                  newStartMinute === m ? 'text-gray-900' : 'text-gray-400'
                                }`}
                              >
                                {m.toString().padStart(2, '0')}
                              </div>
                            ))}
                            <div className="h-16" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* End Time */}
                    <div>
                      <label className="block text-sm text-gray-500 mb-2">{t('endTime')}</label>
                      <div className="flex items-center justify-center gap-4">
                        {/* Hour Picker */}
                        <div className="relative h-40 w-20 overflow-hidden">
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-gray-100 rounded-lg pointer-events-none z-0" />
                          <div 
                            className="absolute inset-0 overflow-y-auto scrollbar-hide snap-y snap-mandatory"
                            style={{ scrollbarWidth: 'none' }}
                            onScroll={(e) => {
                              const target = e.target as HTMLDivElement
                              const scrollTop = target.scrollTop
                              const itemHeight = 48
                              const selectedIndex = Math.round(scrollTop / itemHeight)
                              if (selectedIndex >= 0 && selectedIndex <= 23) {
                                setNewEndHour(selectedIndex)
                              }
                            }}
                          >
                            <div className="h-16" />
                            {Array.from({ length: 24 }, (_, i) => (
                              <div
                                key={i}
                                className={`h-12 flex items-center justify-center text-2xl font-medium snap-center ${
                                  newEndHour === i ? 'text-gray-900' : 'text-gray-400'
                                }`}
                              >
                                {i}
                              </div>
                            ))}
                            <div className="h-16" />
                          </div>
                        </div>
                        
                        <span className="text-2xl font-bold text-gray-400">:</span>
                        
                        {/* Minute Picker */}
                        <div className="relative h-40 w-20 overflow-hidden">
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-gray-100 rounded-lg pointer-events-none z-0" />
                          <div 
                            className="absolute inset-0 overflow-y-auto scrollbar-hide snap-y snap-mandatory"
                            style={{ scrollbarWidth: 'none' }}
                            onScroll={(e) => {
                              const target = e.target as HTMLDivElement
                              const scrollTop = target.scrollTop
                              const itemHeight = 48
                              const selectedIndex = Math.round(scrollTop / itemHeight)
                              const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
                              if (selectedIndex >= 0 && selectedIndex < minutes.length) {
                                setNewEndMinute(minutes[selectedIndex])
                              }
                            }}
                          >
                            <div className="h-16" />
                            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                              <div
                                key={m}
                                className={`h-12 flex items-center justify-center text-2xl font-medium snap-center ${
                                  newEndMinute === m ? 'text-gray-900' : 'text-gray-400'
                                }`}
                              >
                                {m.toString().padStart(2, '0')}
                              </div>
                            ))}
                            <div className="h-16" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Selected Time Display */}
                    <div className="mt-6 p-4 bg-orange-50 rounded-lg text-center">
                      <p className="text-sm text-gray-500 mb-1">{t('selectedDateTime')}</p>
                      <p className="text-xl font-bold text-orange-800">
                        {format(newProposedDate, 'yyyy/MM/dd')} {newStartHour.toString().padStart(2, '0')}:{newStartMinute.toString().padStart(2, '0')} - {newEndHour.toString().padStart(2, '0')}:{newEndMinute.toString().padStart(2, '0')}
                      </p>
                    </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Bottom Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-8">
        {!showCalendar ? (
          <div className="flex gap-3">
            <button
              onClick={handleRequestReschedule}
              className="flex-1 h-16 px-6 bg-zinc-900 text-white rounded-full font-semibold text-xl flex items-center justify-center"
            >
              {t('requestReschedule')}
            </button>
            <button
              onClick={handleApprove}
              className="flex-1 h-16 px-6 bg-green-500 text-white rounded-full font-semibold text-xl flex items-center justify-center"
            >
              {t('approve')}
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowCalendar(false)
                setNewProposedDate(null)
              }}
              className="flex-1 h-16 px-6 bg-gray-200 text-gray-700 rounded-full font-semibold text-xl flex items-center justify-center"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSubmitReschedule}
              disabled={!newProposedDate}
              className={`flex-1 h-16 px-6 rounded-full font-semibold text-xl flex items-center justify-center ${
                newProposedDate
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-300 text-gray-400 cursor-not-allowed'
              }`}
            >
              {t('submitReschedule')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
