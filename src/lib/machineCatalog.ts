export type MachineSeries = 'energy-saving' | 'compact' | 'standard' | 'pizza' | 'long'

export interface JetOvenPageMasterEntry {
  pageNo: number
  title: string
  summary: string
  detectedModels: string[]
}

export interface MachineCatalogEntry {
  id: string
  brand: 'fujimak'
  family: 'jet-oven'
  series: MachineSeries
  modelCode: string
  displayName: string
  conveyorWidthMm: number | null
  levels: number | null
  powerSource: 'gas' | 'electric' | 'gas-or-electric' | 'unknown'
  supportsSteam: boolean
  sourcePageNos: number[]
  faultLocations: string[]
  recommendedPartIds: string[]
}

export const DEFAULT_FAULT_LOCATIONS = [
  'Conveyor inlet',
  'Conveyor outlet',
  'Conveyor belt',
  'Finger nozzles',
  'Touch panel',
  'Combustion chamber',
  'Steam nozzle',
  'Drain connection',
  'Gas connection',
  'Power connection',
] as const

// Extracted from JetOven no.1-28 viewer pages via OCR.
export const JET_OVEN_PAGE_MASTER: JetOvenPageMasterEntry[] = [
  { pageNo: 1, title: 'Cover', summary: 'Jet Oven catalog cover with series overview.', detectedModels: [] },
  {
    pageNo: 2,
    title: 'Series Introduction',
    summary: 'Overview of model range and jet propulsion cooking concept.',
    detectedModels: [],
  },
  { pageNo: 3, title: 'Lineup', summary: 'Energy-Saving, Compact, Standard, Pizza, and Long series lineup.', detectedModels: [] },
  { pageNo: 4, title: 'Jet Heating', summary: 'How jet-propelled heat cooks quickly and evenly.', detectedModels: [] },
  { pageNo: 5, title: 'Conveyor Concept', summary: 'Continuous conveyor cooking and twin conveyor usage.', detectedModels: [] },
  { pageNo: 6, title: 'Control Panel', summary: 'Touch panel, cooking memory, and eco operation controls.', detectedModels: [] },
  { pageNo: 7, title: 'Efficiency', summary: 'High-speed heating and thermal efficiency details.', detectedModels: [] },
  {
    pageNo: 8,
    title: 'Energy-Saving Series',
    summary: 'Energy-saving model concept with steam support and two conveyor widths.',
    detectedModels: ['FGJOB5Z', 'FGJOB5WDZ', 'FGJOB5WZ', 'FGJOB5WDT'],
  },
  {
    pageNo: 9,
    title: 'Energy-Saving Specifications',
    summary: 'Dimensions and performance data for Energy-Saving models.',
    detectedModels: ['FGJOB5TZ', 'FGJOB5DTZ', 'FGJOB5WT', 'FGJOB5WDT'],
  },
  {
    pageNo: 10,
    title: 'Energy-Saving for Pizza',
    summary: 'Pizza-optimized energy-saving models and capacities.',
    detectedModels: ['FGJOB7Z', 'FGJOB7DZ', 'FGJOB7WZ', 'FGJOB7WDZ'],
  },
  {
    pageNo: 11,
    title: 'Compact Series',
    summary: 'Compact depth models for limited kitchen space.',
    detectedModels: ['FGJOA9', 'FGJOA9H', 'FGJOB10'],
  },
  { pageNo: 12, title: 'Compact Use Cases', summary: 'A la carte speed and cleanability in compact kitchens.', detectedModels: ['FGJOA9'] },
  {
    pageNo: 13,
    title: 'Compact Specifications',
    summary: 'Compact model dimensions and utility requirements.',
    detectedModels: ['FGJOA9', 'FGJOA9H', 'FGJOB10'],
  },
  {
    pageNo: 14,
    title: 'Standard Series',
    summary: 'Standard series range for restaurants and central kitchens.',
    detectedModels: ['FGJOA5', 'FGJOA5D', 'FGJOA5W', 'FGJOA5WD'],
  },
  { pageNo: 15, title: 'Standard Features', summary: 'Shutters, windows, steam options, and washability features.', detectedModels: ['FGJOA5S', 'FGJOA5WS'] },
  {
    pageNo: 16,
    title: 'Standard 457mm Specs',
    summary: '457mm conveyor standard model specs and dimensions.',
    detectedModels: ['FGJOA5T', 'FGJOA5DT'],
  },
  {
    pageNo: 17,
    title: 'Standard 812mm Specs',
    summary: '812mm conveyor standard model specs and dimensions.',
    detectedModels: ['FGJOA5WT', 'FGJOA5WDT'],
  },
  {
    pageNo: 18,
    title: 'Jet Oven for Pizzas',
    summary: 'Pizza-oriented jet airflow, nozzle layout, and production use.',
    detectedModels: ['FGJOA7', 'FGJOA7D', 'FGJOA7W', 'FGJOA7WD'],
  },
  {
    pageNo: 19,
    title: 'Long Series',
    summary: 'Large-scale production models with modular heating zones.',
    detectedModels: ['FGJOA30NR', 'FGJOA50NR', 'FGJOA70NR'],
  },
  {
    pageNo: 20,
    title: 'Long Series Features',
    summary: 'Steam support, conveyor types, and chamber cleaning features.',
    detectedModels: ['FGJOA30NR', 'FGJOA50NR', 'FGJOA70NR'],
  },
  {
    pageNo: 21,
    title: 'Long Series Layout',
    summary: 'Long series installation and production-line examples.',
    detectedModels: ['FGJOA30', 'FGJOA50', 'FGJOA70'],
  },
  { pageNo: 22, title: 'Optional Systems', summary: 'Tray loader, return conveyor, and linked model options.', detectedModels: [] },
  { pageNo: 23, title: 'Browning/Searing Systems', summary: 'Auxiliary machines and net cleaning systems.', detectedModels: [] },
  { pageNo: 24, title: 'Accessories', summary: 'Pans and grids for each Jet Oven series.', detectedModels: [] },
  { pageNo: 25, title: 'Cooking Examples (Meat)', summary: 'Per-hour production examples for meat dishes by model.', detectedModels: ['FGJOA5', 'FGJOA9H', 'FGJOA30'] },
  { pageNo: 26, title: 'Cooking Examples (Fish)', summary: 'Per-hour production examples for fish dishes by model.', detectedModels: ['FGJOA5', 'FGJOA9H', 'FGJOA30'] },
  { pageNo: 27, title: 'Cooking Examples (Egg/Steam)', summary: 'Egg and steam-cooking sample throughput by model.', detectedModels: ['FGJOA5S', 'FGJOA5WS'] },
  { pageNo: 28, title: 'Company Information', summary: 'Global Fujimak contact and office information.', detectedModels: [] },
]

