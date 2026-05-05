import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import type { MaintenanceStatus } from '@/lib/maintenance'

export const runtime = 'nodejs'

type IncomingMedia = {
  mimeType: string
  bytes: Buffer
  name?: string
}

type MaintenanceAttachmentPayload = {
  name?: string
  type?: 'image' | 'video'
  source?: string
  url?: string
}

type RecordType = 'start' | 'progress' | 'complete'

const MEDIA_MIME_RE = /^(image|video)\//
const DEFAULT_WORK_MEDIA_MAX_FILE_MB = 120
const WORK_MEDIA_BUCKET_FILE_SIZE_LIMIT =
  (typeof process.env.FUJIMAK_WORK_MEDIA_BUCKET_SIZE_LIMIT === 'string' &&
    process.env.FUJIMAK_WORK_MEDIA_BUCKET_SIZE_LIMIT.trim()) ||
  '200MB'
const WORK_MEDIA_ALLOWED_MIME_TYPES = ['image/*', 'video/*']
const WORK_MEDIA_MAX_FILE_BYTES =
  Math.max(
    10,
    Number.parseInt(process.env.FUJIMAK_WORK_MEDIA_MAX_FILE_MB || '', 10) || DEFAULT_WORK_MEDIA_MAX_FILE_MB
  ) *
  1024 *
  1024

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const value = (error as { message?: unknown }).message
    if (typeof value === 'string' && value.length > 0) return value
  }
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

function parseBytesLimitText(text: string) {
  const normalized = text.trim().toUpperCase()
  const matched = normalized.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/)
  if (!matched) return null
  const amount = Number(matched[1])
  if (!Number.isFinite(amount) || amount <= 0) return null
  const unit = matched[2]
  const unitMap: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  }
  return Math.floor(amount * (unitMap[unit] || 1))
}

function pickExt(mimeType: string) {
  const raw = mimeType.split('/')[1] ?? 'bin'
  return raw.split(';')[0]?.replace(/[^a-zA-Z0-9]/g, '') || 'bin'
}

function parseMediaList(value: unknown): IncomingMedia[] {
  if (!Array.isArray(value)) return []
  const parsed: IncomingMedia[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as { mimeType?: unknown; data?: unknown; name?: unknown }
    const mimeType = asText(row.mimeType)
    const data = asText(row.data)
    const name = asText(row.name)
    if (!MEDIA_MIME_RE.test(mimeType) || !data) continue
    let bytes: Buffer
    try {
      bytes = Buffer.from(data, 'base64')
    } catch {
      continue
    }
    if (bytes.byteLength === 0) continue
    parsed.push({
      mimeType,
      bytes,
      name: name || undefined,
    })
  }
  return parsed
}

async function parseMediaListFromFormData(
  formData: FormData,
  fieldName: string,
  phase: 'before' | 'after'
) {
  const values = formData.getAll(fieldName)
  const parsed: IncomingMedia[] = []
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]
    if (!(value instanceof File)) continue
    const mimeType = asText(value.type)
    if (!MEDIA_MIME_RE.test(mimeType)) continue
    let bytes: Buffer
    try {
      bytes = Buffer.from(await value.arrayBuffer())
    } catch {
      continue
    }
    if (bytes.byteLength === 0) continue
    parsed.push({
      mimeType,
      bytes,
      name: asText(value.name) || `${phase}_${i + 1}`,
    })
  }
  return parsed
}

function parseAttachmentArray(value: unknown): MaintenanceAttachmentPayload[] {
  if (!Array.isArray(value)) return []
  const parsed: MaintenanceAttachmentPayload[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as {
      name?: unknown
      type?: unknown
      source?: unknown
      url?: unknown
    }
    const url = asText(row.url)
    if (!url) continue
    const typeRaw = asText(row.type)
    const type = typeRaw === 'video' ? 'video' : typeRaw === 'image' ? 'image' : undefined
    parsed.push({
      name: asText(row.name) || undefined,
      type,
      source: asText(row.source) || undefined,
      url,
    })
  }
  return parsed
}

/** Supabase API はバイト数のほうが確実（文字列 "200MB" が環境によって無視されると上限 0 扱いになり得る） */
function desiredWorkMediaBucketLimitBytes(): number {
  const parsed = parseBytesLimitText(String(WORK_MEDIA_BUCKET_FILE_SIZE_LIMIT).trim())
  if (parsed !== null && parsed > 0) return parsed
  return 209_715_200 // 200 MiB
}

