import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase-server'
import { PLANS } from '@/lib/plans'

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
    const supabase = await createClient()
    
    // Recupera a sessão do usuário que está chamando a rota
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado. Faça o login.' }, { status: 401 })
    }

    // ATENÇÃO: Pegamos apenas o ID do plano informado pelo usuário
    const { id: planId } = await req.json()

    if (!planId) {
      return NextResponse.json({ error: 'ID do plano não informado.' }, { status: 400 })
    }

    // SEGURANÇA: Buscamos as informações REAIS do plano direto do back-end
    const plan = PLANS.find(p => p.id === planId)

    if (!plan) {
      return NextResponse.json({ error: 'Plano inválido ou não encontrado.' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // Define os itens da checkout session baseando-se EXCLUSIVAMENTE nos dados no servidor (plan)
    const lineItem = plan.stripePriceId 
      ? { price: plan.stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `Plano ${plan.name}`,
              description: `${plan.credits} créditos para processamento de rotas.`,
            },
            unit_amount: plan.price * 100, // Multiplica pelo servidor
          },
          quantity: 1,
        }

    // Parâmetros base da sessão usando os metadados oficias do plano (infalsificável)
    const sessionParams: any = {
      ui_mode: 'embedded',
      mode: 'payment',
      customer_email: user.email,
      line_items: [lineItem],
      metadata: {
        user_id: user.id,
        plan_id: plan.id,
        plan_name: plan.name,
        credits_added: plan.credits.toString(),
      },
      return_url: `${origin}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
    }

    // Criação da sessão (A Stripe agora gerencia pagamentos habilitados via Dashboard)
    const session = await getStripe().checkout.sessions.create(sessionParams)

    // Em modo embedded retornamos clientSecret em vez de url
    return NextResponse.json({ clientSecret: session.client_secret })
  } catch (err: any) {
    console.error('ERRO FATAL no checkout:', {
      message: err.message,
      type: err.type,
      code: err.code
    })
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
