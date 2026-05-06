'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clearNavTiming, markInternalNavIntent } from '@/lib/navTiming'
import { NAV_AUTOPILOT_HOPS, NAV_AUTOPILOT_STORAGE_KEY } from '@/lib/navAutopilotTour'

export default function NavAutopilotClient() {
  const router = useRouter()
  const [status, setStatus] = useState('starting…')

  useEffect(() => {
    clearNavTiming()
    let cancelled = false
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

    void (async () => {
      await sleep(600)
      if (cancelled) return
      const hops = NAV_AUTOPILOT_HOPS as readonly string[]
      setStatus(`→ ${hops[0]} (1/${hops.length}) — watch DevTools console for [nav-autopilot] summary`)
      sessionStorage.setItem(
        NAV_AUTOPILOT_STORAGE_KEY,
        JSON.stringify({ phase: 'going_to', targetIndex: 0 })
      )
      markInternalNavIntent()
      router.push(hops[0])
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <h1 className="text-lg font-semibold">Dev nav autopilot</h1>
      <p className="mt-2 text-sm text-zinc-400">{status}</p>
      <p className="mt-4 max-w-xl text-xs leading-relaxed text-zinc-500">
        巡回完了後、コンソールに <code className="text-zinc-300">[nav-autopilot] summary</code> と JSON が出ます。計測は意図マークから遷移後ダブル
        rAF まで（シェル描画の目安）。手動コピー:{' '}
        <code className="text-zinc-300">window.__FUJIMAK_EXPORT_NAV_TIMING__?.()</code>
      </p>
    </div>
  )
}
