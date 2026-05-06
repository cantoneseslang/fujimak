'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMaintenanceRequests, type MaintenanceListQuery } from '@/lib/maintenance'

/** Stable primitive key — avoids refetch loops from new object identity each render */
export function maintenanceQueryKey(query: MaintenanceListQuery) {
  return [
    'maintenance',
    query.storeId ?? '',
    query.status ?? '',
    String(query.limit ?? ''),
    query.windowStart ?? '',
    query.windowEnd ?? '',
  ] as const
}

export function useMaintenanceRequestsQuery(query: MaintenanceListQuery, enabled = true) {
  return useQuery({
    queryKey: maintenanceQueryKey(query),
    queryFn: ({ signal }) => fetchMaintenanceRequests(query, signal),
    enabled,
    staleTime: 90_000,
    gcTime: 45 * 60_000,
  })
}

export function useInvalidateMaintenanceLists() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['maintenance'] })
}
