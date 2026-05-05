/**
 * Compress photos before mechanic FormData upload so requests stay under typical
 * platform limits (e.g. ~4.5MB serverless body) and Storage bucket limits.
 */

const TARGET_MAX_BYTES = 450 * 1024
const INITIAL_MAX_EDGE = 2048
const MIN_MAX_EDGE = 720
const OUTPUT_TYPE = 'image/jpeg'

function replaceExtension(filename: string, extWithDot: string) {
  const trimmed = filename.trim() || 'photo'
  const withoutExt = trimmed.replace(/\.[^/.]+$/, '')
  return `${withoutExt || 'photo'}${extWithDot}`
}

export function shouldSkipMechanicImageCompress(file: File) {
  const type = file.type.toLowerCase()
  if (!type.startsWith('image/')) return true
  if (type === 'image/gif' || type === 'image/svg+xml') return true
  return false
}

/**
 * Returns a JPEG File usually under ~450KB for upload; falls back to original on failure
 * or when compression does not shrink the payload.
 */
export async function compressImageForMechanicUpload(file: File): Promise<File> {
  if (shouldSkipMechanicImageCompress(file)) return file
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }

  let maxEdge = INITIAL_MAX_EDGE
  let quality = 0.85
  let bestBlob: Blob | null = null
  let bestSize = Infinity

  try {
    for (let iter = 0; iter < 20; iter += 1) {
      const bw = bitmap.width
      const bh = bitmap.height
      const scale = Math.min(1, maxEdge / Math.max(bw, bh))
      const w = Math.max(1, Math.round(bw * scale))
      const h = Math.max(1, Math.round(bh * scale))
      canvas.width = w
      canvas.height = h
      ctx.drawImage(bitmap, 0, 0, w, h)

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), OUTPUT_TYPE, quality)
      })
      if (!blob) break

      if (blob.size <= TARGET_MAX_BYTES) {
        bestBlob = blob
        break
      }
      if (blob.size < bestSize) {
        bestSize = blob.size
        bestBlob = blob
      }

      if (quality > 0.48) {
        quality -= 0.06
      } else if (maxEdge > MIN_MAX_EDGE) {
        maxEdge = Math.floor(maxEdge * 0.82)
      } else {
        quality = Math.max(0.4, quality - 0.05)
        if (quality <= 0.4) break
      }
    }
  } finally {
    bitmap.close()
  }

  if (!bestBlob || bestBlob.size >= file.size) return file

  return new File([bestBlob], replaceExtension(file.name, '.jpg'), {
    type: OUTPUT_TYPE,
    lastModified: Date.now(),
  })
}
