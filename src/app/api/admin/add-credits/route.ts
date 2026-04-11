import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Lazy-init admin client to avoid build-time crash
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, credits } = body
    
    // O segredo agora é enviado via Header de segurança para não aparecer em logs de URL
    const secret = request.headers.get('X-Admin-Secret')
    const adminSecret = process.env.ADMIN_SECRET
    
    // 1. Validação de segurança robusta
    if (!adminSecret || secret !== adminSecret) {
      return NextResponse.json({ error: 'Não autorizado. Chave administrativa inválida ou não configurada corretamente nos headers.' }, { status: 401 })
    }

    if (!email || credits === undefined) {
      return NextResponse.json({ error: 'Falta email ou credits no corpo da requisição.' }, { status: 400 })
    }

    const creditsToAdd = parseInt(String(credits), 10)
    if (isNaN(creditsToAdd) || creditsToAdd <= 0) {
      return NextResponse.json({ error: 'Quantidade de créditos inválida.' }, { status: 400 })
    }

    // 2. Busca o usuário pelo e-mail
    const { data: profile, error: searchError } = await getAdmin()
      .from('profiles')
      .select('id, email, credits')
      .eq('email', email)
      .single()

    if (searchError || !profile) {
      return NextResponse.json({ error: `Usuário ${email} não encontrado no banco de dados.` }, { status: 404 })
    }

    // 3. Adiciona os créditos ao saldo atual do usuário
    const newBalance = (profile.credits || 0) + creditsToAdd

    const { error: updateError } = await getAdmin()
      .from('profiles')
      .update({ credits: newBalance })
      .eq('id', profile.id)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao salvar créditos no banco.', details: updateError }, { status: 500 })
    }

    // 4. Retorna sucesso!
    return NextResponse.json({
      success: true,
      message: `${creditsToAdd} créditos adicionados com sucesso ao usuário ${email}!`,
      saldo_anterior: profile.credits,
      saldo_novo: newBalance
    })

  } catch (error: any) {
    return NextResponse.json({ error: 'Erro interno no servidor ou corpo da requisição malformado', details: error.message }, { status: 500 })
  }
}
