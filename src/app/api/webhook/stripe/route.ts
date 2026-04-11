import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

let _stripe: Stripe | null = null
function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe((process.env.STRIPE_SECRET_KEY || '').trim(), {
      apiVersion: '2025-02-24.acacia',
    })
  }
  return _stripe
}

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    const body = await req.text()
    console.log('📡 Webhook: Corpo da requisição lido (%d bytes)', body.length);
    
    let event: Stripe.Event
    try {
      event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET || '')
      console.log('🔔 Webhook: Evento verificado com sucesso:', event.type);
    } catch (err: any) {
      console.error(`❌ Webhook: Falha na verificação da assinatura:`, err.message);
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      
      console.log('📦 Webhook: Processando Checkout Session:', session.id);
      console.log('👤 Webhook: Metadados:', session.metadata);

      const userId = session.metadata?.user_id
      const creditsAdded = Number(session.metadata?.credits_added)
      const planName = session.metadata?.plan_name
      const amountPaid = session.amount_total ? session.amount_total / 100 : 0

      if (userId && creditsAdded) {
        // Insere o histórico de compra
        await supabaseAdmin.from('purchases').insert({
          user_id: userId,
          plan_name: planName || 'Unknown',
          amount_paid: amountPaid,
          credits_added: creditsAdded,
          status: 'paid'
        })
        
        // Carga de Créditos Realizada no DB
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('credits')
          .eq('id', userId)
          .single()
          
        const currentCredits = profile?.credits || 0
        const newCredits = currentCredits + creditsAdded
        
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ credits: newCredits })
          .eq('id', userId)

        if (error) {
           console.error('❌ Webhook: Erro ao atualizar créditos no Supabase:', error);
           console.log('💡 DICA: Verifique se a SUPABASE_SERVICE_ROLE_KEY está correta.');
        } else {
           console.log(`✅ Webhook: SUCESSO! ${creditsAdded} créditos entregues ao usuário ${userId}.`);
        }
      } else {
        console.warn('⚠️ Webhook: userId ou creditsAdded ausentes nos metadados da sessão.');
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('Unhandled webhook error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
