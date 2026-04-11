import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MP_ACCESS_TOKEN = (process.env.MP_ACCESS_TOKEN || '').trim()

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('📡 Webhook Mercado Pago: Recebido', JSON.stringify(body))

    const topic = body.type || body.topic
    const dataId = body?.data?.id || body?.id

    if (topic !== 'payment' || !dataId) {
      return NextResponse.json({ received: true })
    }

    if (!MP_ACCESS_TOKEN) {
      console.error('⛔ ERRO: MP_ACCESS_TOKEN não configurado.')
      return NextResponse.json({ error: 'Configuração MP ausente' }, { status: 500 })
    }

    const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN })
    const paymentClient = new Payment(client)

    let payment;
    try {
      // Consulta pagamento original no MP para confirmar status real
      payment = await paymentClient.get({ id: String(dataId) })
    } catch (apiErr: any) {
      console.warn(`⚠️ Erro ao consultar MP para ID ${dataId}. Geralmente do simulador de testes.`, apiErr.message)
      return NextResponse.json({ error: 'Payment not found in Mercado Pago' }, { status: 404 })
    }

    const externalReference = payment.external_reference
    const paymentStatus = payment.status

    if (!externalReference) {
      console.warn('⚠️ Pagamento aprovado sem external_reference')
      return NextResponse.json({ received: true })
    }

    console.log(`Verificando order_id: ${externalReference} com status real: ${paymentStatus}`)

    // Idempotência e processamento
    if (paymentStatus === 'approved') {
      // 1. Busca a order para garantir que existe e ainda não foi paga
      const { data: purchase, error: purchaseError } = await supabaseAdmin
        .from('purchases')
        .select('*')
        .eq('id', externalReference)
        .single()

      if (purchaseError || !purchase) {
        console.error('❌ Compra não encontrada no banco:', externalReference)
        return NextResponse.json({ received: true })
      }

      if (purchase.status === 'paid') {
        console.log(`Aviso: Pagamento ${externalReference} já estava processado.`)
        return NextResponse.json({ received: true })
      }

      // 2. Transação: Atualiza o status da compra e coloca os créditos no usuário
      const { error: updateError } = await supabaseAdmin
        .from('purchases')
        .update({ status: 'paid' })
        .eq('id', externalReference)

      if (updateError) {
        console.error('Erro ao atualizar status da compra:', updateError)
        return NextResponse.json({ error: 'Erro de DB update' }, { status: 500 })
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('credits')
        .eq('id', purchase.user_id)
        .single()

      const currentCredits = profile?.credits || 0
      const newCredits = currentCredits + purchase.credits_added

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ credits: newCredits })
        .eq('id', purchase.user_id)

      if (profileError) {
        console.error('❌ Erro gravíssimo ao entregar créditos!', profileError)
      } else {
        console.log(`✅ SUCESSO PIX! ${purchase.credits_added} créditos adicionados ao usuário ${purchase.user_id}`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('Erro geral no Webhook MP:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
