import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * BOT BLOCKING & PATH TRAVERSAL FILTER
 * Lista conservadora para não afetar navegadores móveis legítimos
 */
const BLOCKED_AGENTS = [
  'sqlmap', 'nikto', 'dirbuster', 'nmap', 'go-http-client', 
  'python-requests', 'curl/', 'wget', 'postman'
]

/**
 * CORE PROXY HANDLER (Substitui o middleware.ts tradicional nesta versão do Next.js)
 * Unifica: Segurança Antibot + Headers de Segurança + Refresh de Sessão Supabase
 */
export default async function proxy(request: NextRequest) {
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || ''
  const path = request.nextUrl.pathname
  
  // REDIRECIONAMENTO DE ROTAS OBSOLETAS (STRIPE)
  if (path.startsWith('/checkout/')) {
    return NextResponse.redirect(new URL('/pricing', request.url))
  }
  
  // 1. FIREWALL ANTIBOT
  if (BLOCKED_AGENTS.some(agent => userAgent.includes(agent))) {
    return new NextResponse('Bloqueado por Política de Segurança', { status: 403 })
  }

  // 2. PROTEÇÃO CONTRA PATH TRAVERSAL
  if (path.includes('../') || path.includes('..\\')) {
    return new NextResponse('Requisição Malformada Suspeita', { status: 400 })
  }

  // RESPOSTA BASE
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 3. PERSISTÊNCIA DE CONEXÃO (SUPABASE AUTH REFRESH)
  // Essencial para o mobile não perder o login/créditos
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Dispara a renovação do token se necessário
  await supabase.auth.getUser()

  // 4. SECURITY HEADERS (ANTI-HACKER)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  
  return response
}

/**
 * CONFIGURAÇÃO DE ROTEAMENTO DO PROXY
 */
export const config = {
  matcher: [
    /*
     * Aplica segurança e auth em todas as rotas exceto assets estáticos e favicon
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
