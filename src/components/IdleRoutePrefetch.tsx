'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Main portal routes; prefetched early so navigations hit warm chunks */
const ROUTES_TO_PREFETCH = [
  '/dashboard',
  '/maintenance',
  '/management',
  '/history',
  '/notifications',
  '/settings',
  '/manual',
  '/troubleshooting',
  '/parts',
  '/support',
  '/stores',
  '/mechanic',
  '/mechanic/board',
  '/vendor',
]

export default function IdleRoutePrefetch() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    const prefetchAll = () => {
      if (cancelled) return
      for (const path of ROUTES_TO_PREFETCH) {
        try {
          router.prefetch(path)
        } catch {
          /* ignore prefetch failures */
        }
      }
    }

    let innerRaf = 0
    const outerRaf = window.requestAnimationFrame(() => {
      innerRaf = window.requestAnimationFrame(prefetchAll)
    })

    let idleHandle: number | undefined
    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(prefetchAll, { timeout: 3500 })
    }

    const fallbackTimer = idleHandle === undefined ? window.setTimeout(prefetchAll, 600) : undefined

    return () => {
      cancelled = true
      window.cancelAnimationFrame(outerRaf)
      if (innerRaf !== 0) window.cancelAnimationFrame(innerRaf)
      if (idleHandle !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle)
      }
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer)
    }
  }, [router])

  return null
}
