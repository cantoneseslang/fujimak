'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchMaintenanceRequests } from '@/lib/maintenance'
import { maintenanceQueryKey } from '@/hooks/useMaintenanceRequests'

const PORTAL_LIST_LIMIT = 220

/** Warm React Query cache for dashboard/history/mechanic shared maintenance list */
export default function PortalMaintenanceWarmCache() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let cancelled = false

    const warm = () => {
      if (cancelled) return
      try {
        const storeId = localStorage.getItem('selectedStoreId')?.trim()
        if (!storeId) return
        const query = { storeId, limit: PORTAL_LIST_LIMIT }
        void queryClient.prefetchQuery({
          queryKey: maintenanceQueryKey(query),
          queryFn: ({ signal }) => fetchMaintenanceRequests(query, signal),
        })
      } catch {
        /* ignore */
      }
    }

    let innerRaf = 0
    const outerRaf = window.requestAnimationFrame(() => {
      innerRaf = window.requestAnimationFrame(warm)
    })

    const idleHandle =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(() => warm(), { timeout: 3500 })
        : undefined

    const fallbackTimer =
      idleHandle === undefined ? window.setTimeout(() => warm(), 700) : undefined

    window.addEventListener('focus', warm)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(outerRaf)
      if (innerRaf !== 0) window.cancelAnimationFrame(innerRaf)
      if (idleHandle !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle)
      }
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer)
      window.removeEventListener('focus', warm)
    }
  }, [queryClient])

  return null
}
