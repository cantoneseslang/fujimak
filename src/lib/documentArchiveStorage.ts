import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

const DEFAULT_ARCHIVE_BUCKET = 'maintenance-document-archive'

function env(value: string | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function asErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

export function getArchiveBucketName() {
  return env(process.env.FUJIMAK_ARCHIVE_BUCKET) || DEFAULT_ARCHIVE_BUCKET
}

export async function ensureArchiveBucket(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const bucketName = getArchiveBucketName()
  const { error: bucketError } = await supabase.storage.getBucket(bucketName)
  if (!bucketError) return bucketName

  const message = asErrorMessage(bucketError)
  if (/not found|does not exist/i.test(message)) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: '20MB',
      allowedMimeTypes: ['application/pdf'],
    })
    if (createError) throw createError
    return bucketName
  }

  throw bucketError
}

export function maintenanceInvoiceArchivePath(requestId: string, filename: string) {
  return `maintenance/${sanitizeSegment(requestId)}/${sanitizeSegment(filename)}`
}

export function partsInvoiceArchivePath(workflowId: string, filename: string) {
  return `parts/${sanitizeSegment(workflowId)}/${sanitizeSegment(filename)}`
}

export async function uploadArchivedPdf(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  objectPath: string
  buffer: Buffer
}) {
  const bucketName = await ensureArchiveBucket(params.supabase)
  const { error } = await params.supabase.storage.from(bucketName).upload(params.objectPath, params.buffer, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (error) throw error
  return { bucketName, objectPath: params.objectPath }
}

export async function tryDownloadArchivedPdf(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>
  objectPath: string
}) {
  const bucketName = getArchiveBucketName()
  const { data, error } = await params.supabase.storage.from(bucketName).download(params.objectPath)
  if (error || !data) return null
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
