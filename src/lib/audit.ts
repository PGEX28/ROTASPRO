import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function logSecurityEvent(params: {
  event_type: string
  user_id?: string
  actor_id?: string
  metadata?: any
  severity?: 'info' | 'warning' | 'critical'
}) {
  try {
    await supabase.from('security_audit_logs').insert([
      {
        ...params,
        created_at: new Date().toISOString()
      }
    ])
  } catch (err) {
    console.error('Failed to log security event:', err)
  }
}
