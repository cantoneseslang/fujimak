import type { PartsOrderDraft, PartsOrderItem } from '@/lib/partsOrder'
import { PARTS_CATALOG } from '@/lib/partsCatalog'

const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
const asNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

export function parsePartsOrderDraftFromBody(body: unknown): { ok: true; draft: PartsOrderDraft } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid JSON body' }
  }
  const b = body as Record<string, unknown>
  const draft: PartsOrderDraft = {
    storeId: asText(b.storeId),
    storeName: asText(b.storeName),
    locale: asText(b.locale) || 'en',
    notes: asText(b.notes),
    recipient: asText(b.recipient) || 'Fujimak',
    currency: asText(b.currency) || 'JPY',
    createdAt: asText(b.createdAt) || new Date().toISOString(),
    machineId: asText(b.machineId) || undefined,
    machineName: asText(b.machineName) || undefined,
    machineModel: asText(b.machineModel) || undefined,
    machineSerial: asText(b.machineSerial) || undefined,
    items: Array.isArray(b.items)
      ? (b.items as PartsOrderItem[])
          .map((item) => ({
            id: asText(item?.id),
            name: asText(item?.name),
            specs: Array.isArray(item?.specs) ? item.specs.map((s) => asText(s)).filter(Boolean) : [],
            quantity: Math.max(0, Math.floor(asNumber(item?.quantity))),
            unitPrice: Math.max(0, asNumber(item?.unitPrice)),
            imageId: asText(item?.imageId) || undefined,
          }))
          .filter((item) => item.id && item.name && item.quantity > 0)
      : [],
  }

  if (!draft.storeId || !draft.storeName) {
    return { ok: false, error: 'storeId/storeName are required' }
  }
  if (draft.items.length === 0) {
    return { ok: false, error: 'At least one item is required' }
  }
  if (draft.items.some((item) => item.unitPrice <= 0)) {
    return { ok: false, error: 'Each item requires unitPrice > 0' }
  }

  draft.items = draft.items.map((item) => ({
    ...item,
    imageId: item.imageId || PARTS_CATALOG.find((c) => c.id === item.id)?.imageId,
  }))

  return { ok: true, draft }
}
