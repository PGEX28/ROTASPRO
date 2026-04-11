'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { addCreditsManualAction, fetchAllUsersAction, resetCreditsAction } from './actions'
import { PlusCircle, Search, ShieldCheck, Mail, Loader2, CheckCircle2, AlertCircle, User, Trash2, Coins, ArrowLeft } from 'lucide-react'

export default function AdminCreditsContent() {
  const [email, setEmail] = useState('')
  const [credits, setCredits] = useState('10')
  const [selectedUserBalance, setSelectedUserBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  
  // Estados para o Autocomplete
  const [allUsers, setAllUsers] = useState<{email: string, full_name?: string, credits?: number}[]>([])
  const [filteredUsers, setFilteredUsers] = useState<{email: string, full_name?: string, credits?: number}[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const loadUsers = async () => {
    const result = await fetchAllUsersAction()
    if (result.success && result.users) {
      setAllUsers(result.users)
    }
  }

  useEffect(() => {
    loadUsers()

    // Fechar sugestões ao clicar fora
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmail(value)
    setSelectedUserBalance(null)
    
    if (value.length > 0) {
      const filtered = allUsers.filter(u => 
        u.email.toLowerCase().includes(value.toLowerCase()) || 
        (u.full_name && u.full_name.toLowerCase().includes(value.toLowerCase()))
      ).slice(0, 5)
      setFilteredUsers(filtered)
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  const selectUser = (u: { email: string, credits?: number }) => {
    setEmail(u.email)
    setSelectedUserBalance(u.credits ?? 0)
    setShowSuggestions(false)
  }

  const handleAddCredits = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setStatus(null)
    setShowSuggestions(false)

    const amount = parseInt(credits)
    if (isNaN(amount) || amount <= 0) {
      setStatus({ type: 'error', message: 'Quantidade de créditos inválida.' })
      setLoading(false)
      return
    }

    const result = await addCreditsManualAction(email, amount)

    if (result.success) {
      setStatus({ type: 'success', message: result.message! })
      setEmail('')
      setCredits('10')
      setSelectedUserBalance(null)
      loadUsers() // Recarregar lista
    } else {
      setStatus({ type: 'error', message: result.error || 'Erro ao adicionar créditos.' })
    }

    setLoading(false)
  }

  const handleResetCredits = async () => {
    if (!email) return
    if (!window.confirm(`TEM CERTEZA? Isso vai ZERAR todos os créditos do usuário ${email}. Esta ação não pode ser desfeita.`)) {
      return
    }

    setResetLoading(true)
    setStatus(null)

    const result = await resetCreditsAction(email)

    if (result.success) {
      setStatus({ type: 'success', message: result.message! })
      setSelectedUserBalance(0)
      loadUsers()
    } else {
      setStatus({ type: 'error', message: result.error || 'Erro ao zerar créditos.' })
    }
    setResetLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0F0D0C] text-[#F5F0ED] p-6 font-dm-sans flex items-center justify-center">
      <div className="max-w-3xl w-full translate-y-[-2%]">
        
        {/* Botão Voltar */}
        <div className="mb-6 animate-fade-up">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface2 border border-border text-text-muted hover:text-white hover:bg-surface transition-all group shadow-sm hover:shadow-md"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-bold">Voltar ao Dashboard</span>
          </Link>
        </div>

        <div className="card-base p-16 shadow-2xl animate-slide-in overflow-visible relative">
          <div className="flex items-center justify-between mb-12 animate-fade-up">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-orange-subtle rounded-2xl border border-border shadow-[0_0_20px_var(--orange-glow)]">
                <ShieldCheck className="w-10 h-10 text-orange" />
              </div>
              <div>
                <h1 className="text-4xl font-syne font-extrabold tracking-tight">Portal Admin</h1>
                <p className="text-text-muted mt-1 text-lg">Gerenciamento de saldo de clientes</p>
              </div>
            </div>
            
            {/* Display de Saldo Atual */}
            {selectedUserBalance !== null && (
              <div className="bg-surface2 border border-orange/20 rounded-2xl p-4 flex items-center gap-4 animate-pop-in shadow-xl">
                <div className="w-12 h-12 rounded-full bg-orange/10 flex items-center justify-center text-orange border border-orange/20">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-text-dim font-bold">Saldo Atual</p>
                  <p className="text-2xl font-syne font-black text-white">
                    {selectedUserBalance} <span className="text-sm font-medium text-orange">créditos</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleAddCredits} className="space-y-8 relative z-10">
            <div className="space-y-3 relative">
              <label className="text-sm font-semibold text-text-muted flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4 text-orange" /> E-mail do Cliente
              </label>
              <div className="relative group">
                <input 
                  type="email" 
                  placeholder="cliente@exemplo.com"
                  className="input-base pr-12 py-5 text-lg"
                  value={email}
                  onChange={handleEmailChange}
                  onFocus={() => email.length > 0 && setShowSuggestions(true)}
                  autoComplete="off"
                  required
                />
                <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-text-dim group-focus-within:text-orange transition-colors" />
              </div>

              {/* Sugestões de E-mail (Autocomplete) */}
              {showSuggestions && filteredUsers.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className="absolute z-50 left-0 right-0 mt-2 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-up max-h-[300px] overflow-y-auto"
                >
                  {filteredUsers.map((u, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectUser(u)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-orange-subtle text-left transition-all border-b border-border-subtle last:border-0 group/item"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-surface2 flex items-center justify-center border border-border group-hover/item:border-orange/30 transition-colors">
                          <User className="w-5 h-5 text-text-muted group-hover/item:text-orange transition-colors" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          {u.full_name && (
                            <span className="text-sm font-bold text-text truncate">
                              {u.full_name}
                            </span>
                          )}
                          <span className="text-sm text-text-muted truncate">
                            {u.email}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-orange bg-orange/10 px-2 py-1 rounded-md uppercase">
                          {u.credits || 0} CR
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-text-muted flex items-center gap-2 mb-1">
                  <PlusCircle className="w-4 h-4 text-orange" /> Adicionar Créditos
                </label>
                <input 
                  type="number" 
                  placeholder="Ex: 50"
                  className="input-base py-5 text-lg"
                  value={credits}
                  onChange={(e) => setCredits(e.target.value)}
                  min="1"
                  required
                />
              </div>

              <div className="space-y-3 flex flex-col justify-end">
                <button 
                  type="submit" 
                  className="btn-primary py-5 text-lg"
                  disabled={loading || resetLoading}
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <PlusCircle className="w-6 h-6" />}
                  Confirmar Recarga
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <div className="flex-1 h-[1px] bg-border-subtle" />
              <span className="text-[10px] font-black text-text-dim uppercase tracking-[0.2em]">Ou Auditoria de Saldo</span>
              <div className="flex-1 h-[1px] bg-border-subtle" />
            </div>

            {/* Ações de Perigo */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleResetCredits}
                disabled={!email || loading || resetLoading}
                className="flex items-center gap-3 px-8 py-4 rounded-2xl border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed group"
              >
                {resetLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                )}
                Zerar Saldo deste Usuário
              </button>
            </div>

            {status && (
              <div className={`p-5 rounded-2xl flex items-center gap-4 border shadow-lg ${
                status.type === 'success' 
                  ? 'bg-green-glow border-green/30 text-green' 
                  : 'bg-red-500/10 border-red-500/20 text-red-500'
              } animate-pop-in`}>
                {status.type === 'success' ? <CheckCircle2 className="w-6 h-6 flex-shrink-0" /> : <AlertCircle className="w-6 h-6 flex-shrink-0" />}
                <p className="text-sm font-bold">{status.message}</p>
              </div>
            )}
          </form>

          <div className="mt-12 pt-10 border-t border-border-subtle">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-text-dim mb-6 flex items-center gap-2">
              <div className="w-8 h-[1px] bg-border-subtle" />
              Diretrizes Administrativas
            </h3>
            <ul className="space-y-4">
              <li className="flex gap-4 text-sm text-text-muted leading-relaxed">
                <div className="w-2 h-2 rounded-full bg-orange mt-1.5 flex-shrink-0 shadow-[0_0_8px_var(--orange)]" />
                Todas as adições manuais são registradas no log de auditoria com seu ID de admin.
              </li>
              <li className="flex gap-4 text-sm text-text-muted leading-relaxed">
                <div className="w-2 h-2 rounded-full bg-orange mt-1.5 flex-shrink-0 shadow-[0_0_8px_var(--orange)]" />
                Verifique o e-mail do cliente cuidadosamente antes de confirmar.
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex justify-between items-center text-[11px] text-text-dim uppercase tracking-[0.15em] font-bold animate-fade-up">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse shadow-[0_0_8px_var(--green)]" />
            Backend Protegido (Server-Side)
          </div>
          <div className="opacity-60">RotasPro v2.0 • Admin Shield</div>
        </div>
      </div>
    </div>
  )
}
