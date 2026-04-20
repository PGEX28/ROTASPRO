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
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Dispara a renovação do token se necessário
  const { data: { user } } = await supabase.auth.getUser()

  // DEBUG LOG (Monitoramento de redirecionamento)
  console.log(`[PROXY] Path: ${path} | User: ${user ? user.email : 'GUEST'}`)

  // 4. CONDITIONAL REDIRECTION (Guest vs Member Flow)
  const isPublicRoute = path === '/' || path === '/login' || path === '/signup'
  const isProtectedRoute = path.startsWith('/dashboard') || 
                           path.startsWith('/circuitapp') || 
                           path.startsWith('/history') ||
                           path.startsWith('/admin')

  // Redireciona membros logados no root/auth para o dashboard
  if (user && isPublicRoute) {
    const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url))
    // Transfere cookies renovados para o redirecionamento
    response.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // Protege rotas internas (redireciona para login se não autenticado)
  if (!user && isProtectedRoute) {
    const redirectResponse = NextResponse.redirect(new URL('/login', request.url))
    // Transfere cookies (limpeza ou renovação) para o redirecionamento
    response.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // 5. SECURITY HEADERS (ANTI-HACKER)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  
  return response
}

/**
 * CONFIGURAÇÃO DO MATCHER (Essencial para o Next.js)
 * Define as rotas onde este proxy deve atuar.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

