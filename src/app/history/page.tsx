'use client'

import dynamic from 'next/dynamic'
import RouteSegmentLoading from '@/components/RouteSegmentLoading'

const HistoryLazy = dynamic(() => import('./HistoryPageClient'), {
  loading: () => <RouteSegmentLoading />,
})

export default function HistoryPage() {
  return <HistoryLazy />
}
