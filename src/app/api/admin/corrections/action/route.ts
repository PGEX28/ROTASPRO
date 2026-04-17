import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/supabase-server'

export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const { id, is_active } = await req.json()
    
    if (!id || typeof is_active !== 'boolean') {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabaseAdmin
      .from('address_corrections')
      .update({ is_active })
      .eq('id', id)

    if (error) {
       console.error('Erro atualizar is_active', error)
       return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch(e: any) {
    console.error('Erro /admin/corrections/action', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
