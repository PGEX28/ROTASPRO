import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { shouldAutoDisable } from '@/lib/auto-learning'

export async function POST(req: Request) {
  try {
    const { metrics } = await req.json()
    // Aceitar metrics antigo ou array the ids pra backward comp
    if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
      return NextResponse.json({ ok: false, error: 'Lista inválida' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    for (const m of metrics) {
       const hitId = typeof m === 'string' ? m : m.id;
       const risk = typeof m === 'object' ? m.risk : 'OK';

       const { data: curr } = await supabaseAdmin
         .from('address_corrections')
         .select('usage_count, suspect_count, invalid_count, is_active, success_count, fail_count, blacklisted, last_auto_action')
         .eq('id', hitId)
         .single()
       
       if (!curr) continue;
       
       const usageCount = (curr.usage_count || 0) + 1;
       const suspectCount = (curr.suspect_count || 0) + (risk === 'SUSPECT' ? 1 : 0);
       const invalidCount = (curr.invalid_count || 0) + (risk === 'INVALID' ? 1 : 0);
       
       // Success / Fail rule
       const successCount = (curr.success_count || 0) + (risk === 'OK' ? 1 : 0);
       const failCount = (curr.fail_count || 0) + (risk !== 'OK' ? 1 : 0);

       // Reconstruir prop baseada na nova matriz (reutiliza o dict object no argumento simulado)
       const correctionObj = {
         ...curr,
         fail_count: failCount,
         suspect_count: suspectCount, 
         invalid_count: invalidCount
       };

       const willAutoDisable = shouldAutoDisable(correctionObj);
       
       // Se já está blacklisted ou false, apenas logamos as métricas
       if (!curr.is_active || curr.blacklisted) {
          await supabaseAdmin.from('address_corrections').update({
            usage_count: usageCount,
            suspect_count: suspectCount,
            invalid_count: invalidCount,
            success_count: successCount,
            fail_count: failCount,
            last_used_at: new Date().toISOString()
          }).eq('id', hitId)
          continue;
       }

       if (willAutoDisable) {
          // Se já sofreu uma ação the disable anteriormente na vida (ou já tá marcado manual),
          // vai pro Blacklist definitivo para nunca re-retomar no auto approve.
          const becomingBlacklisted = curr.last_auto_action === 'AUTO_DISABLED';
          
          await supabaseAdmin.from('address_corrections').update({
            usage_count: usageCount,
            suspect_count: suspectCount,
            invalid_count: invalidCount,
            success_count: successCount,
            fail_count: failCount,
            last_used_at: new Date().toISOString(),
            is_active: false,
            auto_disabled: true,
            auto_disabled_at: new Date().toISOString(),
            auto_disabled_reason: 'LOW_CONFIDENCE_RUNTIME',
            blacklisted: becomingBlacklisted,
            last_auto_action: becomingBlacklisted ? 'BLACKLISTED' : 'AUTO_DISABLED'
          }).eq('id', hitId)
       } else {
          // Atualiza apenas as métricas adaptativas
          await supabaseAdmin.from('address_corrections').update({
            usage_count: usageCount,
            suspect_count: suspectCount,
            invalid_count: invalidCount,
            success_count: successCount,
            fail_count: failCount,
            last_used_at: new Date().toISOString()
          }).eq('id', hitId)
       }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Erro geral /corrections/usage', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
