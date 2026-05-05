// CSVファイルを読み込んでパースするユーティリティ

export interface MaintenanceCategory {
  id: string
  name_ja: string
  name_en: string
  name_zh: string
}

export interface MaintenanceItem {
  id: string
  category_id: string
  name_ja: string
  name_en: string
  name_zh: string
  estimated_time: string
  flc_rq: boolean
}

export interface UrgencyLevel {
  id: string
  name_ja: string
  name_en: string
  name_zh: string
  color: string
}

// CSVをパースする汎用関数
function parseCSV<T>(csvText: string): T[] {
  const lines = csvText.trim().split('\n')
  const headers = lines[0].split(',')
  
  return lines.slice(1).map(line => {
    const values = line.split(',')
    const obj: Record<string, string | boolean> = {}
    
    headers.forEach((header, index) => {
      const value = values[index] || ''
      // boolean型の変換
      if (value === 'true') {
        obj[header] = true
      } else if (value === 'false') {
        obj[header] = false
      } else {
        obj[header] = value
      }
    })
    
    return obj as T
  })
}

// メンテナンスカテゴリーを読み込む
export async function loadMaintenanceCategories(): Promise<MaintenanceCategory[]> {
  const response = await fetch('/data/maintenance_categories.csv')
  const csvText = await response.text()
  return parseCSV<MaintenanceCategory>(csvText)
}

// メンテナンス項目を読み込む
export async function loadMaintenanceItems(): Promise<MaintenanceItem[]> {
  const response = await fetch('/data/maintenance_items.csv')
  const csvText = await response.text()
  return parseCSV<MaintenanceItem>(csvText)
}

// カテゴリー別にグループ化されたメンテナンス項目を取得
export async function loadMaintenanceItemsByCategory(): Promise<Record<string, MaintenanceItem[]>> {
  const items = await loadMaintenanceItems()
  
  return items.reduce((acc, item) => {
    if (!acc[item.category_id]) {
      acc[item.category_id] = []
    }
    acc[item.category_id].push(item)
    return acc
  }, {} as Record<string, MaintenanceItem[]>)
}

// 緊急度レベルを読み込む
export async function loadUrgencyLevels(): Promise<UrgencyLevel[]> {
  const response = await fetch('/data/urgency_levels.csv')
  const csvText = await response.text()
  return parseCSV<UrgencyLevel>(csvText)
}

// すべてのマスターデータを一括で読み込む
export async function loadAllMasterData() {
  const [categories, items, urgencyLevels] = await Promise.all([
    loadMaintenanceCategories(),
    loadMaintenanceItems(),
    loadUrgencyLevels(),
  ])
  
  const itemsByCategory = items.reduce((acc, item) => {
    if (!acc[item.category_id]) {
      acc[item.category_id] = []
    }
    acc[item.category_id].push(item)
    return acc
  }, {} as Record<string, MaintenanceItem[]>)
  
  return {
    categories,
    items,
    itemsByCategory,
    urgencyLevels,
  }
}