const SERIES_PARTS: Record<MachineSeries, string[]> = {
  'energy-saving': ['oven-pan-single', 'oven-pan-twin', 'grooved-pan-657', 'flat-grid-single'],
  compact: ['oven-pan-single', 'grooved-pan-single-twin', 'curved-grid', 'flat-grid-single'],
  standard: ['oven-pan-single', 'oven-pan-657', 'grooved-pan-657-second', 'flat-grid-long'],
  pizza: ['oven-pan-single', 'flat-grid-single', 'curved-grid'],
  long: ['oven-pan-657', 'flat-grid-long', 'grooved-pan-657-second'],
}

function machine(
  modelCode: string,
  series: MachineSeries,
  conveyorWidthMm: number | null,
  levels: number | null,
  sourcePageNos: number[],
  powerSource: MachineCatalogEntry['powerSource'],
  supportsSteam: boolean
): MachineCatalogEntry {
  return {
    id: `jet-oven-${modelCode.toLowerCase()}`,
    brand: 'fujimak',
    family: 'jet-oven',
    series,
    modelCode,
    displayName: `Jet Oven ${modelCode}`,
    conveyorWidthMm,
    levels,
    powerSource,
    supportsSteam,
    sourcePageNos,
    faultLocations: [...DEFAULT_FAULT_LOCATIONS],
    recommendedPartIds: SERIES_PARTS[series],
  }
}

export const MACHINE_CATALOG: MachineCatalogEntry[] = [
  machine('FGJOB5Z', 'energy-saving', 457, 1, [8, 9], 'gas', false),
  machine('FGJOB5DZ', 'energy-saving', 457, 2, [8, 9], 'gas', false),
  machine('FGJOB5WZ', 'energy-saving', 812, 1, [8, 9], 'gas', false),
  machine('FGJOB5WDZ', 'energy-saving', 812, 2, [8, 9], 'gas', false),
  machine('FGJOB7Z', 'energy-saving', 457, 1, [10], 'gas', false),
  machine('FGJOB7DZ', 'energy-saving', 457, 2, [10], 'gas', false),
  machine('FGJOB7WZ', 'energy-saving', 812, 1, [10], 'gas', false),
  machine('FGJOB7WDZ', 'energy-saving', 812, 2, [10], 'gas', false),
  machine('FGJOA9', 'compact', 456, 1, [11, 12, 13], 'gas-or-electric', false),
  machine('FGJOA9H', 'compact', 456, 1, [11, 13], 'gas', false),
  machine('FGJOB10', 'compact', 456, 1, [11, 13], 'gas', false),
  machine('FGJOA5', 'standard', 457, 1, [14, 16], 'gas-or-electric', false),
  machine('FGJOA5D', 'standard', 457, 2, [14, 16], 'gas-or-electric', false),
  machine('FGJOA5W', 'standard', 812, 1, [14, 17], 'gas-or-electric', false),
  machine('FGJOA5WD', 'standard', 812, 2, [14, 17], 'gas-or-electric', false),
  machine('FGJOA7', 'pizza', 458, 1, [18], 'gas', false),
  machine('FGJOA7D', 'pizza', 458, 2, [18], 'gas', false),
  machine('FGJOA7W', 'pizza', 812, 1, [18], 'gas', false),
  machine('FGJOA7WD', 'pizza', 812, 2, [18], 'gas', false),
  machine('FGJOA30NR', 'long', null, 1, [19, 20, 21], 'gas', true),
  machine('FGJOA50NR', 'long', null, 2, [19, 20, 21], 'gas', true),
  machine('FGJOA70NR', 'long', null, 3, [19, 20, 21], 'gas', true),
]

export function getMachineById(machineId: string | null | undefined) {
  if (!machineId) return null
  return MACHINE_CATALOG.find((machine) => machine.id === machineId) ?? null
}

export function getMachineByModelCode(modelCode: string | null | undefined) {
  if (!modelCode) return null
  const normalized = modelCode.trim().toUpperCase()
  return MACHINE_CATALOG.find((machine) => machine.modelCode === normalized) ?? null
}
