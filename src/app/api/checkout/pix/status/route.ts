import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json({ error: 'orderId não fornecido' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: purchase, error } = await supabase
      .from('purchases')
      .select('status')
      .eq('id', orderId)
      .eq('user_id', user.id) // garante pertencer ao usuário
      .single()

    if (error || !purchase) {
      return NextResponse.json({ error: 'Compra não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ status: purchase.status })

  } catch (err: any) {
    console.error('Erro ao verificar status da purchase:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
