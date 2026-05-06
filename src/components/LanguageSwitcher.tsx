'use client'

import { useState } from 'react'
import { Globe, Check } from 'lucide-react'
import { locales, localeNames, FUJIMAK_LOCALE_STORAGE_KEY, type Locale } from '@/i18n/config'

interface LanguageSwitcherProps {
  currentLocale: Locale
  /** Full reload follows via /api/locale — optional hook only */
  onLocaleChange?: (locale: Locale) => void
}

export default function LanguageSwitcher({ currentLocale, onLocaleChange }: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (locale: Locale) => {
    localStorage.setItem(FUJIMAK_LOCALE_STORAGE_KEY, locale)
    onLocaleChange?.(locale)
    setIsOpen(false)
    const redirectTo = `${window.location.pathname}${window.location.search}`
    window.location.assign(
      `/api/locale?locale=${encodeURIComponent(locale)}&redirect=${encodeURIComponent(redirectTo)}`
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-5 py-5 w-full bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
      >
        <Globe className="w-6 h-6 text-gray-600" />
        <span className="flex-1 text-left text-lg">{localeNames[currentLocale]}</span>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
          {locales.map((locale) => (
            <button
              key={locale}
              onClick={() => handleSelect(locale)}
              className="flex items-center justify-between px-5 py-5 w-full hover:bg-gray-50 transition-colors text-lg"
            >
              <span>{localeNames[locale]}</span>
              {currentLocale === locale && (
                <Check className="w-6 h-6 text-zinc-900" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
