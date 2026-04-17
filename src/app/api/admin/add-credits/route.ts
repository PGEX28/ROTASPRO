import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
const addCreditsSchema = z.object({
  email: z.string().email('E-mail inválido'),
  credits: z.number().int().positive('A quantidade deve ser um número inteiro positivo'),
}).strict() // Bloqueia campos extras não mapeados

// Lazy-init admin client to avoid build-time crash
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  try {
    const isUserAdmin = await isAdmin()
    const secret = request.headers.get('X-Admin-Secret')
    const adminSecret = process.env.ADMIN_SECRET

    // Permite se for Admin via sessão OU se tiver a chave secreta correta
    const isAuthorized = isUserAdmin || (adminSecret && secret === adminSecret)

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Não autorizado. Acesso restrito a administradores.' }, { status: 401 })
    }

    const json = await request.json()
    
    // 1. Validação de esquema (Anti-Payload Manipulation)
    const result = addCreditsSchema.safeParse(json)
    if (!result.success) {
      return NextResponse.json({ 
        error: 'Payload inválido', 
        details: result.error.format() 
      }, { status: 400 })
    }

    const { email, credits } = result.data

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
