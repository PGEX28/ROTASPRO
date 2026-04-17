import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/supabase-server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    const { id, action } = await req.json()

    if (!id || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ error: 'Ação inválida!' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    const { data: suggestion, error: fetchErr } = await supabase
      .from('address_suggestions')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !suggestion) {
      return NextResponse.json({ error: 'Sugestão não encontrada' }, { status: 404 })
    }

    // Marca como resolvido (usando Service Role, bypass RLS no admin)
    await supabase.from('address_suggestions').update({ 
      status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      updated_at: new Date().toISOString()
    }).eq('id', id);

    // Se aprovou, joga pra tabela de correções oficias
    if (action === 'APPROVE') {
      await supabase.from('address_corrections').upsert({
        normalized_address: suggestion.normalized_address,
        corrected_lat: suggestion.last_google_lat,
        corrected_lng: suggestion.last_google_lng,
        confidence: Math.round(suggestion.confidence_score),
        source: 'SUGGESTION_APPROVAL',
        usage_count: 0
      }, { onConflict: 'normalized_address' });
    }

    return NextResponse.json({ success: true, newStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' })
  } catch (err: any) {
    console.error('Admin Suggestion Action Error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
