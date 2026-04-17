import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
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

  // Otimização 4G: Usar getSession() que é mais leve e depende menos do servidor
  const { data: { session } } = await supabase.auth.getSession()

  // Se o usuário tentar acessar uma rota protegida sem sessão
  if (!session) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Otimização 4G: Matcher restrito apenas às rotas que exigem login
  matcher: [
    '/dashboard/:path*', 
    '/history/:path*', 
    '/pricing/:path*',
    '/checkout/:path*',
    '/admin/:path*'
  ],
}
