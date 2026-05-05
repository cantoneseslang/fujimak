/** Rows parsed from maintenance_requests.attachments JSON */
export type EvidenceAttachmentRow = {
  name: string
  type: 'image' | 'video'
  source: string
  url: string
}

/**
 * Mechanic work uploads use object paths `{requestId}/{before|after}/{timestamp}_…`.
 * Prefer inferring phase from the URL so previews/PDF stay correct even when JSON `source` is wrong.
 */
export function inferWorkMediaPhaseFromUrl(url: string, requestId: string): 'before' | 'after' | null {
  const id = requestId.trim()
  if (!id || !url) return null

  let decoded = url
  try {
    decoded = decodeURIComponent(url.replace(/\+/g, ' '))
  } catch {
    decoded = url
  }

  const variants = [url, decoded]
  const idLower = id.toLowerCase()

  for (const raw of variants) {
    const norm = raw.replace(/\\/g, '/').toLowerCase()
    if (norm.includes(`/${idLower}/after/`)) return 'after'
    if (norm.includes(`/${idLower}/before/`)) return 'before'
  }
  return null
}

/** `persistMedia` uses `{Date.now()}_{i}_{random}.{ext}` — parse leading millis for ordering */
export function workMediaFilenameTimestamp(url: string): number {
  const seg = url.split('/').pop() ?? ''
  const noQuery = seg.split('?')[0] ?? seg
  const base = noQuery.includes('.') ? noQuery.slice(0, noQuery.lastIndexOf('.')) : noQuery
  const head = base.split('_')[0] ?? ''
  const n = Number(head)
  return Number.isFinite(n) && n > 1_000_000_000_000 ? n : 0
}

export function classifyMechanicEvidenceAttachment(
  row: EvidenceAttachmentRow,
  requestId: string
): 'mechanic_before' | 'mechanic_after' | null {
  const phase = inferWorkMediaPhaseFromUrl(row.url, requestId)
  if (phase === 'before') return 'mechanic_before'
  if (phase === 'after') return 'mechanic_after'
  if (row.source === 'mechanic_before') return 'mechanic_before'
  if (row.source === 'mechanic_after') return 'mechanic_after'
  return null
}

export function partitionMechanicEvidenceByType(
  rows: EvidenceAttachmentRow[],
  requestId: string,
  mediaType: 'image' | 'video'
): { before: EvidenceAttachmentRow[]; after: EvidenceAttachmentRow[] } {
  const matches = rows.filter((r) => r.type === mediaType)
  const before: EvidenceAttachmentRow[] = []
  const after: EvidenceAttachmentRow[] = []

  for (const r of matches) {
    const bucket = classifyMechanicEvidenceAttachment(r, requestId)
    if (bucket === 'mechanic_before') before.push(r)
    else if (bucket === 'mechanic_after') after.push(r)
  }

  const byUploadedAt = (a: EvidenceAttachmentRow, b: EvidenceAttachmentRow) =>
    workMediaFilenameTimestamp(a.url) - workMediaFilenameTimestamp(b.url)

  before.sort(byUploadedAt)
  after.sort(byUploadedAt)

  return { before, after }
}
