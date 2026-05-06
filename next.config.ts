import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  /** PDFKit はバンドルすると Helvetica.afm 等のパスが壊れるため、node_modules から直接解決する */
  serverExternalPackages: ['pdfkit'],
  /** 開発時の Next ロゴ／Dev Tools インジケーター（nextjs-portal 由来の UI）を出さない */
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
