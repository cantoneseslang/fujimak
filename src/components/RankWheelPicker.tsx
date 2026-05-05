'use client'

import { useCallback, useEffect, useRef } from 'react'
import { MAINTENANCE_RANK_OPTIONS, type MaintenanceReportFormSnapshot } from '@/lib/maintenanceReportForm'

type Rank = MaintenanceReportFormSnapshot['rank']

const ROW_H = 48
/** Padding so first/last row can snap to center inside viewport */
function verticalPaddingPx(viewportH: number) {
  return Math.max(0, (viewportH - ROW_H) / 2)
}

export default function RankWheelPicker(props: {
  value: Rank
  onChange: (r: Rank) => void
  ariaLabelledBy?: string
}) {
  const { value, onChange, ariaLabelledBy } = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<Map<Rank, HTMLDivElement>>(new Map())
  const programmaticScrollRef = useRef(false)

  const scrollRankToCenter = useCallback((rank: Rank, behavior: ScrollBehavior) => {
    const wrap = scrollRef.current
    const row = rowRefs.current.get(rank)
    if (!wrap || !row) return
    const pad = verticalPaddingPx(wrap.clientHeight)
    const target = row.offsetTop - pad
    programmaticScrollRef.current = true
    wrap.scrollTo({ top: Math.max(0, target), behavior })
    window.setTimeout(
      () => {
        programmaticScrollRef.current = false
      },
      behavior === 'smooth' ? 420 : 0
    )
  }, [])

  useEffect(() => {
    scrollRankToCenter(value, 'auto')
  }, [value, scrollRankToCenter])

  const pickClosestRank = useCallback(() => {
    const wrap = scrollRef.current
    if (!wrap) return value
    const wrapMid = wrap.scrollTop + wrap.clientHeight / 2
    let best: Rank = value
    let bestDist = Infinity
    for (const { rank } of MAINTENANCE_RANK_OPTIONS) {
      const el = rowRefs.current.get(rank)
      if (!el) continue
      const rowMid = el.offsetTop + el.offsetHeight / 2
      const d = Math.abs(rowMid - wrapMid)
      if (d < bestDist) {
        bestDist = d
        best = rank
      }
    }
    return best
  }, [value])

  useEffect(() => {
    const wrap = scrollRef.current
    if (!wrap) return
    let idle: number | undefined
    const flush = () => {
      if (programmaticScrollRef.current) return
      const next = pickClosestRank()
      if (next !== value) {
        onChange(next)
        scrollRankToCenter(next, 'smooth')
      }
    }
    const onScroll = () => {
      if (programmaticScrollRef.current) return
      if (idle !== undefined) window.clearTimeout(idle)
      idle = window.setTimeout(flush, 120)
    }
    wrap.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      wrap.removeEventListener('scroll', onScroll)
      if (idle !== undefined) window.clearTimeout(idle)
    }
  }, [onChange, pickClosestRank, scrollRankToCenter, value])

  const viewportH = 240

  return (
    <div className="relative">
      <div
        className="relative overflow-hidden rounded-xl border border-zinc-300 bg-zinc-50 shadow-inner"
        style={{ height: viewportH }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 border-y-2 border-zinc-800/75 bg-white/40"
          style={{ height: ROW_H }}
        />
        <div
          ref={scrollRef}
          role="listbox"
          aria-labelledby={ariaLabelledBy}
          aria-activedescendant={`rank-wheel-${value}`}
          className="snap-y snap-mandatory overflow-y-auto overscroll-contain"
          style={{
            height: viewportH,
            scrollPaddingTop: verticalPaddingPx(viewportH),
            scrollPaddingBottom: verticalPaddingPx(viewportH),
          }}
        >
          <div>
            {MAINTENANCE_RANK_OPTIONS.map(({ rank, label }) => (
              <div
                key={rank}
                id={`rank-wheel-${rank}`}
                ref={(el) => {
                  if (el) rowRefs.current.set(rank, el)
                  else rowRefs.current.delete(rank)
                }}
                role="option"
                aria-selected={value === rank}
                tabIndex={0}
                style={{ height: ROW_H, scrollSnapAlign: 'center' }}
                className={`flex cursor-pointer snap-center items-center justify-center px-2 text-center text-xs leading-tight transition-colors sm:text-sm ${
                  value === rank ? 'font-semibold text-zinc-900' : 'font-normal text-zinc-500'
                }`}
                onClick={() => {
                  onChange(rank)
                  scrollRankToCenter(rank, 'smooth')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onChange(rank)
                    scrollRankToCenter(rank, 'smooth')
                  }
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-1 text-center text-[11px] text-zinc-500">
        Scroll or tap a row · Selected: <span className="font-semibold text-zinc-800">{value}</span>
      </p>
    </div>
  )
}
