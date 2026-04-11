'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = createClient()

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      setError('Por favor, informe seu e-mail.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/update-password`,
      })

      if (error) {
        throw error
      }

      setSuccess(true)
      setEmail('')
    } catch (err: any) {
      console.error('Reset error:', err)
      setError(err.message || 'Erro ao enviar o link de recuperação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-6 sm:p-8 animate-fade-in relative z-10 w-full">
      <div className="w-full max-w-[400px]">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="group flex items-center justify-center w-10 h-10 rounded-full bg-[var(--surface2)] hover:bg-[var(--surface3)] border border-[var(--border-subtle)] transition-all mb-8"
        >
          <ArrowLeft size={18} className="text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors" />
        </button>

        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-[var(--text)] mb-3 tracking-tight">Recuperar Senha</h1>
          <p className="text-[var(--text-muted)] text-[15px] max-w-[320px] mx-auto leading-relaxed">
            Informe o e-mail associado à sua conta para receber um link exclusivo de recuperação.
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm flex items-start gap-3">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Enviamos um link de recuperação para o seu e-mail. Por favor, verifique sua caixa de entrada e pasta de Spam.
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleResetRequest} className="flex flex-col gap-6">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2.5 block">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
              <input
                type="email"
                className="input-base pl-11"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center h-12 rounded-xl bg-[var(--orange)] hover:bg-[#d93214] text-white font-semibold text-[15px] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(240,58,23,0.3)] hover:shadow-[0_0_30px_rgba(240,58,23,0.5)] active:scale-[0.98]"
          >
            {loading ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              'Enviar Link de Recuperação'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[13px] text-[var(--text-muted)]">
            Lembrou da senha?{' '}
            <Link href="/login" className="text-[var(--text)] font-medium hover:text-[var(--orange)] transition-colors">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
