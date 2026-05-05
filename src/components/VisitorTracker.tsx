'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function VisitorTracker() {
  const pathname = usePathname()
  const lastTrackedRef = useRef<{ page: string; time: number } | null>(null)

  useEffect(() => {
    // 認証画面/管理画面は追跡しない（未ログイン時の401ノイズを防ぐ）
    if (pathname === '/admin' || pathname.startsWith('/auth')) return

    const trackVisit = async () => {
      const now = Date.now()
      
      // 同じページへの5秒以内の重複アクセスは無視
      if (lastTrackedRef.current) {
        const { page, time } = lastTrackedRef.current
        if (page === pathname && now - time < 5000) {
          return
        }
      }

      // 訪問者IDを取得または生成
      let visitorId = localStorage.getItem('visitor_id')
      if (!visitorId) {
        visitorId = 'visitor_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
        localStorage.setItem('visitor_id', visitorId)
      }

      // 最後の追跡を記録
      lastTrackedRef.current = { page: pathname, time: now }

      await fetch('/api/visitor-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          visitorId,
          page: pathname,
          userAgent: navigator.userAgent,
          language: navigator.language,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          referrer: document.referrer || 'direct',
        }),
      }).catch(() => undefined)
    }

    trackVisit()
  }, [pathname])

  return null
}
