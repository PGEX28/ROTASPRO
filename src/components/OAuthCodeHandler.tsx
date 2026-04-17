'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'

export default function OAuthCodeHandler() {
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const supabase = createClient()

    // O createBrowserClient com detectSessionInUrl: true (default)
    // automaticamente detecta ?code= na URL e faz o exchangeCodeForSession
    supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === 'SIGNED_IN' && session) {
        window.location.href = '/dashboard'
      }
    })

    // Fallback: se a auto-detecção falhar, tenta manualmente
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }: any) => {
        if (error) {
          console.error('[OAuth] Erro ao trocar código:', error.message)
          window.location.href = '/login?error=auth_failed'
        }
        // Se sucesso, onAuthStateChange vai disparar SIGNED_IN acima
      })
    }

    // Timeout de segurança
    setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }: any) => {
        if (session) {
          window.location.href = '/dashboard'
        } else {
          window.location.href = '/login?error=auth_timeout'
        }
      })
    }, 8000)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-full border-4 border-[rgba(240,58,23,0.2)] border-t-[var(--orange)] animate-spin" />
      <p className="text-[var(--text-muted)] text-sm">Autenticando com Google…</p>
    </div>
  )
}
