import { ANGEL_PIZZA_STORES } from './angelStores'

// Fujimakブランドカラー
export const COLORS = {
  primary: '#111111',      // Fujimak Black
  primaryLight: '#2F2F2F', // Dark Gray Accent
  secondary: '#1F2937',    // Slate Gray
  background: '#FFFFFF',
  text: '#333333',
  textLight: '#666666',
  border: '#E5E5E5',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
}

// メンテナンスカテゴリー（エリア）
export const MAINTENANCE_CATEGORIES = [
  { id: 'all-area', name_ja: '全域', name_en: 'All Areas', name_zh: '全域' },
  { id: 'exterior', name_ja: '店外', name_en: 'Exterior', name_zh: '店外' },
  { id: 'kitchen', name_ja: '厨房', name_en: 'Kitchen', name_zh: '廚房' },
  { id: 'pantry', name_ja: 'パントリー', name_en: 'Pantry', name_zh: '配膳間' },
  { id: 'toilet', name_ja: 'トイレ', name_en: 'Toilet', name_zh: '洗手間' },
  { id: 'staff-room', name_ja: 'スタッフルーム', name_en: 'Staff Room', name_zh: '員工室' },
]

// メンテナンス項目
export const MAINTENANCE_ITEMS = {
  'all-area': [
    { id: 'lighting', name_ja: '照明交換、修繕', name_en: 'Lighting Repair/Replacement', name_zh: '照明維修更換', estimated_time: '1~2週前後', flc_rq: true },
    { id: 'formica', name_ja: 'FORMICA修繕', name_en: 'FORMICA Repair', name_zh: 'FORMICA維修', estimated_time: '1~2週前後', flc_rq: false },
    { id: 'wood-furniture', name_ja: '木器家具修繕', name_en: 'Wooden Furniture Repair', name_zh: '木器家具維修', estimated_time: '1ヶ月以内', flc_rq: true },
    { id: 'sus-furniture', name_ja: 'SUS/木器家具発注', name_en: 'SUS/Wood Furniture Order', name_zh: 'SUS/木器家具訂購', estimated_time: '1ヶ月以内', flc_rq: true },
    { id: 'baseboard', name_ja: '巾木修繕', name_en: 'Baseboard Repair', name_zh: '踢腳板維修', estimated_time: '1~2週前後', flc_rq: true },
    { id: 'pvc-floor', name_ja: 'PVC床タイル修繕・交換', name_en: 'PVC Floor Tile Repair', name_zh: 'PVC地板維修更換', estimated_time: '1~2週前後', flc_rq: true },
    { id: 'wall-glass', name_ja: '壁・ガラス関連', name_en: 'Wall/Glass Related', name_zh: '牆壁玻璃相關', estimated_time: '1~2週前後', flc_rq: true },
    { id: 'ceiling', name_ja: '天井塗装・スケルトン修繕', name_en: 'Ceiling Paint/Skeleton Repair', name_zh: '天花板油漆維修', estimated_time: '1~2週前後', flc_rq: true },
    { id: 'ac-ventilation', name_ja: 'エアコン、除湿器、通風関連修繕', name_en: 'AC/Dehumidifier/Ventilation', name_zh: '空調除濕通風維修', estimated_time: '1~2日以内', flc_rq: true },
    { id: 'door', name_ja: '扉修繕', name_en: 'Door Repair', name_zh: '門維修', estimated_time: '1週間以内', flc_rq: true },
    { id: 'water-cooler', name_ja: '冷水機修理', name_en: 'Water Cooler Repair', name_zh: '冷水機維修', estimated_time: '1週間以内', flc_rq: false },
    { id: 'water-purifier', name_ja: '浄水器関連', name_en: 'Water Purifier Related', name_zh: '淨水器相關', estimated_time: '1~2日以内', flc_rq: false },
    { id: 'monitor', name_ja: 'モニター関連', name_en: 'Monitor Related', name_zh: '監視器相關', estimated_time: '1週間以内', flc_rq: false },
    { id: 'speaker', name_ja: 'スピーカー関連', name_en: 'Speaker Related', name_zh: '揚聲器相關', estimated_time: '1週間以内', flc_rq: false },
    { id: 'fire-equipment', name_ja: '消防設備関連', name_en: 'Fire Equipment Related', name_zh: '消防設備相關', estimated_time: '1~2日以内', flc_rq: true },
    { id: 'drain-pump', name_ja: '排水ポンプ関連', name_en: 'Drain Pump Related', name_zh: '排水泵相關', estimated_time: '1~2日以内', flc_rq: false },
    { id: 'showcase-fridge', name_ja: 'ショーケース冷蔵庫修理', name_en: 'Showcase Refrigerator Repair', name_zh: '展示櫃冰箱維修', estimated_time: '1週間以内', flc_rq: false },
    { id: 'caulking', name_ja: 'コーキング手配', name_en: 'Caulking Arrangement', name_zh: '填縫安排', estimated_time: '1~2週前後', flc_rq: false },
  ],
  'exterior': [
    { id: 'signage', name_ja: '看板・照明修理', name_en: 'Signage/Lighting Repair', name_zh: '招牌照明維修', estimated_time: '1週間以内', flc_rq: false },
    { id: 'shutter', name_ja: 'シャッター修繕', name_en: 'Shutter Repair', name_zh: '捲閘維修', estimated_time: '1~2日以内', flc_rq: false },
    { id: 'grease-trap', name_ja: 'グリーストラップ関連', name_en: 'Grease Trap Related', name_zh: '隔油池相關', estimated_time: '1~2日以内', flc_rq: false },
    { id: 'banner', name_ja: '広告banner関連', name_en: 'Advertising Banner', name_zh: '廣告橫幅相關', estimated_time: '1週間以内', flc_rq: false },
  ],
  'kitchen': [
    { id: 'hoshizaki', name_ja: 'ホシザキ冷凍冷蔵庫、食器洗浄機修理', name_en: 'Hoshizaki Fridge/Dishwasher', name_zh: 'Hoshizaki冰箱洗碗機維修', estimated_time: '1週間以内', flc_rq: false },
    { id: 'noodle-boiler', name_ja: '茹で麺機修理', name_en: 'Noodle Boiler Repair', name_zh: '煮麵機維修', estimated_time: '1週間以内', flc_rq: false },
    { id: 'hobart', name_ja: 'Hobart食器洗浄機修理', name_en: 'Hobart Dishwasher Repair', name_zh: 'Hobart洗碗機維修', estimated_time: '1週間以内', flc_rq: false },
    { id: 'freezer-stocker', name_ja: '冷凍ストッカー修理', name_en: 'Freezer Stocker Repair', name_zh: '冷凍庫維修', estimated_time: '1週間以内', flc_rq: false },
    { id: 'microwave', name_ja: '電子レンジ修理', name_en: 'Microwave Repair', name_zh: '微波爐維修', estimated_time: '1週間以内', flc_rq: false },
    { id: 'water-heater', name_ja: '給湯器修理', name_en: 'Water Heater Repair', name_zh: '熱水器維修', estimated_time: '1週間以内', flc_rq: false },
    { id: 'ih-stove', name_ja: 'IHコンロ交換', name_en: 'IH Stove Replacement', name_zh: 'IH爐具更換', estimated_time: '1週間以内', flc_rq: false },
    { id: 'heater', name_ja: 'ヒーター修理', name_en: 'Heater Repair', name_zh: '加熱器維修', estimated_time: '1~2週前後', flc_rq: false },
    { id: 'welding', name_ja: '溶接手配', name_en: 'Welding Arrangement', name_zh: '焊接安排', estimated_time: '1~2週前後', flc_rq: false },
    { id: 'faucet', name_ja: '水栓修繕', name_en: 'Faucet Repair', name_zh: '水龍頭維修', estimated_time: '1週間以内', flc_rq: false },
    { id: 'fryer', name_ja: 'フライヤー修理', name_en: 'Fryer Repair', name_zh: '油炸機維修', estimated_time: '1週間以内', flc_rq: false },
    { id: 'warmer', name_ja: 'ウォーマー修理', name_en: 'Warmer Repair', name_zh: '保溫器維修', estimated_time: '1週間以内', flc_rq: false },
    { id: 'drain-pipe', name_ja: '排水管修繕', name_en: 'Drain Pipe Repair', name_zh: '排水管維修', estimated_time: '1~2日以内', flc_rq: false },
    { id: 'kitchen-floor', name_ja: '床タイル修繕', name_en: 'Floor Tile Repair', name_zh: '地板磁磚維修', estimated_time: '1週間以内', flc_rq: true },
    { id: 'outlet-cover', name_ja: 'コンセントカバー修理', name_en: 'Outlet Cover Repair', name_zh: '插座蓋維修', estimated_time: '1週間以内', flc_rq: true },
    { id: 'salamander', name_ja: 'サラマンダー修理', name_en: 'Salamander Repair', name_zh: '明火烤爐維修', estimated_time: '1週間以内', flc_rq: false },
    { id: 'work-table', name_ja: '作業台修理', name_en: 'Work Table Repair', name_zh: '工作檯維修', estimated_time: '1週間以内', flc_rq: true },
  ],
  'pantry': [
    { id: 'ice-maker', name_ja: '製氷機修理', name_en: 'Ice Maker Repair', name_zh: '製冰機維修', estimated_time: '1週間以内', flc_rq: false },
  ],
  'toilet': [
    { id: 'toilet-bowl', name_ja: '便器修繕', name_en: 'Toilet Bowl Repair', name_zh: '馬桶維修', estimated_time: '1週間以内', flc_rq: true },
    { id: 'paper-holder', name_ja: 'ペーパーホルダー修繕', name_en: 'Paper Holder Repair', name_zh: '紙巾架維修', estimated_time: '1~2週前後', flc_rq: true },
  ],
  'staff-room': [
    { id: 'locker-door', name_ja: '更衣室扉修繕', name_en: 'Locker Room Door Repair', name_zh: '更衣室門維修', estimated_time: '1~2週前後', flc_rq: true },
  ],
}

// 緊急度
export const URGENCY_LEVELS = [
  { id: 'urgent', name_ja: '急ぎ', name_en: 'Urgent', name_zh: '緊急', color: '#EF4444' },
  { id: 'normal', name_ja: '普通', name_en: 'Normal', name_zh: '普通', color: '#F59E0B' },
  { id: 'estimate', name_ja: '見積もり', name_en: 'Estimate', name_zh: '報價', color: '#3B82F6' },
]

// デフォルト業者メールアドレス
export const DEFAULT_VENDORS = [
  { id: '1', name: 'Fujimak Service Desk', email: 'service@fujimak.example', phone: '', is_active: true },
  { id: '2', name: 'Fujimak Operations', email: 'ops@fujimak.example', phone: '', is_active: true },
]

// Store data for Fujimak customer selector (sourced from Angel's Pizza locations page)
export const STORES = ANGEL_PIZZA_STORES
