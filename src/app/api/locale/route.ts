import { NextRequest, NextResponse } from 'next/server'
import { defaultLocale, locales } from '@/i18n/config'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') ?? defaultLocale
  const redirect = request.nextUrl.searchParams.get('redirect') ?? '/'

  const safeLocale = locales.includes(locale as (typeof locales)[number]) ? locale : defaultLocale
  const safeRedirect = redirect.startsWith('/') ? redirect : '/'

  const response = NextResponse.redirect(new URL(safeRedirect, request.url))
  response.cookies.set('locale', safeLocale, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    httpOnly: false,
    sameSite: 'lax',
  })

  return response
}
