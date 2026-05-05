import { createClient } from '@supabase/supabase-js'

const env = (value: string | undefined) => (typeof value === 'string' ? value.trim() : '')

const supabaseUrl = env(process.env.NEXT_PUBLIC_FUJIMAK_SUPABASE_URL) || env(process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabaseAnonKey =
  env(process.env.NEXT_PUBLIC_FUJIMAK_SUPABASE_ANON_KEY) || env(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'supabaseUrl is required. Set NEXT_PUBLIC_FUJIMAK_SUPABASE_URL / NEXT_PUBLIC_FUJIMAK_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Store {
  id: string
  name: string
  name_en: string
  name_zh: string
  region: string
  address: string
  phone: string
}

export interface MaintenanceCategory {
  id: string
  name_ja: string
  name_en: string
  name_zh: string
  sort_order: number
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

export interface MaintenanceRequest {
  id: string
  store_id: string
  item_id: string
  urgency: 'urgent' | 'normal' | 'estimate'
  remarks: string
  preferred_date: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  created_at: string
  images?: RequestImage[]
  store?: Store
  item?: MaintenanceItem
}

export interface RequestImage {
  id: string
  request_id: string
  image_url: string
}

export interface Vendor {
  id: string
  name: string
  email: string
  phone: string
  is_active: boolean
}

export interface StoreAdmin {
  id: string
  store_id: string
  email: string
  name: string
  role: 'admin' | 'manager'
}
