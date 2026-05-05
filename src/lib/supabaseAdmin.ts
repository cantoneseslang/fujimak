import { createClient } from '@supabase/supabase-js'

const env = (value: string | undefined) => (typeof value === 'string' ? value.trim() : '')

export function getSupabaseAdmin() {
  const url = env(process.env.NEXT_PUBLIC_FUJIMAK_SUPABASE_URL) || env(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const serviceRoleKey = env(process.env.FUJIMAK_SUPABASE_SERVICE_ROLE_KEY) || env(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!url) throw new Error('Missing NEXT_PUBLIC_FUJIMAK_SUPABASE_URL')
  if (!serviceRoleKey) throw new Error('Missing FUJIMAK_SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

