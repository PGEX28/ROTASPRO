import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import QualityDashboard from './QualityDashboard'

export default async function AdminQualityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Verificar se o usuário LOGADO tem is_admin = true no banco de dados
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/dashboard')
  }

  return <QualityDashboard />
}
