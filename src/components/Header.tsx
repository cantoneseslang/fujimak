'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import Image from 'next/image'
import { Menu, ChevronLeft, X, Settings, Bell, LogOut, Globe } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { signOut } from '@/app/auth/actions'

const LANGUAGES = [
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'tl', name: 'Tagalog' },
]

const MECHANIC_OPERATION_MODE_KEY = 'mechanic-operation-mode-v1'

interface HeaderProps {
  showBack?: boolean
  showMenu?: boolean
  title?: string
  titleClassName?: string
  onMenuClick?: () => void
  onRightButtonTripleClick?: () => void
}

export default function Header({ 
  showBack = false, 
  showMenu = true, 
  title,
  titleClassName,
  onMenuClick,
  onRightButtonTripleClick,
}: HeaderProps) {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLangOpen, setIsLangOpen] = useState(false)
  const globeTapCountRef = useRef(0)
  const globeTapTimerRef = useRef<number | null>(null)
  const modeToastTimerRef = useRef<number | null>(null)
  const [modeToast, setModeToast] = useState<string | null>(null)
  const [currentLocale, setCurrentLocale] = useState(() => {
    if (typeof document === 'undefined') return 'en'
    const value = `; ${document.cookie}`
    const parts = value.split('; locale=')
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || 'en'
    }
    return 'en'
  })
  const t = useTranslations('settings')
  const tDashboard = useTranslations('dashboard')

  const handleLanguageChange = (locale: string) => {
    setCurrentLocale(locale)
    setIsLangOpen(false)
    const redirectTo = `${window.location.pathname}${window.location.search}`
    window.location.assign(
      `/api/locale?locale=${encodeURIComponent(locale)}&redirect=${encodeURIComponent(redirectTo)}`
    )
  }

  const menuItems = [
    { icon: <Settings className="w-6 h-6" />, label: t('title'), href: '/settings' },
    { icon: <Bell className="w-6 h-6" />, label: tDashboard('notifications'), href: '/notifications' },
  ]

  useEffect(() => {
    return () => {
      if (globeTapTimerRef.current !== null) {
        window.clearTimeout(globeTapTimerRef.current)
        globeTapTimerRef.current = null
      }
      if (modeToastTimerRef.current !== null) {
        window.clearTimeout(modeToastTimerRef.current)
        modeToastTimerRef.current = null
      }
    }
  }, [])

  const toggleGlobalOperationMode = () => {
    const current =
      typeof window !== 'undefined' && localStorage.getItem(MECHANIC_OPERATION_MODE_KEY) === 'demo'
        ? 'demo'
        : 'production'
    const next = current === 'demo' ? 'production' : 'demo'
    localStorage.setItem(MECHANIC_OPERATION_MODE_KEY, next)
    window.dispatchEvent(new CustomEvent('operation-mode-changed', { detail: { mode: next } }))
    setModeToast(`Mode switched to ${next.toUpperCase()}`)
    if (modeToastTimerRef.current !== null) {
      window.clearTimeout(modeToastTimerRef.current)
    }
    modeToastTimerRef.current = window.setTimeout(() => {
      setModeToast(null)
      modeToastTimerRef.current = null
    }, 2200)
  }

  const handleRightButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    globeTapCountRef.current += 1
    if (globeTapTimerRef.current !== null) {
      window.clearTimeout(globeTapTimerRef.current)
    }
    globeTapTimerRef.current = window.setTimeout(() => {
      globeTapCountRef.current = 0
      globeTapTimerRef.current = null
    }, 1800)

    if (globeTapCountRef.current >= 3) {
      globeTapCountRef.current = 0
      if (globeTapTimerRef.current !== null) {
        window.clearTimeout(globeTapTimerRef.current)
        globeTapTimerRef.current = null
      }
      setIsLangOpen(false)
      if (onRightButtonTripleClick) {
        onRightButtonTripleClick()
      } else {
        toggleGlobalOperationMode()
      }
      return
    }
    if (onRightButtonTripleClick) return
    setIsLangOpen((prev) => !prev)
  }

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-2 py-3 sm:px-4 sm:py-4">
          <div className="w-11 sm:w-14">
            {showBack ? (
              <button 
                onClick={() => router.back()}
                className="rounded-full p-1.5 -ml-1.5 transition-colors hover:bg-gray-100 sm:p-2 sm:-ml-2"
              >
                <ChevronLeft className="h-8 w-8 text-gray-700 sm:h-10 sm:w-10" />
              </button>
            ) : showMenu ? (
              <button 
                onClick={() => {
                  if (onMenuClick) {
                    onMenuClick()
                    return
                  }
                  setIsMenuOpen(true)
                }}
                className="rounded-full p-1.5 -ml-1.5 transition-colors hover:bg-gray-100 sm:p-2 sm:-ml-2"
              >
                <Menu className="h-8 w-8 text-gray-700 sm:h-10 sm:w-10" />
              </button>
            ) : null}
          </div>
          
          <div className={`flex min-w-0 flex-1 items-center justify-center gap-1 px-1 sm:gap-3 sm:px-2`}>
            {title ? (
              <h1 className={`truncate text-center text-xl font-bold text-gray-800 sm:text-2xl ${titleClassName ?? ''}`}>{title}</h1>
            ) : (
              <>
                <Image
                  src="/images/fujimak-rogo.png"
                  alt="Fujimak"
                  width={893}
                  height={300}
                  className="h-10 w-auto max-h-10 max-w-[min(200px,48vw)] shrink-0 object-contain object-left sm:h-11 sm:max-h-11 sm:max-w-[min(240px,42vw)]"
                  unoptimized
                  priority
                />
                <span className="shrink-0 self-center px-0.5 text-[10px] font-medium lowercase tracking-wide text-zinc-400 sm:px-1 sm:text-xs">
                  with
                </span>
                <Image
                  src="/images/angelspizza-logo.png?v=6"
                  alt="Angel's Pizza"
                  width={1024}
                  height={389}
                  className="h-10 w-auto max-h-10 max-w-[min(200px,48vw)] shrink-0 object-contain object-left sm:h-11 sm:max-h-11 sm:max-w-[min(240px,42vw)]"
                  unoptimized
                  priority
                />
              </>
            )}
          </div>
          
          <div className="relative flex w-10 items-start justify-center sm:w-14">
            <button 
              type="button"
              onClick={handleRightButtonClick}
              className="rounded-full p-1.5 transition-colors hover:bg-gray-100 sm:p-2"
            >
              <Globe className="h-7 w-7 text-gray-700 sm:h-8 sm:w-8" />
            </button>
            
            {/* Language Dropdown */}
            {!onRightButtonTripleClick && isLangOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setIsLangOpen(false)}
                />
                <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-[60] min-w-[160px]">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLanguageChange(lang.code)
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                        currentLocale === lang.code 
                          ? 'bg-zinc-100 text-zinc-900 font-medium' 
                          : 'text-gray-700'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Slide-out Menu */}
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsMenuOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-xl animate-slide-in">
            {/* Menu Header */}
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-3">
              {/* 狭い w-72 では justify-center が中央寄せで左欠け＋見かけの隙間になるため justify-start。Fujimak+with は必ず隣接 */}
              <div className="flex min-w-0 flex-1 items-center justify-start gap-1.5">
                <div className="inline-flex shrink-0 items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- ドロワー内では next/image が幅0になるケースがある */}
                  <img
                    src="/images/fujimak-rogo.png"
                    alt="Fujimak"
                    width={893}
                    height={300}
                    className="block h-8 w-auto max-w-[118px] shrink-0 object-contain object-left"
                    loading="eager"
                    decoding="async"
                  />
                  <span className="text-[9px] font-medium lowercase tracking-wide text-zinc-400 sm:text-[11px]">
                    with
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 同上 */}
                  <img
                    src="/images/angelspizza-logo.png?v=6"
                    alt="Angel's Pizza"
                    width={1024}
                    height={389}
                    className="block h-8 w-auto max-w-[118px] shrink-0 object-contain object-left"
                    loading="eager"
                    decoding="async"
                  />
                </div>
              </div>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-6 h-6 text-gray-700" />
              </button>
            </div>
            
            {/* Menu Items */}
            <nav className="p-4 flex flex-col gap-6">
              {menuItems.map((item) => (
                <button
                  key={item.href}
                  onClick={() => {
                    setIsMenuOpen(false)
                    router.push(item.href)
                  }}
                  className="w-full h-24 flex items-center gap-4 px-6 rounded-xl hover:bg-gray-100 transition-colors text-gray-700 bg-gray-50"
                >
                  <span className="inline-flex" style={{ marginLeft: '6px' }}>{item.icon}</span>
                  <span className="font-medium text-xl" style={{ marginLeft: '6px' }}>{item.label}</span>
                </button>
              ))}
            </nav>
            
            {/* Bottom Section */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false)
                  void signOut()
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-red-50 transition-colors text-red-500"
              >
                <LogOut className="w-6 h-6" style={{ marginLeft: '6px' }} />
                <span className="font-medium text-lg" style={{ marginLeft: '6px' }}>{t('logout')}</span>
              </button>
            </div>
          </div>
        </>
      )}
      {modeToast ? (
        <div className="pointer-events-none fixed left-1/2 top-16 z-[70] -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {modeToast}
        </div>
      ) : null}
    </>
  )
}
