import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const env = (value: string | undefined) => (typeof value === 'string' ? value.trim() : '')

function isReadOnlyCookiesError(error: unknown) {
  const msg = error instanceof Error ? error.message : ''
  return /Cookies can only be modified in a Server Action or Route Handler/i.test(msg)
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  const url = env(process.env.NEXT_PUBLIC_FUJIMAK_SUPABASE_URL) || env(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKey =
    env(process.env.NEXT_PUBLIC_FUJIMAK_SUPABASE_ANON_KEY) || env(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_FUJIMAK_SUPABASE_URL or NEXT_PUBLIC_FUJIMAK_SUPABASE_ANON_KEY'
    )
  }

  const secureCookies = process.env.NODE_ENV === 'production'

  return createServerClient(url, anonKey, {
    cookieOptions: {
      secure: secureCookies,
      sameSite: 'lax',
      path: '/',
    },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch (e) {
          if (isReadOnlyCookiesError(e)) return
          throw e
        }
      },
    },
  })
}
