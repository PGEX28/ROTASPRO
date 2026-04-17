import { NextResponse, type NextRequest } from 'next/server'

// Bot/Scanner User-Agents to block
const BLOCKED_AGENTS = [
  'sqlmap', 'nikto', 'dirbuster', 'nmap', 'go-http-client', 
  'python-requests', 'curl/', 'wget', 'postman'
]

export function proxy(request: NextRequest) {
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || ''
  const path = request.nextUrl.pathname
  
  // 1. Bot Blocking
  if (BLOCKED_AGENTS.some(agent => userAgent.includes(agent))) {
    return new NextResponse('Bloqueado por Política de Segurança', { status: 403 })
  }

  // 2. Proteção contra Path Traversal e Injeção básica na URL
  if (path.includes('../') || path.includes('(') || path.includes(';')) {
    return new NextResponse('Requisição Malformada Suspeita', { status: 400 })
  }

  const response = NextResponse.next()

  // 3. Security Headers (Anti-Hacker Layer)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  
  return response
}

export const config = {
  // Aplicar a tudo, exceto assets estáticos
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
