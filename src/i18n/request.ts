import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'
import { defaultLocale, locales } from './config'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get('locale')?.value
  const locale: (typeof locales)[number] =
    cookieLocale && locales.includes(cookieLocale as (typeof locales)[number])
      ? (cookieLocale as (typeof locales)[number])
      : defaultLocale
  
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  }
})
