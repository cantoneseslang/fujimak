export type MaintenanceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type ScheduleChangeStatus = 'none' | 'pending' | 'approved' | 'rescheduled'
export type MaintenanceSource = 'staff_portal' | 'customer_call' | 'troubleshooting_escalation'

export interface MaintenanceAttachment {
  name?: string
  type?: 'image' | 'video'
  source?: string
  url?: string
}

export interface MaintenanceRequestRecord {
  id: string
  store_id: string
  store_name: string
  category_id: string | null
  item_id: string | null
  machine_id: string | null
  machine_name: string | null
  machine_model: string | null
  machine_serial: string | null
  fault_location: string | null
  symptom: string | null
  photo_urls: string[]
  request_flow: string
  machine_source_pages: number[]
  urgency: 'urgent' | 'normal' | 'estimate'
  remarks: string | null
  attachments: MaintenanceAttachment[]
  preferred_date: string
  preferred_start_time: string | null
  preferred_end_time: string | null
  status: MaintenanceStatus
  source: MaintenanceSource
  troubleshooting_summary: string | null
  requested_by: string | null
  requested_phone: string | null
  requested_email: string | null
  vendor_name: string | null
  assigned_mechanic_id?: string | null
  assignment_state?: string | null
  assigned_at?: string | null
  scheduled_date: string | null
  scheduled_start_time: string | null
  scheduled_end_time: string | null
  vendor_proposed_date: string | null
  vendor_proposed_start_time: string | null
  vendor_proposed_end_time: string | null
  schedule_change_status: ScheduleChangeStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateMaintenanceRequestInput {
  storeId: string
  storeName: string
  categoryId?: string
  itemId?: string
  machineId: string
  machineName: string
  machineModel?: string
  machineSerial: string
  faultLocation: string
  symptom: string
  photoUrls?: string[]
  machineSourcePages?: number[]
  urgency: 'urgent' | 'normal' | 'estimate'
  remarks?: string
  attachments?: MaintenanceAttachment[]
  preferredDate: string
  preferredStartTime?: string
  preferredEndTime?: string
  source?: MaintenanceSource
  troubleshootingSummary?: string
  requestedBy?: string
  requestedPhone?: string
  requestedEmail?: string
  vendorName?: string
}

export interface MaintenanceListQuery {
  storeId?: string
  status?: MaintenanceStatus
  limit?: number
}

const toQueryString = (query?: MaintenanceListQuery) => {
  if (!query) return ''
  const params = new URLSearchParams()
  if (query.storeId) params.set('storeId', query.storeId)
  if (query.status) params.set('status', query.status)
  if (typeof query.limit === 'number') params.set('limit', String(query.limit))
  const q = params.toString()
  return q.length > 0 ? `?${q}` : ''
}

async function readResponseErrorMessage(res: Response, fallback: string) {
  const text = await res.text()
  if (!text) return fallback
  try {
    const json = JSON.parse(text) as { error?: string; message?: string }
    return json.error || json.message || fallback
  } catch {
    if (/request entity too large/i.test(text)) {
      return 'Request payload is too large. Please reduce photo size/count and try again.'
    }
    return text
  }
}

export async function fetchMaintenanceRequests(query?: MaintenanceListQuery) {
  const endpoint = `/api/maintenance${toQueryString(query)}`
  let res = await fetch(endpoint, { cache: 'no-store' })
  if (!res.ok) {
    // One quick retry helps absorb transient DB/network hiccups.
    await new Promise((resolve) => setTimeout(resolve, 250))
    res = await fetch(endpoint, { cache: 'no-store' })
  }
  if (!res.ok) return []
  const json = (await res.json()) as { requests?: MaintenanceRequestRecord[] }
  return json.requests ?? []
}

export async function createMaintenanceRequest(input: CreateMaintenanceRequestInput) {
  const res = await fetch('/api/maintenance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const message = await readResponseErrorMessage(res, 'Failed to create maintenance request')
    throw new Error(message)
  }
  const text = await res.text()
  let json: { request?: MaintenanceRequestRecord } = {}
  try {
    json = JSON.parse(text) as { request?: MaintenanceRequestRecord }
  } catch {
    throw new Error('Unexpected server response while creating maintenance request')
  }
  if (!json.request) {
    throw new Error('Maintenance request was created but response body was invalid')
  }
  return json.request
}

export async function updateMaintenanceRequest(
  requestId: string,
  payload: {
    status?: MaintenanceStatus
    scheduledDate?: string
    scheduledStartTime?: string
    scheduledEndTime?: string
    vendorProposedDate?: string
    vendorProposedStartTime?: string
    vendorProposedEndTime?: string
    scheduleChangeStatus?: ScheduleChangeStatus
    remarks?: string
  }
) {
  const res = await fetch(`/api/maintenance/${requestId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const json = (await res.json()) as { error?: string }
    throw new Error(json.error ?? 'Failed to update maintenance request')
  }
  const json = (await res.json()) as { request: MaintenanceRequestRecord }
  return json.request
}
