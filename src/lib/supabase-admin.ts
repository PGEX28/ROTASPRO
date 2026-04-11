import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const supabaseKey = serviceKey || anonKey

  _admin = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return _admin
}

// Backward-compatible export (lazy getter)
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseAdmin() as any)[prop]
  },
})
