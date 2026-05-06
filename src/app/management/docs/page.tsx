'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Download, Search } from 'lucide-react'
import Header from '@/components/Header'

type CompletedDocument = {
  id: string
  kind: 'maintenance_request' | 'maintenance_signed' | 'maintenance_invoice' | 'parts_invoice'
  request_id: string | null
  workflow_id: string | null
  store_id: string
  store_name: string
  title: string
  filename: string
  issued_at: string | null
  completed_at: string | null
  updated_at: string | null
  invoice_amount: number | null
  invoice_work_description: string | null
}

const FOLDER_ORDER: Array<CompletedDocument['kind']> = [
  'maintenance_request',
  'maintenance_signed',
  'maintenance_invoice',
  'parts_invoice',
]

const FOLDER_LABEL: Record<CompletedDocument['kind'], string> = {
  maintenance_request: 'Maintenance Request',
  maintenance_signed: 'Client Signed Report',
  maintenance_invoice: 'Maintenance Invoice',
  parts_invoice: 'Parts Invoice',
}

export default function ManagementDocsPage() {
  const [documents, setDocuments] = useState<CompletedDocument[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null)
  const [isBackfilling, setIsBackfilling] = useState(false)

  const loadDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/completed-documents?limit=500', { cache: 'no-store' })
      const json = (await res.json()) as {
        documents?: CompletedDocument[]
        warning?: string
        error?: string
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load documents')
      setDocuments(Array.isArray(json.documents) ? json.documents : [])
      setWarning(typeof json.warning === 'string' ? json.warning : null)
    } catch (err) {
      setDocuments([])
      setWarning(null)
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  const filteredDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return documents
    return documents.filter((doc) => {
      const target = [
        doc.kind,
        doc.store_name,
        doc.store_id,
        doc.title,
        doc.filename,
        doc.request_id || '',
        doc.workflow_id || '',
        doc.invoice_work_description || '',
      ]
        .join(' ')
        .toLowerCase()
      return target.includes(keyword)
    })
  }, [documents, search])

  const summary = useMemo(() => {
    const invoiceCount = documents.filter((doc) => doc.kind === 'maintenance_invoice' || doc.kind === 'parts_invoice').length
    const requestCount = documents.filter((doc) => doc.kind === 'maintenance_request').length
    const signedCount = documents.filter((doc) => doc.kind === 'maintenance_signed').length
    return { invoiceCount, requestCount, signedCount }
  }, [documents])

  const groupedDocuments = useMemo(() => {
    const map = new Map<CompletedDocument['kind'], CompletedDocument[]>()
    for (const kind of FOLDER_ORDER) map.set(kind, [])
    for (const doc of filteredDocuments) {
      map.get(doc.kind)?.push(doc)
    }
    return FOLDER_ORDER.map((kind) => ({
      kind,
      label: FOLDER_LABEL[kind],
      docs: map.get(kind) ?? [],
    }))
  }, [filteredDocuments])

  const getDocumentPreviewUrl = useCallback((doc: CompletedDocument) => {
    const identifier = doc.request_id || doc.workflow_id || ''
    if (!identifier) return ''
    if (doc.kind === 'maintenance_invoice') {
      return `/api/mechanic/invoice/reissue?requestId=${encodeURIComponent(identifier)}&inline=1&mode=invoice&filename=${encodeURIComponent(doc.filename)}`
    }
    if (doc.kind === 'maintenance_request' || doc.kind === 'maintenance_signed') {
      return `/api/mechanic/invoice/reissue?requestId=${encodeURIComponent(identifier)}&inline=1&mode=report&filename=${encodeURIComponent(doc.filename)}`
    }
    return `/api/parts-order/workflows/${encodeURIComponent(identifier)}/invoice/reissue?inline=1`
  }, [])

  const handleDownload = useCallback(async (doc: CompletedDocument) => {
    const identifier = doc.request_id || doc.workflow_id || ''
    if (!identifier) return
    setActionMessage(null)
    setDownloadingDocumentId(doc.id)
    try {
      const endpoint =
        doc.kind === 'parts_invoice'
          ? `/api/parts-order/workflows/${encodeURIComponent(identifier)}/invoice/reissue`
          : `/api/mechanic/invoice/reissue?requestId=${encodeURIComponent(identifier)}&mode=${doc.kind === 'maintenance_invoice' ? 'invoice' : 'report'}&filename=${encodeURIComponent(doc.filename)}`
      const res = await fetch(endpoint, { cache: 'no-store' })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error || 'Failed to download PDF')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const matched = disposition?.match(/filename="([^"]+)"/)
      const filename = matched?.[1] || doc.filename || `${doc.id}.pdf`
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.rel = 'noopener'
      anchor.click()
      URL.revokeObjectURL(url)
      setActionMessage(`Downloaded: ${filename}`)
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to download PDF')
    } finally {
      setDownloadingDocumentId(null)
    }
  }, [])

  const handleBackfill = useCallback(async () => {
    setActionMessage(null)
    setIsBackfilling(true)
    try {
      const res = await fetch('/api/completed-documents/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = (await res.json()) as {
        success?: boolean
        error?: string
        maintenanceArchived?: number
        partsArchived?: number
        skipped?: number
        totalArchived?: number
      }
      if (!res.ok || json.success !== true) {
        throw new Error(json.error || 'Failed to archive missing documents')
      }
      setActionMessage(
        `Backfill done: ${json.totalArchived ?? 0} archived (maintenance ${json.maintenanceArchived ?? 0}, parts ${json.partsArchived ?? 0}, skipped ${json.skipped ?? 0})`
      )
      await loadDocuments()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Failed to archive missing documents')
    } finally {
      setIsBackfilling(false)
    }
  }, [loadDocuments])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header showBack title="Docs Folder" />
      <main className="px-4 py-4 pb-8">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Archive className="w-4 h-4" />
              {`Docs Folder (${filteredDocuments.length})`}
            </h2>
            <div />
          </div>

          <div className="px-4 py-3 border-b border-gray-100 bg-white">
            <div className="flex items-center gap-2">
              <label className="relative block flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by store / request ID / order no / filename"
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleBackfill()}
                disabled={isBackfilling}
                className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-50"
                style={{ minWidth: '130px', minHeight: '38px' }}
              >
                {isBackfilling ? 'Archiving...' : 'Archive Missing'}
              </button>
            </div>
          </div>

          {error ? <div className="px-4 py-4 text-sm text-red-600">Failed to load documents: {error}</div> : null}
          {!error && warning ? (
            <div className="px-4 py-3 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">{warning}</div>
          ) : null}
          {!error ? (
            <div className="px-4 py-2 text-xs text-gray-600 bg-gray-50 border-b border-gray-100">
              Total files: {documents.length} / Invoices: {summary.invoiceCount} / Requests: {summary.requestCount} /
              Signed: {summary.signedCount}
            </div>
          ) : null}
          {!error && isLoading ? <div className="px-4 py-4 text-sm text-gray-500">Loading documents...</div> : null}
          {!error && !isLoading && filteredDocuments.length === 0 ? (
            <div className="px-4 py-5 text-sm text-gray-500">No completed documents found.</div>
          ) : null}

          {!error && !isLoading && filteredDocuments.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {groupedDocuments.map((group) => (
                <section key={group.kind} className="px-3 py-2.5">
                  <div className="mb-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                    {`docs/${group.label} (${group.docs.length})`}
                  </div>
                  {group.docs.length === 0 ? (
                    <p className="px-1 py-1 text-xs text-gray-400">No files in this folder.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100 rounded-md border border-gray-100 bg-white">
                      {group.docs.map((doc) => {
                        const identifier = doc.request_id || doc.workflow_id || '-'
                        const issuedAt = doc.issued_at || doc.completed_at || doc.updated_at
                        const previewUrl = getDocumentPreviewUrl(doc)
                        return (
                          <li key={doc.id} className="px-2 py-2.5">
                            <div className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-gray-800">
                                  {doc.store_name || doc.store_id || '-'} · {doc.title}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-gray-500">
                                  {group.label} · {identifier}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-gray-500">File: {doc.filename}</p>
                                <p className="mt-0.5 text-xs text-gray-500">
                                  Issued: {issuedAt ? new Date(issuedAt).toLocaleString() : '-'}
                                </p>
                                {doc.invoice_amount ? (
                                  <p className="mt-0.5 text-xs text-gray-600">
                                    Amount: PHP {doc.invoice_amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                                  </p>
                                ) : null}
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <a
                                  href={previewUrl || undefined}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block overflow-hidden rounded-md border border-gray-200 bg-white"
                                  style={{ width: '72px', height: '102px' }}
                                >
                                  {previewUrl ? (
                                    <iframe
                                      title={`pdf-preview-${doc.id}`}
                                      src={`${previewUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                                      className="h-full w-full"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-[10px] text-gray-500">
                                      No PDF
                                    </div>
                                  )}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => void handleDownload(doc)}
                                  disabled={downloadingDocumentId === doc.id || !previewUrl}
                                  className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                  style={{ minWidth: '124px', minHeight: '36px' }}
                                >
                                  <Download className="h-3 w-3" />
                                  {downloadingDocumentId === doc.id ? 'Downloading...' : 'Download PDF'}
                                </button>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          ) : null}

          {actionMessage ? (
            <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-700">{actionMessage}</p>
          ) : null}
        </div>
      </main>
    </div>
  )
}
