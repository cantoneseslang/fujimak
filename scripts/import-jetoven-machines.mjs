#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_URL = 'https://fujimak.meclib.jp/library/books/JetOven/book'
const PAGE_COUNT = 28
const OUT_DIR = join(process.cwd(), 'out', 'jetoven', 'import')
const PAGE_DIR = join(OUT_DIR, 'pages')
const OCR_DIR = join(OUT_DIR, 'ocr')

const KNOWN_MODELS = [
  'FGJOB5Z',
  'FGJOB5DZ',
  'FGJOB5WZ',
  'FGJOB5WDZ',
  'FGJOB7Z',
  'FGJOB7DZ',
  'FGJOB7WZ',
  'FGJOB7WDZ',
  'FGJOA9',
  'FGJOA9H',
  'FGJOB10',
  'FGJOA5',
  'FGJOA5D',
  'FGJOA5W',
  'FGJOA5WD',
  'FGJOA7',
  'FGJOA7D',
  'FGJOA7W',
  'FGJOA7WD',
  'FGJOA30NR',
  'FGJOA50NR',
  'FGJOA70NR',
]

mkdirSync(PAGE_DIR, { recursive: true })
mkdirSync(OCR_DIR, { recursive: true })

const fetchText = async (url) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`)
  }
  return await res.text()
}

const fetchJson = async (url) => JSON.parse(await fetchText(url))

const writeJson = (fileName, data) => {
  const outPath = join(OUT_DIR, fileName)
  writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8')
  return outPath
}

const normalizeModel = (raw) =>
  raw
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]/g, '')
    .replaceAll('FGJ0', 'FGJO')

const extractModelsFromText = (text) => {
  const regex = /FGJ[O0][A-Z0-9]{2,}/g
  const found = new Set()
  for (const match of text.match(regex) ?? []) {
    const normalized = normalizeModel(match)
    if (normalized.length < 6) continue
    found.add(normalized)
  }
  return Array.from(found)
}

const inferSeries = (text) => {
  const lower = text.toLowerCase()
  if (lower.includes('long series')) return 'long'
  if (lower.includes('compact series')) return 'compact'
  if (lower.includes('standard series')) return 'standard'
  if (lower.includes('pizza')) return 'pizza'
  if (lower.includes('energy-saving')) return 'energy-saving'
  return 'unknown'
}

const run = async () => {
  const [bookMeta, bookIndex] = await Promise.all([
    fetchJson(`${BASE_URL}/data/book.txt`),
    fetchJson(`${BASE_URL}/data/book_index.txt`),
  ])

  const pageRecords = []
  const failures = []

  for (let pageNo = 1; pageNo <= PAGE_COUNT; pageNo += 1) {
    const pageName = String(pageNo).padStart(4, '0')
    const imagePath = join(PAGE_DIR, `${pageName}.jpg`)
    const ocrBase = join(OCR_DIR, pageName)
    const ocrTextPath = `${ocrBase}.txt`
    try {
      const imageRes = await fetch(`${BASE_URL}/jpg/${pageName}.jpg`)
      if (!imageRes.ok) {
        throw new Error(`image fetch failed: ${imageRes.status}`)
      }
      const imageBuffer = Buffer.from(await imageRes.arrayBuffer())
      writeFileSync(imagePath, imageBuffer)

      execFileSync('tesseract', [imagePath, ocrBase, '-l', 'eng+jpn', '--psm', '6'], {
        stdio: 'ignore',
      })

      const text = readFileSync(ocrTextPath, 'utf8')
      const compact = text.replaceAll(/\s+/g, ' ').trim()
      const modelCodes = extractModelsFromText(text)
      pageRecords.push({
        pageNo,
        summary: compact.slice(0, 280),
        chars: compact.length,
        seriesHint: inferSeries(text),
        modelCodes,
      })
      if (compact.length < 30) {
        failures.push({ pageNo, reason: 'too-few-ocr-chars', chars: compact.length })
      }
    } catch (error) {
      failures.push({
        pageNo,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const modelsByPage = new Map(pageRecords.map((record) => [record.pageNo, record.modelCodes]))
  const pageMaster = Array.from({ length: PAGE_COUNT }, (_, i) => {
    const pageNo = i + 1
    const fromIndex = bookIndex.find((row) => Number(row.link_page_no) === pageNo)
    return {
      pageNo,
      title: fromIndex?.name ?? `JetOven page ${pageNo}`,
      summary: pageRecords.find((row) => row.pageNo === pageNo)?.summary ?? '',
      detectedModels: modelsByPage.get(pageNo) ?? [],
    }
  })

  const extractedModels = new Set()
  for (const page of pageMaster) {
    for (const model of page.detectedModels) {
      extractedModels.add(model)
    }
  }
  for (const known of KNOWN_MODELS) extractedModels.add(known)

  const machineMaster = Array.from(extractedModels)
    .sort()
    .map((modelCode) => {
      const sourcePageNos = pageMaster
        .filter((page) => page.detectedModels.includes(modelCode))
        .map((page) => page.pageNo)
      return {
        modelCode,
        sourcePageNos,
        sourceTitles: pageMaster
          .filter((page) => page.detectedModels.includes(modelCode))
          .map((page) => page.title),
      }
    })

  const outputs = {
    source: writeJson('jetoven-source.json', { bookMeta, bookIndex }),
    ocr: writeJson('jetoven-ocr-pages.json', pageRecords),
    pages: writeJson('jetoven-page-master.json', pageMaster),
    machines: writeJson('jetoven-machine-master.json', machineMaster),
    failures: writeJson('jetoven-failures.json', failures),
  }

  console.log(JSON.stringify({ outputs, pageCount: PAGE_COUNT, failureCount: failures.length }, null, 2))
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
