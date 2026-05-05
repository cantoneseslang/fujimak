import { STORES } from '@/lib/constants'
import { MACHINE_CATALOG, type MachineCatalogEntry } from '@/lib/machineCatalog'

export interface StoreMachineEntry {
  id: string
  storeId: string
  machineId: string
  machineSerial: string
  installedAt: string | null
}

const DEFAULT_MODEL_ROTATION = [
  'jet-oven-fgjoa5',
  'jet-oven-fgjoa5w',
  'jet-oven-fgjoa9',
  'jet-oven-fgjoa7',
]

const FALLBACK_MODEL = MACHINE_CATALOG[0]?.id ?? 'jet-oven-fgjoa5'

const buildDefaultStoreMachines = () => {
  const rows: StoreMachineEntry[] = []
  for (const [index, store] of STORES.entries()) {
    const modelId = DEFAULT_MODEL_ROTATION[index % DEFAULT_MODEL_ROTATION.length] ?? FALLBACK_MODEL
    rows.push({
      id: `store-machine-${store.id.toLowerCase()}-1`,
      storeId: store.id,
      machineId: modelId,
      machineSerial: `JO-${store.id}-01`,
      installedAt: null,
    })
  }
  return rows
}

export const STORE_MACHINE_MAP: StoreMachineEntry[] = buildDefaultStoreMachines()

export function getStoreMachines(storeId: string): Array<StoreMachineEntry & { machine: MachineCatalogEntry | null }> {
  return STORE_MACHINE_MAP.filter((row) => row.storeId === storeId).map((row) => ({
    ...row,
    machine: MACHINE_CATALOG.find((machine) => machine.id === row.machineId) ?? null,
  }))
}
