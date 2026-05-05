'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/Header'
import type { MaintenanceRequestRecord } from '@/lib/maintenance'
import { partitionMechanicEvidenceByType } from '@/lib/mechanicEvidenceFromAttachments'

type WorkAttachment = {
  name: string
  type: 'image' | 'video'
  source: string
  url: string
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseAmount(value: string) {
  const normalized = value.replace(/,/g, '').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function parseAttachments(input: unknown): WorkAttachment[] {
  if (!Array.isArray(input)) return []
  return input
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null
      const row = entry as { name?: unknown; type?: unknown; source?: unknown; url?: unknown }
      const url = asText(row.url)
      if (!url) return null
      return {
        name: asText(row.name) || `attachment_${index + 1}`,
        type: asText(row.type) === 'video' ? 'video' : 'image',
        source: asText(row.source) || 'unknown',
        url,
      } satisfies WorkAttachment
    })
    .filter((value): value is WorkAttachment => value !== null)
}

function getLatestByLabel(remarks: string | null, label: string) {
  const text = asText(remarks)
  if (!text) return ''
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = [...text.matchAll(new RegExp(`${escaped}:\\s*([^\\n\\r]+)`, 'g'))]
  if (matches.length === 0) return ''
  return matches[matches.length - 1]?.[1]?.trim() || ''
}

export default function ManagementInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestId = searchParams.get('requestId') || ''

  const [loading, setLoading] = useState(true)
  const [record, setRecord] = useState<MaintenanceRequestRecord | null>(null)
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [workDescription, setWorkDescription] = useState('')
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (!requestId) {
      setLoading(false)
      return
    }
    const load = async () => {
      try {
        const response = await fetch(`/api/maintenance/${encodeURIComponent(requestId)}`, { cache: 'no-store' })
        const json = (await response.json()) as { request?: MaintenanceRequestRecord; error?: string }
        if (!response.ok || !json.request) {
          throw new Error(json.error || 'Failed to load maintenance request')
        }
        setRecord(json.request)
        setWorkDescription(
          getLatestByLabel(json.request.remarks, 'Comment') || asText(json.request.symptom) || asText(json.request.fault_location)
        )
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'Failed to load maintenance request')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [requestId])

  const beforeImages = useMemo(() => {
    const rows = parseAttachments(record?.attachments)
    const id = asText(record?.id)
    return partitionMechanicEvidenceByType(rows, id, 'image').before
  }, [record?.attachments, record?.id])

  const formattedAmount = useMemo(() => {
    const parsed = parseAmount(invoiceAmount)
    if (parsed === null) return 'PHP -'
    return `PHP ${parsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }, [invoiceAmount])

  const finalizeInvoice = async () => {
    if (!record?.id) return
    const parsedAmount = parseAmount(invoiceAmount)
    if (parsedAmount === null) {
      setFeedback('Please enter invoice amount.')
      return
    }
    setFeedback(null)
    setIsFinalizing(true)
    try {
      const response = await fetch('/api/mechanic/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: record.id,
          issuedBy: 'management_portal',
          invoiceAmount: parsedAmount,
          invoiceWorkDescription: workDescription,
        }),
      })
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error || 'Failed to finalize invoice')
      }
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition')
      const matched = disposition?.match(/filename="([^"]+)"/)
      const filename = matched?.[1] || 'mechanic-invoice.pdf'
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.rel = 'noopener'
      anchor.click()
      URL.revokeObjectURL(url)
      router.push('/management')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Failed to finalize invoice')
    } finally {
      setIsFinalizing(false)
    }
  }

  if (!requestId) {
    return (
      <div className="min-h-screen bg-stone-200">
        <Header showBack title="Invoice Editor" />
        <main className="px-4 py-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Missing requestId.
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-200 pb-32">
      <Header showBack title="Invoice Editor" />
      <main className="px-3 py-5 sm:px-4 sm:py-6">
        {loading ? (
          <div className="mx-auto max-w-[220mm] rounded-xl bg-white p-6 text-sm text-zinc-600 shadow-sm">Loading...</div>
        ) : record ? (
          <div className="mx-auto flex w-full max-w-[220mm] justify-center">
            <section className="flex min-h-[min(85vh,297mm)] w-full max-w-[210mm] flex-col rounded-sm border border-zinc-300/90 bg-white p-6 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25),0_4px_16px_-4px_rgba(0,0,0,0.12)] sm:min-h-[297mm] sm:p-8 md:p-10">
              <div className="mb-6 border-b border-zinc-200 pb-4">
                <p className="text-center text-sm font-semibold tracking-wide text-zinc-700">
                  FUJIMAK PHILIPPINES CORPORATION
                </p>
                <h1 className="text-center text-lg font-bold tracking-tight text-zinc-900 sm:text-xl">INVOICE</h1>
                <div className="mt-2 flex flex-col items-end gap-1">
                  <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                    {new Date().toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="mb-4 grid gap-2 text-sm text-zinc-700">
                <p><span className="font-semibold">Request ID:</span> {record.id}</p>
                <p><span className="font-semibold">Store:</span> {record.store_name || record.store_id}</p>
                <p><span className="font-semibold">Machine:</span> {record.machine_name || record.machine_model || '-'}</p>
                <p><span className="font-semibold">Model / Serial:</span> {record.machine_model || '-'} / {record.machine_serial || '-'}</p>
                <p><span className="font-semibold">Fault Location:</span> {record.fault_location || '-'}</p>
                <p><span className="font-semibold">Symptom:</span> {record.symptom || '-'}</p>
              </div>

              {beforeImages.length > 0 ? (
                <div className="mb-5">
                  <p className="mb-2 text-sm font-semibold text-zinc-800">Before Photos</p>
                  <div className="grid grid-cols-2 gap-3">
                    {beforeImages.slice(-4).map((image) => (
                      <div key={image.url} className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.url} alt={image.name} className="h-28 w-full object-contain bg-white" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm font-semibold text-zinc-900">Editable Invoice Fields</p>
                <div className="mt-3 grid gap-3">
                  <label className="text-sm text-zinc-700">
                    <span className="mb-1 block font-medium">Invoice amount *</span>
                    <input
                      value={invoiceAmount}
                      onChange={(event) => setInvoiceAmount(event.target.value)}
                      placeholder="e.g. 3500"
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900"
                    />
                  </label>
                  <label className="text-sm text-zinc-700">
                    <span className="mb-1 block font-medium">Work description</span>
                    <textarea
                      value={workDescription}
                      onChange={(event) => setWorkDescription(event.target.value)}
                      rows={5}
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-900"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4">
                <p className="text-sm text-zinc-500">Invoice Amount</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900">{formattedAmount}</p>
                <p className="mt-4 text-sm text-zinc-500">Work Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-900">{asText(workDescription) || '-'}</p>
              </div>
            </section>
          </div>
        ) : null}

        {feedback ? (
          <p className="mx-auto mt-4 w-full max-w-[220mm] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {feedback}
          </p>
        ) : null}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-stone-300/80 bg-stone-100/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[220mm] gap-2">
          <button
            type="button"
            onClick={() => router.push('/management')}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 shadow-sm"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => void finalizeInvoice()}
            disabled={isFinalizing}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            style={{ backgroundColor: '#18181b' }}
          >
            {isFinalizing ? 'Saving...' : 'Finalize Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}
