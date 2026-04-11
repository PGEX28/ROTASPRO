import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rotas estritamente públicas
  const publicRoutes = ['/login', '/signup', '/auth/callback', '/api/webhook/stripe', '/api/webhook/mercadopago', '/api/auth/callback', '/manifest.json', '/logo-app.png']
  
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // Criamos uma resposta inicial
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Configuração do Supabase SSR com gerenciamento de cookies otimizado
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Obtém o usuário (importante usar getUser() em vez de getSession() para segurança)
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Se NÃO está logado e tenta acessar rota privada -> Redireciona para /login
  if (!user && !isPublicRoute && pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Se JÁ está logado e tenta acessar Login/Signup ou o Início (/) -> Dashboard
  // Isso evita o loop e garante que o usuário logado vá direto para o app
  if (user && (pathname === '/login' || pathname === '/signup' || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  
  // 3. Caso especial para a Home (/) sem estar logado
  if (!user && pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Ignora arquivos estáticos e internos do Next.js
    '/((?!_next/static|_next/image|favicon.ico|logo-app.png|icon-192x192.png|icon-512x512.png|manifest.json|sw.js).*)',
  ],
}
