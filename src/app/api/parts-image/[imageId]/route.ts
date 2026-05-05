import { promises as fs } from 'fs'
import path from 'path'
import { getPartsImagePath } from '@/lib/partsImagePaths'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  try {
    const { imageId } = await params
    const filePath = getPartsImagePath(imageId)
    if (!filePath) {
      return new Response('Image not found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const buffer = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const contentType = ext === '.png' ? 'image/png' : 'application/octet-stream'

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new Response('Failed to load image', {
      status: 500,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
