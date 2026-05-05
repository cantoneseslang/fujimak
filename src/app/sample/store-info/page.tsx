import type { Metadata } from 'next'
import Image from 'next/image'
import { Home, Wrench, History, Bell, Menu, Globe } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Store Info — Sample (Life Support)',
  description: 'Standalone visual sample; not connected to production.',
  robots: { index: false, follow: false },
}

/** Static sample (English UI). Life Support demo — no navigation or APIs. */
export default function SampleStoreInfoPage() {
  return (
    <div lang="en" className="min-h-screen bg-gray-50 pb-28">
      {/* App-style bar — LSHK logo (not Sushiro).
          Top inset: inline style (Tailwind arbitrary `env(...,0px)` can break on commas). */}
      <header
        className="sticky top-0 z-50 border-b border-gray-100 bg-white"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2.25rem)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex w-14 justify-start">
            <span
              className="rounded-full p-2 text-gray-400"
              aria-hidden
            >
              <Menu className="h-8 w-8" strokeWidth={1.75} />
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center gap-2">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white">
              <Image
                src="/images/lifesupport-hk-logo.png"
                alt="Life Support Hong Kong"
                fill
                className="object-cover"
                sizes="40px"
                priority
              />
            </div>
            <span className="text-sm font-semibold text-gray-800">
              Life Support HK
            </span>
          </div>
          <div className="flex w-14 justify-end">
            <Globe className="h-8 w-8 text-gray-400" aria-hidden />
          </div>
        </div>
      </header>

      <main className="px-4 py-8">
        {/* Hero — blue gradient (Life Support palette) */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#0d47a1] to-[#1976d2] text-center text-white">
          <div className="px-4 pb-3 pt-5 md:px-6 md:pb-4 md:pt-6">
            <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/70 md:text-[10px]">
              Sample · No backend
            </p>
            <h1 className="mt-1.5 text-base font-bold leading-tight md:mt-2 md:text-lg">
              Whampoa Demo Store
            </h1>
            <p className="mt-0.5 text-xs leading-snug text-white/80 md:text-sm">
              Life Support Hong Kong
            </p>
          </div>
          <div className="bg-white/20 px-4 py-2.5 text-center md:py-3">
            <div className="flex items-center justify-center gap-1.5">
              <Bell className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
              <span className="text-xs md:text-sm">Pending requests:</span>
            </div>
            <span className="mt-0.5 block text-base font-bold tabular-nums md:mt-1 md:text-lg">
              0
            </span>
          </div>
        </div>

        <div className="h-8" />

        {/* Quick actions — visual only */}
        <div className="mb-6 grid grid-cols-3 gap-2 md:mb-8 md:gap-4">
          {[
            { icon: Wrench, color: 'bg-[#1565c0]', label: 'New request' },
            { icon: History, color: 'bg-orange-500', label: 'History' },
            { icon: Bell, color: 'bg-blue-500', label: 'Alerts' },
          ].map(({ icon: Icon, color, label }) => (
            <div
              key={label}
              className="flex cursor-not-allowed flex-col items-center gap-1.5 rounded-xl bg-white px-1.5 py-3 shadow-sm md:gap-4 md:px-4 md:py-8"
              role="presentation"
            >
              <div className={`${color} rounded-full p-2.5 text-white md:p-5`}>
                <Icon className="h-6 w-6 md:h-10 md:w-10" />
              </div>
              <span className="text-center text-[11px] font-medium leading-tight text-gray-600 md:text-base md:text-gray-500">
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Store Info</h2>
          <div className="space-y-3 text-base text-gray-600">
            <p>
              <span className="font-medium text-gray-800">Address:</span>{' '}
              <span className="break-words">
                {
                  'G/F & Basement One, Site 5 & 6, Wonderful Worlds of Whampoa, Hung Hom, Kowloon'
                }
              </span>
            </p>
            <p>
              <span className="font-medium text-gray-800">Phone:</span> —
            </p>
            <p>
              <span className="font-medium text-gray-800">Region:</span> Kowloon
            </p>
          </div>
          <p className="mt-5 text-sm text-[#1565c0]">
            Sample page · not linked to the maintenance app
          </p>
        </div>

        <div className="h-6" />

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            Recent requests
          </h2>
          <div className="py-6 text-center text-gray-400">
            <History className="mx-auto mb-2 h-12 w-12 opacity-50" />
            <p>No requests</p>
          </div>
        </div>
      </main>

      {/* Decorative bottom bar (non-functional) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white px-2 pb-4 pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        aria-hidden
      >
        <div className="grid w-full grid-cols-4 items-end gap-1 pb-2 pt-1">
          {(
            [
              { label: 'Home', active: true, Icon: Home },
              { label: 'New', active: false, Icon: Wrench },
              { label: 'History', active: false, Icon: History },
              { label: 'Alerts', active: false, Icon: Bell },
            ] as const
          ).map(({ label, active, Icon }) => (
            <div
              key={label}
              className={`flex w-full min-w-0 flex-col items-center gap-1 px-1 py-1 text-[11px] ${
                active ? 'font-semibold text-[#1565c0]' : 'text-gray-400'
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  active ? 'bg-[#1565c0]/15 text-[#1565c0]' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </div>
              {label}
            </div>
          ))}
        </div>
      </nav>
    </div>
  )
}
