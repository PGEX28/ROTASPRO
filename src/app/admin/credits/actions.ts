'use server'

import { createClient } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'

export async function fetchAllUsersAction() {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (!currentUser) throw new Error('Não autenticado')

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', currentUser.id)
      .single()

    if (!profile?.is_admin) throw new Error('Acesso negado')

    const adminSupabase = getSupabaseAdmin()
    const { data: users, error } = await adminSupabase
      .from('profiles')
      .select('email, full_name, credits')
      .order('email', { ascending: true })

    if (error) throw error

    return { success: true, users: users || [] }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function addCreditsManualAction(targetEmail: string, amount: number) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (!currentUser) {
      throw new Error('Não autenticado')
    }

    if (amount <= 0) {
      throw new Error('A quantidade de créditos deve ser maior que zero.')
    }

    // 1. Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', currentUser.id)
      .single()

    if (!profile?.is_admin) {
      throw new Error('Permissão negada. Apenas administradores podem adicionar créditos.')
    }

    // 2. Buscar usuário alvo
    const adminSupabase = getSupabaseAdmin()
    const { data: targetProfile, error: targetError } = await adminSupabase
      .from('profiles')
      .select('id, credits')
      .eq('email', targetEmail)
      .single()

    if (targetError || !targetProfile) {
      throw new Error('Usuário alvo não encontrado.')
    }

    // 3. Atualizar créditos
    const newBalance = (targetProfile.credits || 0) + amount
    const { error: updateError } = await adminSupabase
      .from('profiles')
      .update({ credits: newBalance })
      .eq('id', targetProfile.id)

    if (updateError) {
      throw new Error('Falha ao atualizar créditos no banco.')
    }

    // 4. Registrar log administrativo
    await adminSupabase
      .from('admin_logs')
      .insert({
        admin_id: currentUser.id,
        target_user_id: targetProfile.id,
        action_type: 'manual_credit_add',
        amount: amount,
        metadata: {
          target_email: targetEmail,
          previous_credits: targetProfile.credits,
          new_credits: newBalance
        }
      })

    revalidatePath('/admin/credits')
    return { success: true, message: `${amount} créditos adicionados ao usuário ${targetEmail}` }

  } catch (error: any) {
    console.error('Admin Credit Action Error:', error)
    return { success: false, error: error.message }
  }
}

export async function resetCreditsAction(targetEmail: string) {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (!currentUser) throw new Error('Não autenticado')

    // 1. Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', currentUser.id)
      .single()

    if (!profile?.is_admin) throw new Error('Acesso negado')

    // 2. Buscar usuário alvo
    const adminSupabase = getSupabaseAdmin()
    const { data: targetProfile, error: targetError } = await adminSupabase
      .from('profiles')
      .select('id, credits')
      .eq('email', targetEmail)
      .single()

    if (targetError || !targetProfile) throw new Error('Usuário não encontrado')

    // 3. Zerar créditos
    const { error: updateError } = await adminSupabase
      .from('profiles')
      .update({ credits: 0 })
      .eq('id', targetProfile.id)

    if (updateError) throw new Error('Falha ao zerar créditos')

    // 4. Registrar log
    await adminSupabase
      .from('admin_logs')
      .insert({
        admin_id: currentUser.id,
        target_user_id: targetProfile.id,
        action_type: 'manual_credit_reset',
        amount: 0,
        metadata: {
          target_email: targetEmail,
          previous_credits: targetProfile.credits,
          new_credits: 0
        }
      })

    revalidatePath('/admin/credits')
    return { success: true, message: `Créditos do usuário ${targetEmail} foram zerados.` }
  } catch (error: any) {
    console.error('Admin Reset Action Error:', error)
    return { success: false, error: error.message }
  }
}
