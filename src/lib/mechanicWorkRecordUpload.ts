import type { MaintenanceRequestRecord } from '@/lib/maintenance'

/** Vercel のサーバーレス・ボディ上限（約4.5MB）を避けるための分割基準（multipart オーバーヘッド込みで余裕） */
export const MECHANIC_WORK_RECORD_CHUNK_BYTES = 3_000_000

export type MechanicWorkRecordMediaItem = {
  file: File
  fileName: string
}

/** 分割アップロード時は先頭以外は progress に抑え、完了は最終チャンクだけ complete */
export function recordTypeForChunk(
  index: number,
  total: number,
  base: 'start' | 'progress' | 'complete'
): 'start' | 'progress' | 'complete' {
  if (total <= 1) return base
  if (base === 'start') return index === 0 ? 'start' : 'progress'
  if (base === 'complete') return index === total - 1 ? 'complete' : 'progress'
  return 'progress'
}

export function packMechanicMediaChunks(
  beforeMedia: MechanicWorkRecordMediaItem[],
  afterMedia: MechanicWorkRecordMediaItem[],
  maxBytes: number
): Array<{ before: MechanicWorkRecordMediaItem[]; after: MechanicWorkRecordMediaItem[] }> {
  type Tagged = { phase: 'before' | 'after'; item: MechanicWorkRecordMediaItem }
  const queue: Tagged[] = [
    ...beforeMedia.map((item) => ({ phase: 'before' as const, item })),
    ...afterMedia.map((item) => ({ phase: 'after' as const, item })),
  ]

  if (queue.length === 0) {
    return [{ before: [], after: [] }]
  }

  const chunks: Array<{ before: MechanicWorkRecordMediaItem[]; after: MechanicWorkRecordMediaItem[] }> = []
  let idx = 0

  while (idx < queue.length) {
    const before: MechanicWorkRecordMediaItem[] = []
    const after: MechanicWorkRecordMediaItem[] = []
    let used = 0

    while (idx < queue.length) {
      const next = queue[idx]
      if (!next) break
      const sz = next.item.file.size
      const chunkHasItems = before.length > 0 || after.length > 0

      if (chunkHasItems && used + sz > maxBytes) {
        break
      }

      if (!chunkHasItems && sz > maxBytes) {
        if (next.phase === 'before') before.push(next.item)
        else after.push(next.item)
        idx += 1
        break
      }

      used += sz
      if (next.phase === 'before') before.push(next.item)
      else after.push(next.item)
      idx += 1
    }

    chunks.push({ before, after })
  }

  return chunks
}

export async function postMechanicWorkRecordChunks(params: {
  requestId: string
  comment: string
  markCompleted: boolean
  recordTypeRaw: 'start' | 'progress' | 'complete'
  beforeMedia: MechanicWorkRecordMediaItem[]
  afterMedia: MechanicWorkRecordMediaItem[]
  mapError: (res: Response, json: { error?: string }) => string
  chunkBytes?: number
}): Promise<{ request: MaintenanceRequestRecord; recordedAt?: string }> {
  const maxBytes = params.chunkBytes ?? MECHANIC_WORK_RECORD_CHUNK_BYTES
  const chunks = packMechanicMediaChunks(params.beforeMedia, params.afterMedia, maxBytes)

  let lastJson: {
    request?: MaintenanceRequestRecord
    recordedAt?: string
    error?: string
  } | null = null

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i]
    if (!chunk) continue

    const formData = new FormData()
    formData.set('requestId', params.requestId)
    formData.set('comment', i === chunks.length - 1 ? params.comment : '')
    formData.set(
      'markCompleted',
      i === chunks.length - 1 && params.markCompleted ? 'true' : 'false'
    )
    formData.set('recordType', recordTypeForChunk(i, chunks.length, params.recordTypeRaw))
    formData.set('mediaAppendOnly', i > 0 ? 'true' : 'false')

    chunk.before.forEach((item) => {
      formData.append('beforeFiles', item.file, item.fileName)
    })
    chunk.after.forEach((item) => {
      formData.append('afterFiles', item.file, item.fileName)
    })

    const res = await fetch('/api/mechanic/work-record', {
      method: 'POST',
      body: formData,
    })

    const json = (await res.json().catch(() => ({}))) as {
      request?: MaintenanceRequestRecord
      recordedAt?: string
      error?: string
    }

    if (!res.ok || !json.request) {
      throw new Error(params.mapError(res, json))
    }

    lastJson = json
  }

  if (!lastJson?.request) {
    throw new Error('Work record upload returned no request')
  }

  return { request: lastJson.request, recordedAt: lastJson.recordedAt }
}
