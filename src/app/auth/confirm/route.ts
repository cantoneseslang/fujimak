import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

/**
 * Supabase メール確認後のリダイレクト先（PKCE の code、または token_hash フロー）。
 * Dashboard の Redirect URLs に `{SITE_URL}/auth/confirm` を追加すること。
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null

  try {
    const supabase = await createSupabaseServerClient()

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(new URL('/stores', request.url))
      }
    }

    if (token_hash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash })
      if (!error) {
        return NextResponse.redirect(new URL('/stores', request.url))
      }
    }
  } catch {
    // redirect below
  }

  return NextResponse.redirect(
    new URL('/auth/sign-in?errorCode=email_confirmation_failed', request.url),
  )
}
