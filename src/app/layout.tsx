import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Analytics } from '@vercel/analytics/react'
import VisitorTracker from '@/components/VisitorTracker'
import './globals.css'

export const metadata: Metadata = {
  title: 'FUJIMAK Maintenance Portal',
  description: 'Fujimak Maintenance Portal',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FUJIMAK Maintenance',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#111111',
  /** iOS のノッチ／Dynamic Island 下で env(safe-area-inset-*) が効くようにする */
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/images/fujimak-rogo.png" />
      </head>
      <body suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <VisitorTracker />
          {children}
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  )
}
