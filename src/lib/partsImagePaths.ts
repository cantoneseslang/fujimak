import { promises as fs } from 'fs'
import path from 'path'

/** Local asset paths for parts photos (served by /api/parts-image/[imageId]) */
export const PARTS_IMAGE_PATHS: Record<string, string> = {
  'flat-grid-wide': 'flat-grid-wide.png',
  'flat-grid-alt': 'flat-grid-alt.png',
  'oven-pan-dark': 'oven-pan-dark.png',
  'oven-pan-dark-alt': 'oven-pan-dark-alt.png',
  'oven-pan-deep': 'oven-pan-deep.png',
  'grooved-pan-blue': 'grooved-pan-blue.png',
  'grooved-pan-blue-alt': 'grooved-pan-blue-alt.png',
  'curved-grid': 'curved-grid.png',
}

export function getPartsImagePath(imageId: string | undefined): string | null {
  if (!imageId) return null
  const fileName = PARTS_IMAGE_PATHS[imageId]
  if (!fileName) return null
  return path.join(process.cwd(), 'public', 'parts-images', fileName)
}

/** Data URI for inline email thumbnails */
export async function readPartsImageDataUri(imageId: string | undefined): Promise<string | null> {
  const filePath = getPartsImagePath(imageId)
  if (!filePath) return null
  try {
    const buffer = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mime =
      ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}
