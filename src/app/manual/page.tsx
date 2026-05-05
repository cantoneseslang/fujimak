'use client'

import { BookOpenCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

export default function ManualPage() {
  const t = useTranslations('manual')

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title={t('title')} titleClassName="ml-1.5" />

      <main className="space-y-4 px-4 py-6">
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-full bg-zinc-900 p-3 text-white" style={{ marginLeft: '6px' }}>
              <BookOpenCheck className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-semibold text-zinc-900" style={{ marginLeft: '6px' }}>{t('title')}</h1>
          </div>
          <p className="text-sm text-zinc-600" style={{ marginLeft: '6px' }}>{t('intro')}</p>
        </section>

        <section className="space-y-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900" style={{ marginLeft: '6px' }}>{t('section1Title')}</h2>
            <p className="mt-1 text-sm text-zinc-600" style={{ marginLeft: '6px' }}>{t('section1Body')}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900" style={{ marginLeft: '6px' }}>{t('section2Title')}</h2>
            <p className="mt-1 text-sm text-zinc-600" style={{ marginLeft: '6px' }}>{t('section2Body')}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900" style={{ marginLeft: '6px' }}>{t('section3Title')}</h2>
            <p className="mt-1 text-sm text-zinc-600" style={{ marginLeft: '6px' }}>{t('section3Body')}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900" style={{ marginLeft: '6px' }}>{t('section4Title')}</h2>
            <p className="mt-1 text-sm text-zinc-600" style={{ marginLeft: '6px' }}>{t('section4Body')}</p>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  )
}
