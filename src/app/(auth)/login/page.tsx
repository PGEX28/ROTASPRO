'use client'
export const dynamic = "force-dynamic";


import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const authListenerSet = useRef(false)

  // Escuta mudanças de autenticação (detecta retorno do Google OAuth automaticamente)
  useEffect(() => {
    if (authListenerSet.current) return
    authListenerSet.current = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Redireciona apenas em login explícito. 
      // O carregamento inicial (INITIAL_SESSION) é melhor deixar para o Middleware no servidor.
      if (event === 'SIGNED_IN' && session) {
        window.location.href = '/dashboard'
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-mail ou senha incorretos. Tente novamente.')
    } else {
      window.location.href = '/dashboard'
    }
    setLoading(false)
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    const origin = window.location.origin
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/api/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-[0_0_28px_var(--orange-glow)] mb-4">
            <Image src="/logo-app.png" alt="RotasPro" width={56} height={56} className="object-cover w-full h-full" />
          </div>
          <h1 className="font-syne font-extrabold text-2xl text-[var(--text)] tracking-tight">
            Rotas<span className="text-[var(--orange)]">Pro</span>
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Sua plataforma de rotas inteligentes</p>
        </div>

        {/* Card */}
        <div className="card-base p-8 md:p-10">
          <div className="text-center mb-8">
            <h2 className="font-syne font-bold text-2xl text-[var(--text)] tracking-tight">Bem-vindo(a) de volta</h2>
            <p className="text-[var(--text-muted)] text-sm mt-2">Acesse sua conta para continuar</p>
          </div>

          {/* Google OAuth Provider */}
          <div className="w-full flex justify-center mb-8">
            <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
              <div className="w-full relative min-h-[44px]">
                {googleLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--surface2)]/80 rounded-xl">
                    <span className="w-5 h-5 rounded-full border-2 border-[var(--orange)] border-t-[var(--orange-glow)] animate-spin" />
                  </div>
                )}
                <div className="w-[320px] mx-auto flex justify-center items-center google-login-wrapper">
                  <GoogleLogin
                    onSuccess={async (credentialResponse) => {
                      setGoogleLoading(true)
                      if (credentialResponse.credential) {
                        const { error } = await supabase.auth.signInWithIdToken({
                          provider: 'google',
                          token: credentialResponse.credential,
                        })
                        if (error) {
                          setError('Erro ao autenticar com o Google.')
                          setGoogleLoading(false)
                        } else {
                          window.location.href = '/dashboard'
                        }
                      }
                    }}
                    onError={() => {
                      setError('Falha na autenticação via Google.')
                    }}
                    theme="outline"
                    size="large"
                    text="continue_with"
                    shape="rectangular"
                    width="320"
                  />
                </div>
              </div>
            </GoogleOAuthProvider>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
            <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest">ou E-mail</span>
            <div className="flex-1 h-px bg-[var(--border-subtle)]" />
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2.5 block">E-mail</label>
              <input
                type="email"
                className="input-base"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2.5 block">Senha</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-base pr-12"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex justify-end mt-2">
                <Link href="/forgot-password" className="text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--orange)] transition-colors">
                  Esqueceu sua senha?
                </Link>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary mt-2" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Entrando…
                </span>
              ) : (
                <>Entrar <ArrowRight size={16} /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[var(--text-muted)] mt-5">
          Não tem conta?{' '}
          <Link href="/signup" className="text-[var(--orange)] font-semibold hover:text-[var(--orange-light)] transition-colors">
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  )
}
