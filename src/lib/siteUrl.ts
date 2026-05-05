/**
 * 公開サイトのオリジン（メール確認リンクの redirect_to 用）。
 * Vercel では `VERCEL_URL` が自動設定されるが、本番ドメイン固定なら `NEXT_PUBLIC_SITE_URL` を推奨。
 */
export function getPublicSiteUrl() {
  const explicit =
    typeof process.env.NEXT_PUBLIC_SITE_URL === 'string'
      ? process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, '')
      : ''
  if (explicit) return explicit

  const vercel =
    typeof process.env.VERCEL_URL === 'string' ? process.env.VERCEL_URL.trim() : ''
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}`

  return 'http://localhost:3000'
}
