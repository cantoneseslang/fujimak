import type { MaintenanceRequestRecord } from '@/lib/maintenance'

export type ForBillingOption = 'warranty' | 'billing'
export type ConditionLevel = 'perfect' | 'not_good' | 'dangerous'

export interface MaintenanceReportFormSnapshot {
  formCode: string
  clientLabel: string
  picName: string
  locationText: string
  equipmentLabel: string
  brand: string
  serialNumber: string
  startTimeDisplay: string
  finishTimeDisplay: string
  forBilling: ForBillingOption
  billingNote: string
  concern: string
  actionTaken: string
  recommendation: string
  checklistComments: string[]
  rank: 'A' | 'B' | 'C' | 'D' | 'E'
  conditionLevel: ConditionLevel
  statusF: string
  technicianName: string
  supervisorName: string
  clientSignatoryName: string
  operationDateText: string
  technicianSignatureDataUrl: string
  supervisorSignatureDataUrl: string
}

export const MAINTENANCE_CHECKLIST_LABELS = [
  'Power supply, voltage',
  'Amps',
  'Filter, Condenser',
  'Compressor',
  'Refrigeration leak',
  'Wiring, Piping',
  'Fire condition',
  'Gas Leak',
  'Sound',
  'Screw, Bolt',
] as const

/** Fujimak Maintenance Report ranking options (PDF + UI). */
export const MAINTENANCE_RANK_OPTIONS = [
  { rank: 'A' as const, label: 'A: Unit Operational' },
  { rank: 'B' as const, label: 'B: For Replacement part(s)' },
  { rank: 'C' as const, label: 'C: For Observation' },
  { rank: 'D' as const, label: 'D: For pull out-shop evaluation and repair' },
  { rank: 'E' as const, label: 'E: For Unit Replacement' },
] as const

export function rankLabel(rank: MaintenanceReportFormSnapshot['rank']): string {
  const row = MAINTENANCE_RANK_OPTIONS.find((o) => o.rank === rank)
  return row?.label ?? `Rank ${rank}`
}

export const MAINTENANCE_CHECKLIST_COMMENT_MAX = 120

const MAX_COMMENT_LEN = MAINTENANCE_CHECKLIST_COMMENT_MAX

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseMaintenanceRank(value: unknown): MaintenanceReportFormSnapshot['rank'] {
  const t = asText(value).toUpperCase()
  if (t === 'A' || t === 'B' || t === 'C' || t === 'D' || t === 'E') return t
  return 'A'
}

function pickRank(value: unknown): MaintenanceReportFormSnapshot['rank'] {
  return parseMaintenanceRank(value)
}

function pickCondition(value: unknown): ConditionLevel {
  const t = asText(value)
  if (t === 'not_good' || t === 'dangerous' || t === 'perfect') return t
  return 'perfect'
}

function pickForBilling(value: unknown): ForBillingOption {
  const t = asText(value).toLowerCase()
  if (t === 'warranty') return 'warranty'
  return 'billing'
}

function getLatestByLabel(remarks: string, label: string) {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = [...remarks.matchAll(new RegExp(`${safeLabel}:\\s*([^\\n\\r]+)`, 'g'))]
  if (matches.length === 0) return ''
  const latest = matches[matches.length - 1]?.[1]
  return latest ? latest.trim() : ''
}