async function ensureWorkMediaBucket(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const bucketName = 'maintenance-work-media'
  const limitBytes = desiredWorkMediaBucketLimitBytes()

  const { error: bucketError } = await supabase.storage.getBucket(bucketName)
  const message = typeof bucketError?.message === 'string' ? bucketError.message : ''

  if (bucketError && /not found|does not exist/i.test(message)) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: limitBytes,
      allowedMimeTypes: WORK_MEDIA_ALLOWED_MIME_TYPES,
    })
    if (createError) throw createError
  } else if (bucketError) {
    throw bucketError
  }

  const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
    public: true,
    fileSizeLimit: limitBytes,
    allowedMimeTypes: WORK_MEDIA_ALLOWED_MIME_TYPES,
  })
  if (updateError) throw updateError

  return bucketName
}

async function persistMedia(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  bucketName: string
  requestId: string
  phase: 'before' | 'after'
  media: IncomingMedia[]
}): Promise<{ saved: MaintenanceAttachmentPayload[]; error?: string }> {
  const { supabase, bucketName, requestId, phase, media } = params
  const safeMedia = media.slice(0, 8)
  const saved: MaintenanceAttachmentPayload[] = []
  const failures: string[] = []

  for (let i = 0; i < safeMedia.length; i++) {
    const item = safeMedia[i]
    if (!item) continue
    try {
      const bytes = item.bytes
      const label = `${phase} file #${i + 1}`
      if (bytes.byteLength > WORK_MEDIA_MAX_FILE_BYTES) {
        failures.push(
          `${label}: skipped (${bytes.byteLength} bytes > route max ${WORK_MEDIA_MAX_FILE_BYTES} bytes)`
        )
        continue
      }

      const ext = pickExt(item.mimeType)
      const objectPath = `${requestId}/${phase}/${Date.now()}_${i}.${ext}`
      const { error: uploadError } = await supabase.storage.from(bucketName).upload(objectPath, bytes, {
        contentType: item.mimeType,
        upsert: false,
      })
      if (uploadError) {
        failures.push(`${label} (${bytes.byteLength} bytes): ${uploadError.message}`)
        continue
      }

      const { data } = supabase.storage.from(bucketName).getPublicUrl(objectPath)
      if (!data?.publicUrl) {
        failures.push(`${label}: no public URL returned after upload`)
        continue
      }

      saved.push({
        name: item.name || `${phase}_${i + 1}`,
        type: item.mimeType.startsWith('video/') ? 'video' : 'image',
        source: `mechanic_${phase}`,
        url: data.publicUrl,
      })
    } catch (err) {
      failures.push(`${phase} file #${i + 1}: ${asErrorMessage(err)}`)
    }
  }

  if (safeMedia.length > 0 && saved.length === 0) {
    return {
      saved: [],
      error: [
        `Could not save any ${phase} media to Storage bucket "${bucketName}".`,
        failures.length > 0 ? failures.join(' · ') : 'No detailed errors (check bucket policies and Storage limits in Supabase).',
        'Note: Supabase may report "maximum allowed size" even when your file is small if the bucket/global Storage limit is misconfigured.',
      ].join(' '),
    }
  }

  return { saved }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let requestId = ''
    let comment = ''
    let markCompleted = false
    let recordTypeRaw = ''
    let beforeMedia: IncomingMedia[] = []
    let afterMedia: IncomingMedia[] = []
    let mediaAppendOnly = false

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      requestId = asText(formData.get('requestId'))
      comment = asText(formData.get('comment'))
      markCompleted = asText(formData.get('markCompleted')).toLowerCase() === 'true'
      recordTypeRaw = asText(formData.get('recordType'))
      mediaAppendOnly = asText(formData.get('mediaAppendOnly')).toLowerCase() === 'true'
      beforeMedia = await parseMediaListFromFormData(formData, 'beforeFiles', 'before')
      afterMedia = await parseMediaListFromFormData(formData, 'afterFiles', 'after')
    } else {
      const body = await request.json()
      requestId = asText(body?.requestId)
      comment = asText(body?.comment)
      markCompleted = body?.markCompleted === true
      recordTypeRaw = asText(body?.recordType)
      mediaAppendOnly = body?.mediaAppendOnly === true
      beforeMedia = parseMediaList(body?.beforeMedia)
      afterMedia = parseMediaList(body?.afterMedia)
    }

    const recordType: RecordType =
      recordTypeRaw === 'start' || recordTypeRaw === 'complete' ? recordTypeRaw : 'progress'

    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
    }
    if (beforeMedia.length === 0 && afterMedia.length === 0 && !comment) {
      return NextResponse.json({ error: 'At least one media or comment is required' }, { status: 400 })
    }
    if (!mediaAppendOnly && recordType === 'start' && beforeMedia.length === 0) {
      return NextResponse.json({ error: 'Before photo is required to save work start' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: current, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('id,status,attachments,remarks')
      .eq('id', requestId)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const bucketName = await ensureWorkMediaBucket(supabase)
    const uploadedBefore = await persistMedia({
      supabase,
      bucketName,
      requestId,
      phase: 'before',
      media: beforeMedia,
    })
    if (uploadedBefore.error) {
      return NextResponse.json({ error: uploadedBefore.error }, { status: 422 })
    }
    const uploadedAfter = await persistMedia({
      supabase,
      bucketName,
      requestId,
      phase: 'after',
      media: afterMedia,
    })
    if (uploadedAfter.error) {
      return NextResponse.json({ error: uploadedAfter.error }, { status: 422 })
    }

    const existingAttachments = parseAttachmentArray(current.attachments)
    const mergedAttachments = [...existingAttachments, ...uploadedBefore.saved, ...uploadedAfter.saved]

    const recordedAt = new Date().toISOString()
    const currentStatus = asText(current.status)
    const nextStatus: MaintenanceStatus =
      currentStatus === 'completed' ? 'completed' : 'in_progress'
    const noteTitle =
      recordType === 'start'
        ? '[Mechanic Work Start]'
        : markCompleted || recordType === 'complete'
          ? '[Mechanic Work Complete]'
          : '[Mechanic Work Record]'

    const noteBlock = mediaAppendOnly
      ? markCompleted
        ? [
            '[Mechanic Work Complete]',
            `RecordedAt: ${recordedAt}`,
            `AppendMedia · Before +${uploadedBefore.saved.length} · After +${uploadedAfter.saved.length}`,
            ...(comment.trim().length > 0 ? [`Comment: ${comment.trim()}`] : []),
          ].join('\n')
        : [
            '[Mechanic Work Record]',
            `RecordedAt: ${recordedAt}`,
            `AppendMedia · Before +${uploadedBefore.saved.length} · After +${uploadedAfter.saved.length}`,
            ...(comment.trim().length > 0 ? [`Comment: ${comment.trim()}`] : []),
          ].join('\n')
      : [
          noteTitle,
          `RecordedAt: ${recordedAt}`,
          recordType === 'start' ? `WorkStartedAt: ${recordedAt}` : '',
          `Status: ${nextStatus}`,
          `BeforeCount: ${uploadedBefore.saved.length}`,
          `AfterCount: ${uploadedAfter.saved.length}`,
          `Comment: ${comment || '-'}`,
        ]
          .filter((line) => line.length > 0)
          .join('\n')

    const currentRemarks = asText(current.remarks)
    const nextRemarks = currentRemarks ? `${currentRemarks}\n\n${noteBlock}` : noteBlock

    const patch: Record<string, unknown> = {
      attachments: mergedAttachments,
      remarks: nextRemarks,
      status: nextStatus,
      updated_at: recordedAt,
    }

    const { data, error } = await supabase
      .from('maintenance_requests')
      .update(patch)
      .eq('id', requestId)
      .select('*')
      .single()
    if (error) throw error

    if (nextStatus !== currentStatus) {
      const updateNote =
        recordType === 'start'
          ? 'Recorded mechanic work start evidence'
          : markCompleted || recordType === 'complete'
            ? 'Recorded mechanic work completion evidence'
            : 'Recorded mechanic work evidence'
      await supabase.from('maintenance_updates').insert({
        request_id: requestId,
        from_status: currentStatus || null,
        to_status: nextStatus,
        note: updateNote,
        actor: 'mechanic_portal',
      })
    }

    return NextResponse.json({
      request: data,
      recordedAt,
      recordType,
      uploaded: {
        before: uploadedBefore.saved.length,
        after: uploadedAfter.saved.length,
      },
    })
  } catch (error) {
    const message = asErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
