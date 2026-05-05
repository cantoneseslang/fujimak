import { defaultLocale, type Locale } from './config'

function mapLanguageTagToLocale(tag: string): Locale | null {
  const normalized = tag.trim().toLowerCase().replace(/_/g, '-')
  if (!normalized) return null
  const primary = normalized.split('-')[0] ?? normalized

  if (primary === 'zh') return 'zh'
  if (primary === 'ja') return 'ja'
  if (primary === 'fil' || primary === 'tl') return 'tl'
  if (primary === 'en') return 'en'

  return null
}

/**
 * ブラウザの Accept-Language を、アプリ対応ロケール 1 つに畳む。
 * Cookie が無い「初回」フォールバック専用（以降は locale Cookie で固定）。
 */
export function negotiateLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header?.trim()) return defaultLocale

  type Entry = { tag: string; q: number }
  const entries: Entry[] = []

  for (const segment of header.split(',')) {
    const trimmed = segment.trim()
    if (!trimmed) continue
    const [langPart, ...params] = trimmed.split(';')
    const tag = langPart.trim()
    if (!tag) continue
    let q = 1
    for (const p of params) {
      const [k, rawV] = p.split('=').map((s) => s.trim())
      if (k === 'q') {
        const n = Number.parseFloat(rawV ?? '')
        if (Number.isFinite(n)) q = n
      }
    }
    entries.push({ tag, q })
  }

  entries.sort((a, b) => b.q - a.q)

  for (const { tag } of entries) {
    const mapped = mapLanguageTagToLocale(tag)
    if (mapped) return mapped
  }

  return defaultLocale
}
