'use client'

import dynamic from 'next/dynamic'
import RouteSegmentLoading from '@/components/RouteSegmentLoading'

const MaintenanceLazy = dynamic(() => import('./MaintenancePageClient'), {
  loading: () => <RouteSegmentLoading />,
})

export default function MaintenancePage() {
  return <MaintenanceLazy />
}
