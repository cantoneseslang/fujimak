import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { FUJIMAK_REQUEST_LOCALE_HEADER, defaultLocale, locales, type Locale } from './config'

export default getRequestConfig(async () => {
  const headerStore = await headers()
  const stampedLocale = headerStore.get(FUJIMAK_REQUEST_LOCALE_HEADER)

  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('locale')?.value

  let locale: Locale
  if (stampedLocale && locales.includes(stampedLocale as Locale)) {
    locale = stampedLocale as Locale
  } else if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    locale = cookieLocale as Locale
  } else {
    locale = defaultLocale
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
