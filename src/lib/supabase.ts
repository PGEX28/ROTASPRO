import { createBrowserClient } from '@supabase/ssr'

export interface ProcessingRecord {
  id: string
  created_at: string
  file_name: string
  file_path: string | null
  credits_used: number
  packages_processed: number
  manual_additions_count?: number
  user_id: string
}

export interface Purchase {
  id: string
  created_at: string
  plan_name: string
  amount_paid: number | string
  credits_added: number
  status: string
  user_id: string
}

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  )
