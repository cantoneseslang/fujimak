/** Client-only navigation timing ring buffer (development / explicit opt-in). */

export const NAV_TIMING_SHELL_BUDGET_MS = 300

export type NavTimingEntry = {
  from: string | null
  to: string
  /** ms from internal nav intent (click) to paint after route commit (double rAF) */
  intentToPaintMs: number | null
  ts: number
}

const STORAGE_KEY = 'fujimak_nav_timing_v1'
const MAX_ENTRIES = 120

let ring: NavTimingEntry[] = []
let pendingIntentAt: number | null = null

try {
  if (typeof sessionStorage !== 'undefined') {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as NavTimingEntry[]
      if (Array.isArray(parsed)) ring = parsed.slice(-MAX_ENTRIES)
    }
  }
} catch {
  // ignore
}

export function markInternalNavIntent(): void {
  if (typeof performance === 'undefined') return
  pendingIntentAt = performance.now()
}

export function consumePendingIntent(): number | null {
  const t = pendingIntentAt
  pendingIntentAt = null
  return t
}

function persist(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ring.slice(-60)))
    }
  } catch {
    // ignore quota / private mode
  }
}

export function clearNavTiming(): void {
  ring = []
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    ;(window as unknown as { __FUJIMAK_NAV_TIMING__?: NavTimingEntry[] }).__FUJIMAK_NAV_TIMING__ = []
  }
}

export function pushNavTiming(entry: NavTimingEntry): void {
  ring.push(entry)
  if (ring.length > MAX_ENTRIES) ring.shift()
  persist()
  if (typeof window !== 'undefined') {
    ;(window as unknown as { __FUJIMAK_NAV_TIMING__?: NavTimingEntry[] }).__FUJIMAK_NAV_TIMING__ = [...ring]
  }
  if (entry.intentToPaintMs != null && entry.intentToPaintMs > NAV_TIMING_SHELL_BUDGET_MS) {
    console.warn('[nav-timing] slower than shell budget', NAV_TIMING_SHELL_BUDGET_MS, 'ms', entry)
  }
}

export function getNavTimingReport(): NavTimingEntry[] {
  return [...ring]
}

export function summarizeNavTiming(entries: NavTimingEntry[]): {
  count: number
  maxMs: number
  avgMs: number
  overBudget: number
} {
  const ms = entries.map((e) => e.intentToPaintMs).filter((v): v is number => typeof v === 'number')
  const sum = ms.reduce((a, b) => a + b, 0)
  return {
    count: ms.length,
    maxMs: ms.length ? Math.max(...ms) : 0,
    avgMs: ms.length ? sum / ms.length : 0,
    overBudget: ms.filter((x) => x > NAV_TIMING_SHELL_BUDGET_MS).length,
  }
}

export function exportNavTimingJson(): string {
  return JSON.stringify(
    {
      shellBudgetMs: NAV_TIMING_SHELL_BUDGET_MS,
      capturedAt: new Date().toISOString(),
      summary: summarizeNavTiming(ring),
      entries: ring,
    },
    null,
    2
  )
}
