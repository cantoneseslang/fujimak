'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import {
  exportNavTimingJson,
  getNavTimingReport,
  markInternalNavIntent,
  NAV_TIMING_SHELL_BUDGET_MS,
  summarizeNavTiming,
} from '@/lib/navTiming'
import {
  NAV_AUTOPILOT_DWELL_MS,
  NAV_AUTOPILOT_HOPS,
  NAV_AUTOPILOT_STORAGE_KEY,
  type NavAutopilotPersistedState,
} from '@/lib/navAutopilotTour'

/**
 * Keeps the nav autopilot running across SPA route changes.
 * `/dev/nav-autopilot` only starts the tour; this component continues hops from the root layout.
 */
export default function DevNavAutopilotResume() {
  const pathname = usePathname()
  const router = useRouter()
  const dwellScheduledForIdx = useRef<number | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (typeof window === 'undefined') return

    const raw = sessionStorage.getItem(NAV_AUTOPILOT_STORAGE_KEY)
    if (!raw) return

    let state: NavAutopilotPersistedState
    try {
      state = JSON.parse(raw) as NavAutopilotPersistedState
    } catch {
      sessionStorage.removeItem(NAV_AUTOPILOT_STORAGE_KEY)
      return
    }

    if (state.phase !== 'going_to') return

    const hops = NAV_AUTOPILOT_HOPS as readonly string[]
    const expected = hops[state.targetIndex]
    if (pathname !== expected) return

    if (dwellScheduledForIdx.current === state.targetIndex) return
    dwellScheduledForIdx.current = state.targetIndex

    sessionStorage.setItem(
      NAV_AUTOPILOT_STORAGE_KEY,
      JSON.stringify({ phase: 'dwell', targetIndex: state.targetIndex } satisfies NavAutopilotPersistedState)
    )

    const timer = window.setTimeout(() => {
      const dwellRaw = sessionStorage.getItem(NAV_AUTOPILOT_STORAGE_KEY)
      if (!dwellRaw) return
      let s: NavAutopilotPersistedState
      try {
        s = JSON.parse(dwellRaw) as NavAutopilotPersistedState
      } catch {
        return
      }
      if (s.phase !== 'dwell' || s.targetIndex !== state.targetIndex) return

      const idx = state.targetIndex
      if (idx >= hops.length - 1) {
        sessionStorage.removeItem(NAV_AUTOPILOT_STORAGE_KEY)
        dwellScheduledForIdx.current = null
        const entries = getNavTimingReport()
        const summary = summarizeNavTiming(entries)
        const json = exportNavTimingJson()
        console.log('[nav-autopilot] summary', summary, `(shell budget ${NAV_TIMING_SHELL_BUDGET_MS}ms)`)
        console.log('[nav-autopilot] JSON\n', json)
        return
      }

      markInternalNavIntent()
      sessionStorage.setItem(
        NAV_AUTOPILOT_STORAGE_KEY,
        JSON.stringify({ phase: 'going_to', targetIndex: idx + 1 } satisfies NavAutopilotPersistedState)
      )
      dwellScheduledForIdx.current = null
      router.push(hops[idx + 1])
    }, NAV_AUTOPILOT_DWELL_MS)

    return () => {
      window.clearTimeout(timer)
      dwellScheduledForIdx.current = null
    }
  }, [pathname, router])

  return null
}
