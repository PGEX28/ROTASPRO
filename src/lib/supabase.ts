import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export type Profile = {
  id: string
  full_name: string | null
  credits: number
  is_admin?: boolean
  created_at: string
}

export type Purchase = {
  id: string
  user_id: string
  plan_name: string
  amount_paid: number
  credits_added: number
  status: string
  created_at: string
}

export type ProcessingRecord = {
  id: string
  user_id: string
  file_name: string
  packages_processed: number
  stops_count: number
  manual_additions_count: number
  credits_used: number
  file_path: string | null
  created_at: string
}
