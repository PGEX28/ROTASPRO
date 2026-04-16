import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data, error } = await supabaseAdmin.from('system_settings').select('*').single()

    // defaults if missing
    if (error || !data) {
      return NextResponse.json({
         auto_learning_enabled: false,
         min_confidence: 85,
         min_occurrences: 5,
         max_avg_distance_km: 0.2
      })
    }

    let finalData = data;
    // Hook de migração C-Level: força o rigor the 0.2km e atualiza o backend no banco
    if (data && data.max_avg_distance_km === 0.5) {
      await supabaseAdmin.from('system_settings').update({ max_avg_distance_km: 0.2 }).eq('id', data.id || '00000000-0000-0000-0000-000000000001');
      finalData = { ...data, max_avg_distance_km: 0.2 };
    }

    return NextResponse.json(finalData)
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const changes = await req.json()
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // There's only one record configured via upsert SQL
    const { error } = await supabaseAdmin.from('system_settings').update(changes).eq('id', '00000000-0000-0000-0000-000000000001')
    if (error) {
       console.error('Falha update system settings', error)
       return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch(e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
