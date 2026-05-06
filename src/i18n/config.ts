export const locales = ['ja', 'en', 'zh', 'tl'] as const
export type Locale = (typeof locales)[number]

/** Middleware sets this on the forwarded request so RSC matches the resolved locale before Set-Cookie is readable in cookies(). */
export const FUJIMAK_REQUEST_LOCALE_HEADER = 'x-fujimak-request-locale' as const

export const localeNames: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
  zh: '繁體中文',
  tl: 'Tagalog'
}

export const defaultLocale: Locale = 'en'
