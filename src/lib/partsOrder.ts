export interface PartsOrderItem {
  id: string
  name: string
  specs: string[]
  quantity: number
  unitPrice: number
  /** Catalog image key for `/api/parts-image/[imageId]` */
  imageId?: string
}

export interface PartsOrderDraft {
  storeId: string
  storeName: string
  locale: string
  notes: string
  recipient: string
  currency: string
  createdAt: string
  machineId?: string
  machineName?: string
  machineModel?: string
  machineSerial?: string
  items: PartsOrderItem[]
}

export const PARTS_ORDER_DRAFT_KEY = 'parts-order-draft-v1'

export function calculateOrderTotals(items: PartsOrderItem[]) {
  let totalUnits = 0
  let totalAmount = 0
  for (const item of items) {
    totalUnits += item.quantity
    totalAmount += item.quantity * item.unitPrice
  }
  return { totalUnits, totalAmount }
}
