'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef } from 'react'
import {
  consumePendingIntent,
  exportNavTimingJson,
  markInternalNavIntent,
  pushNavTiming,
} from '@/lib/navTiming'

export default function NavigationTimingLogger({ enabled }: { enabled: boolean }) {
  const pathname = usePathname()
  const prevPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const w = window as Window & { __FUJIMAK_EXPORT_NAV_TIMING__?: () => string }
    w.__FUJIMAK_EXPORT_NAV_TIMING__ = () => exportNavTimingJson()
    return () => {
      delete w.__FUJIMAK_EXPORT_NAV_TIMING__
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target as Element | null
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (href.startsWith('#')) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      markInternalNavIntent()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [enabled])

  useLayoutEffect(() => {
    if (!enabled) return

    const from = prevPathRef.current
    if (prevPathRef.current === null) {
      prevPathRef.current = pathname
      return
    }
    prevPathRef.current = pathname

    if (from === pathname) return

    const intentAt = consumePendingIntent()
    let cancelled = false

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled || typeof performance === 'undefined') return
        const paintAt = performance.now()
        const intentToPaintMs = intentAt != null ? paintAt - intentAt : null
        pushNavTiming({
          from,
          to: pathname,
          intentToPaintMs,
          ts: Date.now(),
        })
      })
    })

    return () => {
      cancelled = true
    }
  }, [enabled, pathname])

  return null
}
