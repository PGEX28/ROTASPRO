import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@/lib/supabase-server'
import { PLANS } from '@/lib/plans'

// Configuração de token injetada dinamicamente para evitar cash sujo do Next.js

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    
    // Recupera a sessão do usuário
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado. Faça o login.' }, { status: 401 })
    }

    const { id: planId } = await req.json()

    if (!planId) {
      return NextResponse.json({ error: 'ID do plano não informado.' }, { status: 400 })
    }

    const plan = PLANS.find(p => p.id === planId)

    if (!plan) {
      return NextResponse.json({ error: 'Plano inválido ou não encontrado.' }, { status: 400 })
    }

    // Criar purchase "pending" no banco de dados para atrelar a referência externa do Mercado Pago
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        user_id: user.id,
        plan_name: plan.name,
        amount_paid: plan.price,
        credits_added: plan.credits,
        status: 'pending' // Ainda não pago
      })
      .select('id')
      .single()

    if (purchaseError || !purchase) {
      console.error('Erro ao criar registro de compra:', purchaseError)
      return NextResponse.json({ error: 'Erro ao preparar a compra no banco de dados.' }, { status: 500 })
    }

    let token = (process.env.MP_ACCESS_TOKEN || '').trim()
    // Remove aspas acidentais inseridas no painel da Vercel
    token = token.replace(/['"]+/g, '')

    if (!token) {
      console.error('⛔ ERRO: MP_ACCESS_TOKEN vazia no backend.')
      return NextResponse.json({ error: 'Falta configuração do sistema.' }, { status: 500 })
    }

    // Gerar pagamento PIX no Mercado Pago
    const client = new MercadoPagoConfig({ accessToken: token })
    const payment = new Payment(client)

    // A URL oficial do sistema engessada no código para bloquear qualquer erro de digitação do painel
    const notificationDomain = 'https://corretor-de-rotas-pro.vercel.app'

    const mpPayment = await payment.create({
      body: {
        transaction_amount: plan.price,
        description: `Plano ${plan.name} - ${plan.credits} créditos`,
        payment_method_id: 'pix',
        payer: {
          email: user.email || 'comprador@corretorderotas.com.br',
          first_name: user?.user_metadata?.full_name?.split(' ')[0] || 'Cliente',
          identification: {
            type: 'CPF',
            number: '12345678909' // CPF de teste padrão caso não haja um real
          }
        },
        external_reference: purchase.id,
        notification_url: `${notificationDomain}/api/webhook/mercadopago`
      }
    })

    const pointOfInteraction = mpPayment.point_of_interaction || {}
    const transactionData = pointOfInteraction.transaction_data || {}

    return NextResponse.json({
      success: true,
      orderId: purchase.id,
      paymentId: mpPayment.id,
      status: mpPayment.status,
      qrCode: transactionData.qr_code || null,
      qrCodeBase64: transactionData.qr_code_base64 || null,
      ticketUrl: transactionData.ticket_url || null,
      amount: plan.price,
      credits: plan.credits
    })
  } catch (err: any) {
    console.error('ERRO ao gerar PIX:', err)
    return NextResponse.json({ error: err.message || 'Erro interno no servidor' }, { status: 500 })
  }
}
