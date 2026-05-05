export const locales = ['ja', 'en', 'zh', 'tl'] as const
export type Locale = (typeof locales)[number]

export const localeNames: Record<Locale, string> = {
  ja: '日本語',
  en: 'English',
  zh: '繁體中文',
  tl: 'Tagalog'
}

export const defaultLocale: Locale = 'en'
