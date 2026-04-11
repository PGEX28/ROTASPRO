import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rotas estritamente públicas
  const publicRoutes = ['/login', '/signup', '/auth/callback', '/api/webhook/stripe', '/api/webhook/mercadopago', '/api/auth/callback']
  
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Analisamos se o usuário está logado e onde ele está tentando ir
  const { data: { user } } = await supabase.auth.getUser()
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // 1. Se NÃO está logado e tenta acessar rota privada -> Login
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Se JÁ está logado e tenta acessar Login/Signup ou o Início (/) -> Dashboard
  // Isso evita o loop infinito se o cliente tentar "adivinhar" o login
  if (user && (pathname === '/login' || pathname === '/signup' || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo-app.png|icon-192x192.png|icon-512x512.png|manifest.json|sw.js).*)',
  ],
}
