import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AdminCreditsContent from './AdminCreditsContent'

export default async function AdminCreditsPage() {
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
    // Redireciona usuários não-admin para o dashboard comum para segurança
    redirect('/dashboard')
  }

  return <AdminCreditsContent />
}
