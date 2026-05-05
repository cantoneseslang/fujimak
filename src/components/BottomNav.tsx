'use client'

import { useState, useEffect, useRef } from 'react'
import { Home, Wrench, History, Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
  badge?: number
}

export default function BottomNav() {
  const pathname = usePathname()
  const t = useTranslations('dashboard')
  const [notificationCount, setNotificationCount] = useState(0)
  const navRef = useRef<HTMLElement>(null)
  
  useEffect(() => {
    const storeId = localStorage.getItem('selectedStoreId')
    if (!storeId) return

    const load = async () => {
      try {
        const res = await fetch(`/api/maintenance/notifications?storeId=${encodeURIComponent(storeId)}&status=pending`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const json = (await res.json()) as { notifications?: unknown[] }
        setNotificationCount((json.notifications ?? []).length)
      } catch (error) {
        setNotificationCount(0)
      }
    }

    void load()
  }, [pathname]) // pathname変更時に再チェック

  useEffect(() => {
    const updateBottomNavHeight = () => {
      const navHeight = navRef.current?.offsetHeight
      if (!navHeight) return
      document.documentElement.style.setProperty('--bottom-nav-height', `${navHeight}px`)
    }

    updateBottomNavHeight()
    window.addEventListener('resize', updateBottomNavHeight)
    window.addEventListener('orientationchange', updateBottomNavHeight)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && navRef.current) {
      observer = new ResizeObserver(() => updateBottomNavHeight())
      observer.observe(navRef.current)
    }

    return () => {
      window.removeEventListener('resize', updateBottomNavHeight)
      window.removeEventListener('orientationchange', updateBottomNavHeight)
      observer?.disconnect()
    }
  }, [])

  const navItems: NavItem[] = [
    { href: '/dashboard', icon: <Home className="w-7 h-7" />, label: t('title') },
    { href: '/maintenance', icon: <Wrench className="w-7 h-7" />, label: t('newRequest').split(' ')[0] },
    { href: '/history', icon: <History className="w-7 h-7" />, label: t('viewHistory').split(' ')[0] },
    { href: '/notifications', icon: <Bell className="w-7 h-7" />, label: t('notifications'), badge: notificationCount },
  ]

  return (
    <>
      <div aria-hidden className="h-[var(--bottom-nav-height,88px)]" />
      <nav
        ref={navRef}
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-around py-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'text-zinc-900' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="relative">
                  {item.icon}
                  {item.badge !== undefined && item.badge > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {item.badge}
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
