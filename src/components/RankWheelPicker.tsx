'use client'

import { useCallback, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { MAINTENANCE_RANK_OPTIONS, type MaintenanceReportFormSnapshot } from '@/lib/maintenanceReportForm'

type Rank = MaintenanceReportFormSnapshot['rank']

/** LOGIN_OPERATOR_WHEEL_REQUIREMENTS.md に準拠した寸法 */
const VIEWPORT_H = 144
const ROW_H = 48
const FADE_H = 40
const DEBOUNCE_MS = 100
const LOCK_MS = 700

function viewportCenterY(rect: DOMRect) {
  return rect.top + rect.height / 2
}

function closestRankByRects(track: HTMLDivElement, rows: Map<Rank, HTMLDivElement>): Rank {
  const vc = viewportCenterY(track.getBoundingClientRect())
  let best: Rank = 'A'
  let bestDist = Infinity
  for (const { rank } of MAINTENANCE_RANK_OPTIONS) {
    const el = rows.get(rank)
    if (!el) continue
    const ec = viewportCenterY(el.getBoundingClientRect())
    const d = Math.abs(ec - vc)
    if (d < bestDist) {
      bestDist = d
      best = rank
    }
  }
  return best
}

function clampScrollTop(track: HTMLDivElement, top: number) {
  const max = Math.max(0, track.scrollHeight - track.clientHeight)
  return Math.max(0, Math.min(top, max))
}

/** プログラム同期は scrollTop 直代入（要件 4・5.3） */
function scrollRankToCenterInstant(track: HTMLDivElement, rank: Rank, rows: Map<Rank, HTMLDivElement>) {
  const row = rows.get(rank)
  if (!row) return
  const trackRect = track.getBoundingClientRect()
  const rowRect = row.getBoundingClientRect()
  const delta = viewportCenterY(rowRect) - viewportCenterY(trackRect)
  track.scrollTop = clampScrollTop(track, track.scrollTop + delta)
}

function scrollRankToCenterSmooth(track: HTMLDivElement, rank: Rank, rows: Map<Rank, HTMLDivElement>) {
  const row = rows.get(rank)
  if (!row) return
  const trackRect = track.getBoundingClientRect()
  const rowRect = row.getBoundingClientRect()
  const delta = viewportCenterY(rowRect) - viewportCenterY(trackRect)
  const target = clampScrollTop(track, track.scrollTop + delta)
  track.scrollTo({ top: target, behavior: 'smooth' })
}

function rankStep(value: Rank, delta: -1 | 1): Rank {
  const order = MAINTENANCE_RANK_OPTIONS.map((o) => o.rank)
  const i = order.indexOf(value)
  const next = Math.max(0, Math.min(order.length - 1, i + delta))
  return order[next] ?? value
}

export default function RankWheelPicker(props: {
  value: Rank
  onChange: (r: Rank) => void
  ariaLabelledBy?: string
}) {
  const { value, onChange, ariaLabelledBy } = props
  const trackRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Map<Rank, HTMLDivElement>>(new Map())
  /** Date.now() まで幾何ベースの onChange を抑制（慣性・初期同期ずれ対策） */
  const geometryLockUntilRef = useRef(0)
  const idleTimerRef = useRef<number | undefined>(undefined)
  const pendingSmoothRef = useRef(false)
  const skipNextLayoutSyncRef = useRef(false)

  const armGeometryLock = useCallback(() => {
    geometryLockUntilRef.current = Date.now() + LOCK_MS
  }, [])

  const runInstantSync = useCallback(
    (rank: Rank) => {
      const track = trackRef.current
      if (!track) return
      armGeometryLock()
      pendingSmoothRef.current = false
      scrollRankToCenterInstant(track, rank, rowRefs.current)
    },
    [armGeometryLock]
  )

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return

    if (skipNextLayoutSyncRef.current) {
      skipNextLayoutSyncRef.current = false
      return
    }

    let cancelled = false
    const tick = () => {
      if (cancelled || !trackRef.current) return
      runInstantSync(value)
    }

    tick()
    const raf = requestAnimationFrame(tick)
    const t0 = window.setTimeout(tick, 0)
    const t80 = window.setTimeout(tick, 80)
    const t240 = window.setTimeout(tick, 240)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.clearTimeout(t0)
      window.clearTimeout(t80)
      window.clearTimeout(t240)
    }
  }, [runInstantSync, value])

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return

    const flushGeometry = () => {
      if (Date.now() < geometryLockUntilRef.current) return
      const next = closestRankByRects(track, rowRefs.current)
      if (next !== value) onChange(next)
    }

    const scheduleFlush = () => {
      if (idleTimerRef.current !== undefined) window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = undefined
        flushGeometry()
      }, DEBOUNCE_MS)
    }

    const handleScrollEnd = () => {
      if (pendingSmoothRef.current) {
        pendingSmoothRef.current = false
        geometryLockUntilRef.current = 0
      }
    }

    track.addEventListener('scroll', scheduleFlush, { passive: true })
    track.addEventListener('scrollend', handleScrollEnd)

    return () => {
      track.removeEventListener('scroll', scheduleFlush)
      track.removeEventListener('scrollend', handleScrollEnd)
      if (idleTimerRef.current !== undefined) window.clearTimeout(idleTimerRef.current)
    }
  }, [onChange, value])

  const handleRowClick = (rank: Rank) => {
    if (!trackRef.current) return
    skipNextLayoutSyncRef.current = true
    pendingSmoothRef.current = true
    armGeometryLock()
    onChange(rank)
    requestAnimationFrame(() => {
      const tr = trackRef.current
      if (!tr) return
      scrollRankToCenterSmooth(tr, rank, rowRefs.current)
    })
  }

  const handleListboxKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = rankStep(value, -1)
      if (next === value) return
      skipNextLayoutSyncRef.current = true
      pendingSmoothRef.current = true
      armGeometryLock()
      onChange(next)
      requestAnimationFrame(() => {
        const tr = trackRef.current
        if (!tr) return
        scrollRankToCenterSmooth(tr, next, rowRefs.current)
      })
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = rankStep(value, 1)
      if (next === value) return
      skipNextLayoutSyncRef.current = true
      pendingSmoothRef.current = true
      armGeometryLock()
      onChange(next)
      requestAnimationFrame(() => {
        const tr = trackRef.current
        if (!tr) return
        scrollRankToCenterSmooth(tr, next, rowRefs.current)
      })
    }
  }

  const fadePx = FADE_H

  return (
    <div className="relative">
      {/* 正本を HTML select にも反映（フォーム・PDF連携・要件 2.2） */}
      <select
        aria-hidden="true"
        tabIndex={-1}
        value={value}
        className="absolute h-px w-px overflow-hidden p-0 opacity-0"
        style={{ clip: 'rect(0,0,0,0)', clipPath: 'inset(50%)' }}
        onChange={() => {}}
      >
        {MAINTENANCE_RANK_OPTIONS.map(({ rank, label }) => (
          <option key={rank} value={rank}>
            {label}
          </option>
        ))}
      </select>

      <div
        role="listbox"
        tabIndex={0}
        aria-labelledby={ariaLabelledBy}
        aria-activedescendant={`rank-wheel-${value}`}
        onKeyDown={handleListboxKeyDown}
        className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
      >
        <div
          className="relative overflow-hidden rounded-xl border border-zinc-300 bg-zinc-50 shadow-inner"
          style={{ height: VIEWPORT_H }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-zinc-50 to-transparent"
            style={{ height: fadePx }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-zinc-50 to-transparent"
            style={{ height: fadePx }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-3 top-1/2 z-10 -translate-y-1/2 rounded-lg border-2 border-zinc-800/75 bg-white/35"
            style={{ height: ROW_H }}
          />
          <div
            ref={trackRef}
            className="scrollbar-hide h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
            style={{
              height: VIEWPORT_H,
              touchAction: 'pan-y',
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'auto',
            }}
          >
            <div>
              <div aria-hidden className="shrink-0" style={{ height: ROW_H }} />
              {MAINTENANCE_RANK_OPTIONS.map(({ rank, label }) => {
                const selected = value === rank
                return (
                  <div
                    key={rank}
                    id={`rank-wheel-${rank}`}
                    data-id={rank}
                    ref={(el) => {
                      if (el) rowRefs.current.set(rank, el)
                      else rowRefs.current.delete(rank)
                    }}
                    role="option"
                    aria-selected={selected}
                    style={{ height: ROW_H, scrollSnapAlign: 'center' }}
                    className={`flex cursor-pointer snap-center items-center justify-center px-2 text-center text-xs leading-tight transition-[transform,color] duration-150 sm:text-sm ${
                      selected
                        ? 'scale-[1.02] font-semibold text-zinc-900 [text-shadow:0_1px_0_rgba(255,255,255,0.6)]'
                        : 'scale-100 font-normal text-zinc-500'
                    }`}
                    onClick={() => handleRowClick(rank)}
                  >
                    {label}
                  </div>
                )
              })}
              <div aria-hidden className="shrink-0" style={{ height: ROW_H }} />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-1 text-center text-[11px] text-zinc-500">
        Scroll or tap a row · Selected: <span className="font-semibold text-zinc-800">{value}</span>
      </p>
    </div>
  )
}
