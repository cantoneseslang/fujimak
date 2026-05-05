import type { ForBillingOption } from '@/lib/maintenanceReportForm'

const STORAGE_KEY = 'mechanic-maintenance-report-draft-v1'

export type MechanicReportDraft = {
  requestId: string
  forBilling: ForBillingOption
  billingNote: string
  concern: string
}

export function saveMechanicReportDraft(payload: MechanicReportDraft) {
  if (typeof window === 'undefined' || !payload.requestId) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function loadMechanicReportDraft(requestId: string): MechanicReportDraft | null {
  if (typeof window === 'undefined' || !requestId) return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<MechanicReportDraft>
    if (parsed.requestId !== requestId) return null
    const forBilling = parsed.forBilling === 'warranty' ? 'warranty' : 'billing'
    return {
      requestId,
      forBilling,
      billingNote: typeof parsed.billingNote === 'string' ? parsed.billingNote : '',
      concern: typeof parsed.concern === 'string' ? parsed.concern : '',
    }
  } catch {
    return null
  }
}

export function clearMechanicReportDraft() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}
