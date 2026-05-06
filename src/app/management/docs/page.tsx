'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ChevronRight, Search } from 'lucide-react'
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
  archive_bucket?: string | null
  archive_path?: string | null
}

const KIND_FOLDER_MAP: Record<CompletedDocument['kind'], string> = {
  maintenance_request: 'maintenance/requests',
  maintenance_signed: 'maintenance/signed',
  maintenance_invoice: 'maintenance/invoices',
  parts_invoice: 'parts/invoices',
}

const MAINTENANCE_FOLDERS = [
  { folder: 'maintenance/requests', slug: 'maintenance_request', label: 'Maintenance Request' },
  { folder: 'maintenance/signed', slug: 'maintenance_signed', label: 'Client Signed Report' },
  { folder: 'maintenance/invoices', slug: 'maintenance_invoice', label: 'Maintenance Invoice' },
] as const

export default function ManagementDocsPage() {
  const [documents, setDocuments] = useState<CompletedDocument[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [actionMessage, setActionMessage] = useState<string | null>(null)
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
        doc.archive_path || '',
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
    const map = new Map<string, CompletedDocument[]>()
    for (const doc of filteredDocuments) {
      const folder = KIND_FOLDER_MAP[doc.kind] || `fallback/${doc.kind}`
      if (!map.has(folder)) map.set(folder, [])
      map.get(folder)?.push(doc)
    }

    return MAINTENANCE_FOLDERS.map(({ folder, slug, label }) => ({
      folder,
      heading: `${slug} | ${label}`,
      docs: map.get(folder) ?? [],
    }))
  }, [filteredDocuments])

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
          {!error && !isLoading && documents.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">No completed documents in the index yet.</div>
          ) : null}
          {!error && !isLoading ? (
            <div className="divide-y divide-gray-100 px-3 py-2">
              {groupedDocuments.map((group) => (
                <details key={group.folder} className="group border-b border-gray-100 py-2 last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold text-gray-800 marker:hidden [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-90" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{group.heading}</span>
                    <span className="shrink-0 tabular-nums text-xs font-normal text-gray-500">({group.docs.length})</span>
                  </summary>
                  {group.docs.length === 0 ? (
                    <p className="px-2 pb-2 pl-8 text-xs text-gray-500">No files in this folder.</p>
                  ) : null}
                </details>
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
