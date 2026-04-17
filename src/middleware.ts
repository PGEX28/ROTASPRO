import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Mantemos o cliente apenas para garantir a sincronização de cookies
  // mas removemos qualquer verificação de getUser() ou redirecionamento aqui.
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

  // O controle de autenticação agora é feito 100% no frontend das páginas.
  // Isso evita o loop de redirecionamento em redes 4G instáveis.
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo-app.png|icon-192x192.png|icon-512x512.png|manifest.json|sw.js).*)',
  ],
}
