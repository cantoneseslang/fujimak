'use client'

import dynamic from 'next/dynamic'
import RouteSegmentLoading from '@/components/RouteSegmentLoading'

const ManagementLazy = dynamic(() => import('./ManagementPageClient'), {
  loading: () => <RouteSegmentLoading />,
})

export default function ManagementPage() {
  return <ManagementLazy />
}
