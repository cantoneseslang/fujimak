'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Download, FileCheck2, Loader2, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'
import { PARTS_CATALOG } from '@/lib/partsCatalog'
import {
  PARTS_ORDER_DRAFT_KEY,
  type PartsOrderDraft,
  calculateOrderTotals,
} from '@/lib/partsOrder'

export default function PartsOrderConfirmPage() {
  const router = useRouter()
  const t = useTranslations('parts')
  const tCommon = useTranslations('common')
  const [draft, setDraft] = useState<PartsOrderDraft | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isSavingPdf, setIsSavingPdf] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem(PARTS_ORDER_DRAFT_KEY)
    if (!raw) {
      router.push('/parts')
      return
    }
    try {
      const parsed = JSON.parse(raw) as PartsOrderDraft
      if (!parsed?.items?.length) {
        router.push('/parts')
        return
      }
      const enriched: PartsOrderDraft = {
        ...parsed,
        items: parsed.items.map((item) => ({
          ...item,
          imageId: item.imageId || PARTS_CATALOG.find((c) => c.id === item.id)?.imageId,
        })),
      }
      setDraft(enriched)
    } catch {
      router.push('/parts')
      return
    } finally {
      setIsReady(true)
    }
  }, [router])

  const { totalUnits, totalAmount } = useMemo(
    () => calculateOrderTotals(draft?.items ?? []),
    [draft?.items]
  )

  const formatter = useMemo(() => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: draft?.currency || 'PHP',
      maximumFractionDigits: 2,
    })
  }, [draft?.currency])

  const handleSavePdf = async () => {
    if (!draft || isSavingPdf) return
    setFeedback(null)
    setIsSavingPdf(true)
    try {
      const response = await fetch('/api/parts-order/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const contentType = response.headers.get('Content-Type') || ''
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error || t('pdfFailed'))
      }
      if (!contentType.includes('application/pdf')) {
        throw new Error(t('pdfFailed'))
      }
      const blob = await response.blob()
      const cd = response.headers.get('Content-Disposition')
      let filename = 'fujimak-order.pdf'
      const m = cd?.match(/filename="([^"]+)"/)
      if (m?.[1]) filename = m[1]
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.rel = 'noopener'
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : t('pdfFailed'),
      })
    } finally {
      setIsSavingPdf(false)
    }
  }

  const handleSend = async () => {
    if (!draft || isSending) return
    setFeedback(null)
    setIsSending(true)
    try {
      const response = await fetch('/api/parts-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const json = (await response.json()) as {
        success?: boolean
        error?: string
        orderNo?: string
        status?: string
      }
      if (!response.ok || !json.success) {
        throw new Error(json.error || t('orderFailed'))
      }
      localStorage.removeItem(PARTS_ORDER_DRAFT_KEY)
      setFeedback({
        type: 'success',
        message: json.orderNo
          ? `${t('orderSuccess')} (${json.orderNo}). ${t('orderProcessingNotice')}`
          : `${t('orderSuccess')}. ${t('orderProcessingNotice')}`,
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : t('orderFailed'),
      })
    } finally {
      setIsSending(false)
    }
  }

  if (!isReady || !draft) {
    return (
      <div className="min-h-screen bg-stone-200 pb-40 dark:bg-zinc-950">
        <Header showBack title={t('confirmTitle')} titleClassName="ml-1.5" />
        <main className="flex flex-col items-center justify-center px-4 pt-16 pb-8">
          <Loader2 className="h-10 w-10 animate-spin text-zinc-500" aria-hidden />
          <span className="sr-only">{tCommon('loading')}</span>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-200 pb-40 dark:bg-zinc-950">
      <Header showBack title={t('confirmTitle')} titleClassName="ml-1.5" />

      <main className="px-3 py-5 sm:px-4 sm:py-6">
        <div className="mx-auto flex w-full max-w-[220mm] justify-center">
          <section className="flex min-h-[min(85vh,297mm)] w-full max-w-[210mm] flex-col rounded-sm border border-zinc-300/90 bg-white p-6 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25),0_4px_16px_-4px_rgba(0,0,0,0.12)] sm:min-h-[297mm] sm:p-8 md:p-10">
            <div className="mb-6 flex flex-col gap-3 border-b border-zinc-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-lg font-bold tracking-tight text-zinc-900 sm:text-xl" style={{ marginLeft: '6px' }}>
                  {t('orderSheetTitle')}
                </h1>
                <p className="mt-1 text-sm text-zinc-500" style={{ marginLeft: '6px' }}>{t('orderSheetSubtitle')}</p>
              </div>
              <div
                className="shrink-0 self-start rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600"
                style={{ marginLeft: '6px' }}
              >
                {new Date(draft.createdAt).toLocaleString()}
              </div>
            </div>

            <div className="mb-4 grid gap-2 text-sm text-zinc-700">
              <p style={{ marginLeft: '6px' }}>
                <span className="font-semibold">{t('fromStore')}:</span> {draft.storeName} ({draft.storeId})
              </p>
              {draft.machineName || draft.machineModel ? (
                <p style={{ marginLeft: '6px' }}>
                  <span className="font-semibold">{t('selectedMachine')}:</span>{' '}
                  {draft.machineName || draft.machineModel}
                  {draft.machineSerial ? ` / ${draft.machineSerial}` : ''}
                </p>
              ) : null}
              <p style={{ marginLeft: '6px' }}>
                <span className="font-semibold">{t('toRecipient')}:</span> {draft.recipient}
              </p>
              <p style={{ marginLeft: '6px' }}>
                <span className="font-semibold">{t('currency')}:</span> {draft.currency}
              </p>
            </div>

            <div className="overflow-x-auto" style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-14 border border-zinc-200 bg-zinc-50 px-1 py-2 text-center text-xs font-semibold text-zinc-700">
                      {t('photo')}
                    </th>
                    <th className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-left">{t('part')}</th>
                    <th className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-left">{t('spec')}</th>
                    <th className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-right">{t('quantity')}</th>
                    <th className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-right">{t('unitPrice')}</th>
                    <th
                      className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-right"
                      style={{ textAlign: 'right', paddingRight: '6px' }}
                    >
                      {t('amount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map((item) => (
                    <tr key={item.id}>
                      <td className="border border-zinc-200 p-1 align-middle">
                        {item.imageId ? (
                          <div className="flex justify-center">
                            <Image
                              src={`/api/parts-image/${item.imageId}?v=2`}
                              alt={item.name}
                              width={44}
                              height={44}
                              unoptimized
                              className="h-11 w-11 rounded border border-zinc-200 object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-11 w-11 items-center justify-center text-xs text-zinc-400">—</div>
                        )}
                      </td>
                      <td className="border border-zinc-200 px-2 py-2 align-top">{item.name}</td>
                      <td className="border border-zinc-200 px-2 py-2 align-top">{item.specs.join(', ')}</td>
                      <td className="border border-zinc-200 px-2 py-2 text-right">{item.quantity}</td>
                      <td className="border border-zinc-200 px-2 py-2 text-right">
                        {formatter.format(item.unitPrice)}
                      </td>
                      <td
                        className="border border-zinc-200 px-2 py-2 text-right"
                        style={{ textAlign: 'right', paddingRight: '6px' }}
                      >
                        {formatter.format(item.quantity * item.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              className="mt-4 space-y-1 text-right text-sm"
              style={{ marginLeft: '6px', textAlign: 'right', paddingRight: '6px' }}
            >
              <p>
                {t('totalUnits')}: <span className="font-semibold">{totalUnits}</span>
              </p>
              <p>
                {t('totalAmount')}: <span className="font-semibold">{formatter.format(totalAmount)}</span>
              </p>
            </div>

            <div
              className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700"
              style={{ marginLeft: '6px', width: 'calc(100% - 6px)' }}
            >
              <p className="font-semibold" style={{ marginLeft: '6px' }}>{t('notes')}</p>
              <p className="mt-1 whitespace-pre-wrap" style={{ marginLeft: '6px' }}>{draft.notes || '-'}</p>
            </div>
          </section>
        </div>

        {feedback ? (
          <p
            className={`mx-auto mt-4 w-full max-w-[220mm] rounded-lg px-3 py-2 text-sm ${
              feedback.type === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {feedback.message}
          </p>
        ) : null}
      </main>

      <div className="fixed inset-x-0 bottom-20 z-[60] border-t border-stone-300/80 bg-stone-100/95 px-4 py-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="mx-auto flex w-full max-w-[220mm] flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push('/parts')}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <FileCheck2 className="h-4 w-4 shrink-0" />
            {t('backToEdit')}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleSavePdf}
              disabled={isSavingPdf}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-zinc-400 bg-white px-3 py-3 text-sm font-semibold text-zinc-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <Download className="h-4 w-4 shrink-0" strokeWidth={2} />
              {isSavingPdf ? t('generatingPdf') : t('savePdf')}
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold shadow-sm disabled:cursor-not-allowed"
              style={{
                backgroundColor: isSending ? '#a1a1aa' : '#18181b',
                color: '#ffffff',
              }}
            >
              <Send className="h-4 w-4 shrink-0 text-white" strokeWidth={2} />
              {isSending ? t('sendingOrder') : t('sendToFujimak')}
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
