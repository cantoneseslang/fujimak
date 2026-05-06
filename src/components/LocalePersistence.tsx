'use client'

import { useEffect } from 'react'
import {
  FUJIMAK_LOCALE_STORAGE_KEY,
  locales,
  type Locale,
} from '@/i18n/config'

const SESSION_RECOVER_KEY = 'fujimak-locale-recover-once'

function readCookieLocale(): Locale | null {
  const m = typeof document !== 'undefined' ? document.cookie.match(/(?:^|;)\s*locale=([^;]+)/) : null
  if (!m?.[1]) return null
  try {
    const v = decodeURIComponent(m[1].trim())
    return locales.includes(v as Locale) ? (v as Locale) : null
  } catch {
    return null
  }
}

function persistCookieToStorage(cookieLoc: Locale) {
  localStorage.setItem(FUJIMAK_LOCALE_STORAGE_KEY, cookieLoc)
  sessionStorage.removeItem(SESSION_RECOVER_KEY)
}

/**
 * Cookie→localStorage の同期。Cookie が初描画でまだ見えないことがあるため短い遅延後に再チェックし、
 * それでも無いときだけ（タブにつき一度）localStorage から /api/locale で復旧する。
 */
export default function LocalePersistence() {
  useEffect(() => {
    let cancelled = false

    const tryRecoverFromStorage = () => {
      const raw = localStorage.getItem(FUJIMAK_LOCALE_STORAGE_KEY)
      const storedOk = raw && locales.includes(raw as Locale) ? (raw as Locale) : null
      if (!storedOk) return

      if (sessionStorage.getItem(SESSION_RECOVER_KEY)) return
      sessionStorage.setItem(SESSION_RECOVER_KEY, '1')

      const redirectTo = `${window.location.pathname}${window.location.search}`
      window.location.replace(
        `/api/locale?locale=${encodeURIComponent(storedOk)}&redirect=${encodeURIComponent(redirectTo)}`
      )
    }

    const tick = (allowRecover: boolean) => {
      if (cancelled) return
      const cookieLoc = readCookieLocale()
      if (cookieLoc) {
        persistCookieToStorage(cookieLoc)
        return
      }
      if (allowRecover) tryRecoverFromStorage()
    }

    tick(false)
    const id = window.setTimeout(() => tick(true), 280)

    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [])

  return null
}
