'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showConfPass, setShowConfPass] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    
    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        throw error
      }

      setSuccess(true)
      // Após sucesso, enviamos para o dashboard depois de um breve delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2500)
      
    } catch (err: any) {
      console.error('Update password error:', err)
      setError(err.message || 'Erro ao redefinir a senha. O link pode ter expirado.')
    } finally {
      setLoading(false)
    }
  }

  // Se o usuário clicar em Voltar ao Login
  const handleLogoutAndGoBack = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-6 sm:p-8 animate-fade-in relative z-10 w-full">
      <div className="w-full max-w-[400px]">

        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-[var(--text)] mb-3 tracking-tight">Nova Senha</h1>
          <p className="text-[var(--text-muted)] text-[15px] max-w-[320px] mx-auto leading-relaxed">
            Digite sua nova senha abaixo para recuperar o acesso à sua conta.
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm flex items-start gap-3">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Senha atualizada com sucesso! Redirecionando para o seu Dashboard...
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
        {!success && (
          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-6">
            
            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2.5 block">Nova Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-base pl-11 pr-12"
                  placeholder="No mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2.5 block">Confirmar Nova Senha</label>
              <div className="relative">
                <input
                  type={showConfPass ? 'text' : 'password'}
                  className="input-base pr-12"
                  placeholder="Repita sua nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfPass(!showConfPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  {showConfPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || password.length < 6 || !confirmPassword}
              className="mt-2 flex items-center justify-center h-12 rounded-xl bg-[var(--orange)] hover:bg-[#d93214] text-white font-semibold text-[15px] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(240,58,23,0.3)] hover:shadow-[0_0_30px_rgba(240,58,23,0.5)] active:scale-[0.98]"
            >
              {loading ? (
                <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                'Salvar Nova Senha'
              )}
            </button>
          </form>
        )}

        <div className="mt-8 text-center flex flex-col gap-3">
          {!success && (
            <button 
              onClick={handleLogoutAndGoBack}
              disabled={loading}
              className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancelar e voltar ao Login
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
