'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

export default function SplashPage() {
  const router = useRouter()
  const t = useTranslations('splash')

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/stores')
    }, 2500)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white flex flex-col items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10),rgba(0,0,0,0.95)_60%)]" />

      <div className="relative transition-all duration-1000 opacity-100 scale-100">
        <div className="relative w-[360px] h-[170px] logo-animation drop-shadow-[0_0_28px_rgba(255,255,255,0.28)]">
          <div className="relative w-full h-full" style={{ transform: 'scale(2)', transformOrigin: 'center' }}>
            <Image
              src="/images/fujimak rogo-all-w2.png"
              alt="Fujimak"
              fill
              className="object-contain"
              sizes="360px"
              priority
            />
          </div>
        </div>
      </div>

      <p className="absolute bottom-8 text-gray-500 text-sm tracking-wide">
        {t('copyright')}
      </p>
    </main>
  )
}
