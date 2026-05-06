'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  AlertCircle,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Send,
  X,
} from 'lucide-react'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import Header from '@/components/Header'
import { formatAngelPizzaStoreLabel } from '@/lib/angelStores'
import { DEFAULT_VENDORS, STORES, URGENCY_LEVELS } from '@/lib/constants'
import { createMaintenanceRequest } from '@/lib/maintenance'
import { getStoreMachines } from '@/lib/storeMachines'

type Step = 1 | 2 | 3 | 4 | 5 | 6
type MediaFile = { url: string; type: 'image' }
type NotificationRecipient = { id: string; email: string }

function normalizeFullWidthDigits(value: string) {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
}

async function optimizeImageToDataUrl(file: File) {
  const maxLongSide = 1280
  const jpegQuality = 0.72

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load selected image'))
      img.src = objectUrl
    })

    const ratio = Math.min(1, maxLongSide / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * ratio))
    const height = Math.max(1, Math.round(image.height * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to prepare image canvas')
    ctx.drawImage(image, 0, 0, width, height)

    return canvas.toDataURL('image/jpeg', jpegQuality)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export default function MaintenancePage() {
  const [step, setStep] = useState<Step>(1)
  const [selectedStore, setSelectedStore] = useState<(typeof STORES)[0] | null>(null)
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null)
  const [selectedSerial, setSelectedSerial] = useState('')
  const [manualSerial, setManualSerial] = useState('')
  const [selectedFaultLocation, setSelectedFaultLocation] = useState('')
  const [symptom, setSymptom] = useState('')
  const [selectedUrgency, setSelectedUrgency] = useState<string | null>('normal')
  const [remarks, setRemarks] = useState('')
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [preferredDate, setPreferredDate] = useState<Date | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [startHour, setStartHour] = useState(9)
  const [startMinute, setStartMinute] = useState(0)
  const [endHour, setEndHour] = useState(10)
  const [endMinute, setEndMinute] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitResult, setSubmitResult] = useState<{
    type: 'success' | 'error'
    title: string
    message: string
    requestId?: string
    note?: string
  } | null>(null)
  const [notificationRecipients, setNotificationRecipients] = useState<NotificationRecipient[]>(
    DEFAULT_VENDORS.map((vendor) => ({ id: vendor.id, email: vendor.email }))
  )

  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const t = useTranslations('maintenance')
  const tCommon = useTranslations('common')

  useEffect(() => {
    const storeId = localStorage.getItem('selectedStoreId')
    if (!storeId) {
      router.push('/stores')
      return
    }

    const store = STORES.find((s) => s.id === storeId)
    if (!store) {
      router.push('/stores')
      return
    }
    setSelectedStore(store)
  }, [router])

  useEffect(() => {
    const loadNotificationRecipients = async () => {
      try {
        const response = await fetch('/api/settings/vendors', { cache: 'no-store' })
        if (!response.ok) return
        const json = (await response.json()) as { vendors?: NotificationRecipient[] }
        const vendors = Array.isArray(json.vendors) ? json.vendors : []
        if (vendors.length > 0) {
          setNotificationRecipients(
            vendors
              .filter((vendor) => typeof vendor.email === 'string' && vendor.email.trim().length > 0)
              .map((vendor) => ({ id: vendor.id, email: vendor.email.trim() }))
          )
        }
      } catch {
        // Keep fallback defaults if settings API fails.
      }
    }
    void loadNotificationRecipients()
  }, [])

  const storeMachines = useMemo(
    () => (selectedStore ? getStoreMachines(selectedStore.id) : []),
    [selectedStore]
  )

  const selectedMachineEntry = useMemo(
    () => storeMachines.find((item) => item.machineId === selectedMachineId) ?? null,
    [selectedMachineId, storeMachines]
  )
  const selectedMachine = selectedMachineEntry?.machine ?? null

  const serialCandidates = useMemo(
    () =>
      storeMachines
        .filter((item) => item.machineId === selectedMachineId)
        .map((item) => item.machineSerial),
    [selectedMachineId, storeMachines]
  )

  useEffect(() => {
    if (!selectedMachineId && storeMachines.length > 0) {
      const first = storeMachines[0]
      if (first) {
        setSelectedMachineId(first.machineId)
        setSelectedSerial(normalizeFullWidthDigits(first.machineSerial))
      }
    }
  }, [selectedMachineId, storeMachines])

  useEffect(() => {
    if (!selectedMachine) {
      setSelectedFaultLocation('')
      return
    }
    const firstLocation = selectedMachine.faultLocations[0] ?? ''
    setSelectedFaultLocation((prev) =>
      prev && selectedMachine.faultLocations.includes(prev) ? prev : firstLocation
    )
    if (!selectedSerial) {
      setSelectedSerial(normalizeFullWidthDigits(serialCandidates[0] ?? ''))
    }
  }, [selectedMachine, serialCandidates, selectedSerial])

  const activeSerial = normalizeFullWidthDigits(manualSerial.trim() || selectedSerial)

  const steps = [
    { num: 1, label: t('step1') },
    { num: 2, label: t('step2') },
    { num: 3, label: t('step3') },
    { num: 4, label: t('step4') },
    { num: 5, label: t('step5') },
    { num: 6, label: t('step6') },
  ]

  const selectedUrgencyData = URGENCY_LEVELS.find((u) => u.id === selectedUrgency)

  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const items: MediaFile[] = []
    for (const file of Array.from(files)) {
      try {
        const optimizedUrl = await optimizeImageToDataUrl(file)
        items.push({ url: optimizedUrl, type: 'image' })
      } catch {
        // Skip invalid image files and continue with remaining files.
      }
    }
    if (items.length > 0) {
      setMediaFiles((prev) => [...prev, ...items])
    }
    event.target.value = ''
  }

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!selectedStore || !selectedMachine || !selectedUrgency || !preferredDate || !activeSerial) {
      return
    }

    setIsSubmitting(true)
    setSubmitResult(null)
    let createdRequestId = ''

    try {
      const createdRequest = await createMaintenanceRequest({
        storeId: selectedStore.id,
        storeName: formatAngelPizzaStoreLabel(selectedStore),
        categoryId: 'kitchen',
        itemId: 'jet-oven',
        machineId: selectedMachine.id,
        machineName: selectedMachine.displayName,
        machineModel: selectedMachine.modelCode,
        machineSerial: activeSerial,
        faultLocation: selectedFaultLocation,
        symptom: symptom.trim(),
        photoUrls: mediaFiles.map((file) => file.url),
        machineSourcePages: selectedMachine.sourcePageNos,
        urgency: selectedUrgency as 'urgent' | 'normal' | 'estimate',
        remarks,
        preferredDate: format(preferredDate, 'yyyy-MM-dd'),
        preferredStartTime: `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`,
        preferredEndTime: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`,
        source: 'staff_portal',
        vendorName: DEFAULT_VENDORS[0]?.name,
      })

      createdRequestId = createdRequest.id
      let notificationNote = ''
      let notificationDelivered = false
      try {
        const notificationRes = await fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'maintenance',
            storeName: formatAngelPizzaStoreLabel(selectedStore),
            machineName: selectedMachine.displayName,
            machineModel: selectedMachine.modelCode,
            machineSerial: activeSerial,
            faultLocation: selectedFaultLocation,
            symptom: symptom.trim(),
            urgency: selectedUrgency,
            preferredDate: format(preferredDate, 'yyyy-MM-dd'),
            preferredStartTime: `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`,
            preferredEndTime: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`,
            requestId: createdRequest.id,
            deviceInfo: {
              device: navigator.userAgent,
              screenSize: `${window.screen.width} x ${window.screen.height}`,
              language: navigator.language,
            },
          }),
        })
        const notificationJson = (await notificationRes.json().catch(() => ({}))) as {
          success?: boolean
          delivered?: boolean
          skipped?: boolean
          error?: string
          message?: string
          hint?: string
        }
        if (!notificationRes.ok || notificationJson.success === false) {
          const base = notificationJson.error || 'Notification failed. Check SMTP settings.'
          const hint =
            typeof notificationJson.hint === 'string' && notificationJson.hint.trim().length > 0
              ? `\n\n${notificationJson.hint.trim()}`
              : ''
          notificationNote = `${base}${hint}`
          notificationDelivered = false
        } else if (notificationJson.delivered === true) {
          notificationDelivered = true
        } else if (
          typeof notificationJson.message === 'string' &&
          notificationJson.message.trim().length > 0
        ) {
          notificationNote = notificationJson.message
          notificationDelivered = false
        }
      } catch (notificationError) {
        notificationNote =
          notificationError instanceof Error
            ? notificationError.message
            : 'Notification failed. Check SMTP settings.'
        notificationDelivered = false
      }

      if (notificationDelivered) {
        setSubmitResult({
          type: 'success',
          title: t('submitSuccess'),
          message: t('vendorNotified'),
          requestId: createdRequest.id,
        })
        setSubmitSuccess(true)
        setTimeout(() => {
          router.push('/dashboard')
        }, 1800)
      } else {
        setSubmitResult({
          type: 'error',
          title: t('submitError'),
          message: 'Request was created, but email delivery failed.',
          requestId: createdRequest.id,
          note: notificationNote || 'Please check SMTP settings and recipients, then retry notification.',
        })
      }
    } catch (error) {
      console.error('Failed to create maintenance request:', error)
      const message = error instanceof Error ? error.message : t('submitError')
      setSubmitResult({
        type: 'error',
        title: t('submitError'),
        message,
        requestId: createdRequestId || undefined,
        note: createdRequestId
          ? 'Request was created, but notification failed. Please check Management or retry notification.'
          : undefined,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return !!selectedMachineId
      case 2:
        return activeSerial.length > 0
      case 3:
        return selectedFaultLocation.length > 0
      case 4:
        return symptom.trim().length > 0
      case 5:
        return selectedUrgency !== null && preferredDate !== null
      case 6:
        return true
      default:
        return false
    }
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-fade-in">
          <Check className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          {submitResult?.title || t('submitSuccess')}
        </h2>
        <p className="text-gray-500 text-center">{submitResult?.message || t('vendorNotified')}</p>
        {submitResult?.requestId ? (
          <p className="mt-2 text-xs text-gray-600">Request ID: {submitResult.requestId}</p>
        ) : null}
        {submitResult?.note ? <p className="mt-1 text-xs text-gray-500 text-center">{submitResult.note}</p> : null}
        <p className="mt-4 text-xs text-gray-500">Redirecting to dashboard...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showBack title={t('title')} />

      <div className="bg-white px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step >= s.num ? 'bg-zinc-900 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-6 sm:w-10 h-1 mx-1 transition-colors ${
                    step > s.num ? 'bg-zinc-900' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-gray-600">{steps[step - 1]?.label}</p>
      </div>

      <main className="px-4 py-6 pb-44">
        {step === 1 && (
          <div className="animate-fade-in">
            <p className="text-gray-600 mb-4" style={{ marginLeft: '6px' }}>{t('selectMachine')}</p>
            <div className="space-y-3">
              {storeMachines.map((entry) => {
                const machine = entry.machine
                if (!machine) return null

                return (
                  <button
                    key={`${entry.machineId}-${entry.machineSerial}`}
                    onClick={() => {
                      setSelectedMachineId(entry.machineId)
                      setSelectedSerial(normalizeFullWidthDigits(entry.machineSerial))
                    }}
                    className={`w-full py-5 px-5 rounded-xl text-left transition-all ${
                      selectedMachineId === entry.machineId
                        ? 'bg-zinc-900 text-white shadow-lg'
                        : 'bg-white text-gray-700 hover:shadow-md'
                    }`}
                    style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
                  >
                    <div className="font-semibold text-lg">{machine.displayName}</div>
                    <div
                      className={`text-sm mt-2 ${
                        selectedMachineId === entry.machineId ? 'text-white/80' : 'text-gray-500'
                      }`}
                    >
                      {t('modelCode')}: {machine.modelCode} / {t('serialNumber')}: {entry.machineSerial}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in space-y-4">
            <p className="text-gray-600" style={{ marginLeft: '6px' }}>{t('selectSerial')}</p>

            {serialCandidates.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {serialCandidates.map((serial) => (
                  <button
                    key={serial}
                    onClick={() => {
                      setSelectedSerial(normalizeFullWidthDigits(serial))
                      setManualSerial('')
                    }}
                    className={`py-4 px-4 rounded-xl text-left transition-all ${
                      !manualSerial && selectedSerial === serial
                        ? 'bg-zinc-900 text-white shadow-lg'
                        : 'bg-white text-gray-700 hover:shadow-md'
                    }`}
                    style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
                  >
                    {serial}
                  </button>
                ))}
              </div>
            )}

            <div>
              <label className="block text-gray-700 font-medium mb-2" style={{ marginLeft: '6px' }}>{t('serialInputLabel')}</label>
              <input
                value={manualSerial}
                onChange={(event) => setManualSerial(normalizeFullWidthDigits(event.target.value))}
                placeholder={t('serialInputPlaceholder')}
                className="w-full p-4 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <p className="text-gray-600 mb-4" style={{ marginLeft: '6px' }}>{t('selectFaultLocation')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(selectedMachine?.faultLocations ?? []).map((location) => (
                <button
                  key={location}
                  onClick={() => setSelectedFaultLocation(location)}
                  className={`py-4 px-4 rounded-xl text-left transition-all ${
                    selectedFaultLocation === location
                      ? 'bg-zinc-900 text-white shadow-lg'
                      : 'bg-white text-gray-700 hover:shadow-md'
                  }`}
                  style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
                >
                  {location}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <label className="block text-gray-700 font-medium mb-2" style={{ marginLeft: '6px' }}>{t('symptom')}</label>
              <textarea
                value={symptom}
                onChange={(event) => setSymptom(event.target.value)}
                placeholder={t('symptomPlaceholder')}
                className="w-full p-4 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-none h-32"
                style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2" style={{ marginLeft: '6px' }}>{t('remarks')}</label>
              <textarea
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder={t('remarksPlaceholder')}
                className="w-full p-4 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-zinc-900 focus:border-transparent resize-none h-24"
                style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium mb-2" style={{ marginLeft: '6px' }}>{t('addMedia')}</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleMediaUpload}
                className="hidden"
              />

              <div className="flex gap-3 flex-wrap" style={{ marginLeft: '6px' }}>
                {mediaFiles.map((media, index) => (
                  <div key={index} className="relative w-24 h-24">
                    <img
                      src={media.url}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-contain rounded-lg bg-white border border-gray-200 p-0.5"
                    />
                    <button
                      onClick={() => removeMedia(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 bg-gray-100 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <Camera className="w-6 h-6" />
                  <span className="text-xs">{t('addPhoto')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="animate-fade-in space-y-6">
            <div>
              <p className="text-gray-600 mb-4" style={{ marginLeft: '6px' }}>{t('selectUrgency')}</p>
              <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-sm font-semibold text-zinc-800" style={{ marginLeft: '6px' }}>{t('urgencyGuideTitle')}</p>
                <p className="mt-1 text-sm text-zinc-700" style={{ marginLeft: '6px' }}>{t('urgencyGuideStep1')}</p>
                <p className="mt-1 text-sm text-zinc-700" style={{ marginLeft: '6px' }}>{t('urgencyGuideStep2')}</p>
              </div>
              <div className="space-y-4">
                {URGENCY_LEVELS.map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setSelectedUrgency(level.id)}
                    className={`w-full py-5 px-6 rounded-xl text-left transition-all flex items-center gap-4 ${
                      selectedUrgency === level.id
                        ? 'shadow-lg border-2'
                        : 'bg-white hover:shadow-md border-2 border-transparent'
                    }`}
                    style={{
                      marginLeft: '6px',
                      width: 'calc(100% - 6px)',
                      backgroundColor: selectedUrgency === level.id ? level.color : undefined,
                      color: selectedUrgency === level.id ? 'white' : undefined,
                      borderColor: selectedUrgency === level.id ? level.color : undefined,
                    }}
                  >
                    <div
                      className={`w-6 h-6 rounded-full ${selectedUrgency === level.id ? 'bg-white' : ''}`}
                      style={{ backgroundColor: selectedUrgency !== level.id ? level.color : undefined }}
                    />
                    <span className="font-semibold text-xl">{t(level.id)}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-gray-600 mb-1" style={{ marginLeft: '6px' }}>{t('preferredDate')}</p>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800" style={{ marginLeft: '6px' }}>
                  {(() => {
                    const monthNames = [
                      tCommon('months.jan'),
                      tCommon('months.feb'),
                      tCommon('months.mar'),
                      tCommon('months.apr'),
                      tCommon('months.may'),
                      tCommon('months.jun'),
                      tCommon('months.jul'),
                      tCommon('months.aug'),
                      tCommon('months.sep'),
                      tCommon('months.oct'),
                      tCommon('months.nov'),
                      tCommon('months.dec'),
                    ]
                    return `${currentMonth.getFullYear()}${tCommon('year')} ${monthNames[currentMonth.getMonth()]}`
                  })()}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {[
                  tCommon('days.sun'),
                  tCommon('days.mon'),
                  tCommon('days.tue'),
                  tCommon('days.wed'),
                  tCommon('days.thu'),
                  tCommon('days.fri'),
                  tCommon('days.sat'),
                ].map((day, i) => (
                  <div
                    key={i}
                    className={`text-center text-sm font-medium py-2 ${i === 6 ? 'text-blue-500' : 'text-gray-500'}`}
                  >
                    {day}
                  </div>
                ))}
              </div>

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
                    const isSelected = preferredDate && isSameDay(currentDay, preferredDate)
                    const isPast = isBefore(currentDay, new Date()) && !isToday(currentDay)
                    const dayOfWeek = currentDay.getDay()

                    days.push(
                      <button
                        key={currentDay.toISOString()}
                        onClick={() => !isPast && setPreferredDate(currentDay)}
                        disabled={isPast}
                        className={`aspect-square flex items-center justify-center rounded-full text-base font-medium transition-all ${
                          isSelected
                            ? 'bg-zinc-900 text-white'
                            : isPast
                              ? 'text-gray-300 cursor-not-allowed'
                              : isToday(currentDay)
                                ? 'bg-green-500 text-white'
                                : !isCurrentMonth
                                  ? 'text-gray-300'
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
            </div>

            {preferredDate && (
              <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
                <h3 className="text-lg font-semibold text-gray-800" style={{ marginLeft: '6px' }}>{t('timeSelection')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="text-sm text-gray-600">
                    <span style={{ marginLeft: '6px' }}>{t('startTime')}</span>
                    <input
                      type="time"
                      value={`${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`}
                      onChange={(event) => {
                        const [hour, minute] = event.target.value.split(':').map((v) => Number(v))
                        if (Number.isFinite(hour) && Number.isFinite(minute)) {
                          setStartHour(hour)
                          setStartMinute(minute)
                        }
                      }}
                      className="mt-1 w-full p-3 rounded-lg border border-gray-200"
                      style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
                    />
                  </label>
                  <label className="text-sm text-gray-600">
                    {t('endTime')}
                    <input
                      type="time"
                      value={`${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`}
                      onChange={(event) => {
                        const [hour, minute] = event.target.value.split(':').map((v) => Number(v))
                        if (Number.isFinite(hour) && Number.isFinite(minute)) {
                          setEndHour(hour)
                          setEndMinute(minute)
                        }
                      }}
                      className="mt-1 w-full p-3 rounded-lg border border-gray-200"
                    />
                  </label>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-500 mb-1">{t('selectedDateTime')}</p>
                  <p className="text-lg font-bold text-gray-800">
                    {format(preferredDate, 'yyyy/MM/dd')} {startHour.toString().padStart(2, '0')}:
                    {startMinute.toString().padStart(2, '0')} - {endHour.toString().padStart(2, '0')}:
                    {endMinute.toString().padStart(2, '0')}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold text-gray-800 mb-4" style={{ marginLeft: '6px' }}>
              {t('confirmTitle')}
            </h2>
            {submitResult?.type === 'error' ? (
              <div
                className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
              >
                <p className="font-semibold">{submitResult.title}</p>
                <p className="mt-1">{submitResult.message}</p>
                {submitResult.requestId ? <p className="mt-1 text-xs">Request ID: {submitResult.requestId}</p> : null}
                {submitResult.note ? <p className="mt-1 text-xs">{submitResult.note}</p> : null}
              </div>
            ) : null}
            <div className="bg-white rounded-xl p-4 space-y-4">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500" style={{ marginLeft: '6px' }}>{t('store')}</span>
                <span
                  className="font-medium text-right"
                  style={{ width: '137px', textAlign: 'right', paddingRight: '6px' }}
                >
                  {selectedStore?.name_zh}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500" style={{ marginLeft: '6px' }}>{t('machineName')}</span>
                <span
                  className="font-medium text-right"
                  style={{ width: '136px', textAlign: 'right', paddingRight: '6px' }}
                >
                  {selectedMachine?.displayName}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500" style={{ marginLeft: '6px' }}>{t('modelCode')}</span>
                <span
                  className="font-medium text-right"
                  style={{ width: '112px', textAlign: 'right', paddingRight: '6px' }}
                >
                  {selectedMachine?.modelCode}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500" style={{ marginLeft: '6px' }}>{t('serialNumber')}</span>
                <span
                  className="font-medium text-right"
                  style={{ width: '72px', textAlign: 'right', paddingRight: '6px' }}
                >
                  {activeSerial}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500" style={{ marginLeft: '6px' }}>{t('faultLocation')}</span>
                <span
                  className="font-medium text-right"
                  style={{ width: '118px', textAlign: 'right', paddingRight: '6px' }}
                >
                  {selectedFaultLocation}
                </span>
              </div>
              <div className="py-2 border-b border-gray-100">
                <span className="text-gray-500 block mb-1" style={{ marginLeft: '6px' }}>{t('symptom')}</span>
                <p className="text-gray-800" style={{ marginLeft: '6px' }}>{symptom}</p>
              </div>
              {remarks && (
                <div className="py-2 border-b border-gray-100">
                  <span className="text-gray-500 block mb-1" style={{ marginLeft: '6px' }}>{t('remarks')}</span>
                  <p className="text-gray-800" style={{ marginLeft: '6px' }}>{remarks}</p>
                </div>
              )}
              {mediaFiles.length > 0 && (
                <div className="py-2 border-b border-gray-100">
                  <span className="text-gray-500 block mb-2" style={{ marginLeft: '6px' }}>{t('photos')}</span>
                  <div className="flex gap-2" style={{ marginLeft: '6px' }}>
                    {mediaFiles.map((media, index) => (
                      <img
                        key={index}
                        src={media.url}
                        alt={`Photo ${index + 1}`}
                        className="w-16 h-16 object-contain rounded bg-white border border-gray-200 p-0.5"
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500" style={{ marginLeft: '6px' }}>{t('urgency')}</span>
                <span
                  className="font-medium px-2 py-1 rounded text-white text-sm"
                  style={{ backgroundColor: selectedUrgencyData?.color, marginRight: '6px' }}
                >
                  {selectedUrgencyData && t(selectedUrgencyData.id)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500" style={{ marginLeft: '6px' }}>{t('preferredDate')}</span>
                <span
                  className="font-medium text-right"
                  style={{ width: '199px', textAlign: 'right', paddingRight: '6px' }}
                >
                  {preferredDate &&
                    `${format(preferredDate, 'yyyy/MM/dd')} ${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')} - ${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`}
                </span>
              </div>
              <div className="py-2 bg-blue-50 rounded-lg p-3 mt-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-800 font-medium" style={{ marginLeft: '6px' }}>
                      {t('notifyVendors')}
                    </p>
                    {notificationRecipients.map((vendor) => (
                      <p key={vendor.id} className="text-sm text-blue-600">
                        {vendor.email}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-gray-100 px-6 py-4 pb-8">
        <div className="flex gap-3 justify-center">
          {step > 1 && (
            <button
              onClick={() => setStep((step - 1) as Step)}
              className="w-[45%] h-20 bg-gray-200 text-gray-700 rounded-[2rem] font-bold text-xl flex items-center justify-center gap-2 shadow-md"
            >
              <ChevronLeft className="w-6 h-6" />
              {tCommon('back')}
            </button>
          )}

          {step < 6 ? (
            <button
              onClick={() => setStep((step + 1) as Step)}
              disabled={!canProceed()}
              className={`${step > 1 ? 'w-[45%]' : 'w-[75%]'} h-20 rounded-[2rem] font-bold text-xl flex items-center justify-center gap-2 transition-colors shadow-lg ${
                canProceed()
                  ? 'bg-zinc-900 text-white'
                  : 'bg-gray-300 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              {tCommon('next')}
              <ChevronRight className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`${step > 1 ? 'w-[45%]' : 'w-[75%]'} h-20 bg-zinc-900 text-white rounded-[2rem] font-bold text-xl flex items-center justify-center gap-2 shadow-lg`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                <>
                  <Send className="w-6 h-6" />
                  {tCommon('submit')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
