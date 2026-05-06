'use client'

import { useEffect, useRef } from 'react'
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

/**
 * Keeps localStorage in sync with the locale cookie; if the cookie disappears but we have a stored choice,
 * one redirect per tab session restores /api/locale (avoids silent fallback to defaultLocale).
 */
export default function LocalePersistence() {
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const cookieLoc = readCookieLocale()
    if (cookieLoc) {
      localStorage.setItem(FUJIMAK_LOCALE_STORAGE_KEY, cookieLoc)
      sessionStorage.removeItem(SESSION_RECOVER_KEY)
      return
    }

    const raw = localStorage.getItem(FUJIMAK_LOCALE_STORAGE_KEY)
    const storedOk = raw && locales.includes(raw as Locale) ? (raw as Locale) : null
    if (!storedOk) return

    if (sessionStorage.getItem(SESSION_RECOVER_KEY)) return
    sessionStorage.setItem(SESSION_RECOVER_KEY, '1')

    const redirectTo = `${window.location.pathname}${window.location.search}`
    window.location.replace(
      `/api/locale?locale=${encodeURIComponent(storedOk)}&redirect=${encodeURIComponent(redirectTo)}`
    )
  }, [])

  return null
}