function formatScheduleDisplay(isoLike: string) {
  const raw = asText(isoLike)
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

function operationDateFromRecord(record: MaintenanceRequestRecord) {
  const raw = asText(record.completed_at) || asText(record.updated_at)
  if (!raw) return new Date().toLocaleDateString('en-PH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
  const d = new Date(raw)
  if (Number.isNaN(d.getTime()))
    return new Date().toLocaleDateString('en-PH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
  return d.toLocaleDateString('en-PH', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function defaultMaintenanceReportForm(): MaintenanceReportFormSnapshot {
  const na = () => MAINTENANCE_CHECKLIST_LABELS.map(() => 'NA')
  return {
    formCode: 'FPC011',
    clientLabel: '',
    picName: '',
    locationText: '',
    equipmentLabel: '',
    brand: '',
    serialNumber: '',
    startTimeDisplay: '',
    finishTimeDisplay: '',
    forBilling: 'billing',
    billingNote: '',
    concern: '',
    actionTaken: '',
    recommendation: '',
    checklistComments: na(),
    rank: 'A',
    conditionLevel: 'perfect',
    statusF: '1: Completed',
    technicianName: '',
    supervisorName: '',
    clientSignatoryName: '',
    operationDateText: '',
    technicianSignatureDataUrl: '',
    supervisorSignatureDataUrl: '',
  }
}

export function normalizeMaintenanceChecklistComments(input: unknown): string[] {
  const base = defaultMaintenanceReportForm().checklistComments
  if (!Array.isArray(input)) return base
  const out = [...base]
  for (let i = 0; i < MAINTENANCE_CHECKLIST_LABELS.length; i++) {
    const v = asText(input[i])
    out[i] = v ? v.slice(0, MAX_COMMENT_LEN) : 'NA'
  }
  return out
}

function normalizeChecklist(input: unknown): string[] {
  return normalizeMaintenanceChecklistComments(input)
}

/** Merge DB snapshot / API partial with defaults and inferred values from maintenance_requests */
export function buildMaintenanceReportFormState(
  record: MaintenanceRequestRecord,
  partial?: unknown
): MaintenanceReportFormSnapshot {
  const d = defaultMaintenanceReportForm()
  const p = partial && typeof partial === 'object' ? (partial as Record<string, unknown>) : {}

  const remarks = asText(record.remarks)
  const workStartedRaw = getLatestByLabel(remarks, 'WorkStartedAt')
  const recordedRaw = getLatestByLabel(remarks, 'RecordedAt') || asText(record.completed_at)
  const comment = getLatestByLabel(remarks, 'Comment')

  const inferredStart = formatScheduleDisplay(workStartedRaw)
  const inferredFinish = formatScheduleDisplay(recordedRaw)

  return {
    formCode: asText(p.formCode) || d.formCode,
    clientLabel: asText(p.clientLabel) || asText(record.requested_by) || asText(record.store_name) || record.store_id,
    picName: asText(p.picName) || asText(record.requested_by) || '',
    locationText:
      asText(p.locationText) ||
      asText(record.fault_location) ||
      asText(record.store_name) ||
      record.store_id,
    equipmentLabel:
      asText(p.equipmentLabel) ||
      asText(record.machine_name) ||
      asText(record.machine_model) ||
      asText(record.item_id) ||
      '-',
    brand: asText(p.brand) || asText(record.machine_model) || '-',
    serialNumber: asText(p.serialNumber) || asText(record.machine_serial) || '-',
    startTimeDisplay: asText(p.startTimeDisplay) || inferredStart || '-',
    finishTimeDisplay: asText(p.finishTimeDisplay) || inferredFinish || '-',
    forBilling: pickForBilling(p.forBilling),
    billingNote: asText(p.billingNote).slice(0, 500),
    concern:
      asText(p.concern) ||
      asText(record.symptom) ||
      asText(record.troubleshooting_summary) ||
      '-',
    actionTaken: asText(p.actionTaken) || comment || '-',
    recommendation: asText(p.recommendation).slice(0, 2000),
    checklistComments: normalizeChecklist(p.checklistComments),
    rank: pickRank(p.rank),
    conditionLevel: pickCondition(p.conditionLevel),
    statusF: asText(p.statusF) || d.statusF,
    technicianName: asText(p.technicianName),
    supervisorName: asText(p.supervisorName),
    clientSignatoryName: asText(p.clientSignatoryName),
    operationDateText: asText(p.operationDateText) || operationDateFromRecord(record),
    technicianSignatureDataUrl: asText(p.technicianSignatureDataUrl),
    supervisorSignatureDataUrl: asText(p.supervisorSignatureDataUrl),
  }
}

export function serializeMaintenanceReportForm(form: MaintenanceReportFormSnapshot): Record<string, unknown> {
  return { ...form }
}
