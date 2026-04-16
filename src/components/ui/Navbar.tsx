'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Zap, LayoutDashboard, CreditCard, Clock, LogOut, Menu, X, Smartphone, ShieldCheck, BarChart3, Wand2, Database } from 'lucide-react'

type NavProps = { credits?: number }

export default function Navbar({ credits }: NavProps) {
  const [user, setUser] = useState<{ email?: string; full_name?: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isBasicMember, setIsBasicMember] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name,
        })

        // 1. Verificar se é Admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', data.user.id)
          .single()
        
        if (profile?.is_admin) {
          setIsAdmin(true)
        }

        // 2. Verificar se é membro do Plano Básico
        const { data: purchaseData } = await supabase
          .from('purchases')
          .select('id')
          .eq('user_id', data.user.id)
          .eq('status', 'paid')
          .ilike('plan_name', '%Básico%')
          .limit(1)
        
        if (purchaseData && purchaseData.length > 0) {
          setIsBasicMember(true)
        }
      }
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="z-50 w-full border-b border-[var(--border-subtle)] bg-[rgba(15,13,12,0.95)] flex justify-center">
      <div className="w-full max-w-5xl px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-[0_0_18px_var(--orange-glow)] flex-shrink-0">
            <Image src="/logo-app.png" alt="RotasPro" width={36} height={36} className="object-cover w-full h-full" />
          </div>
          <span className="font-syne font-extrabold text-lg text-[var(--text)] tracking-tight">
            Rotas<span className="text-[var(--orange)]">Pro</span>
          </span>
        </Link>

        <div className="hidden md:block nav-divider" />

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-all whitespace-nowrap">
            <LayoutDashboard size={16} /> Dashboard
          </Link>
          <div className="nav-divider" />
          <Link href="/pricing" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-all whitespace-nowrap">
            <CreditCard size={16} /> Créditos
          </Link>
          <div className="nav-divider" />
          <Link href="/history" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-all whitespace-nowrap">
            <Clock size={16} /> Histórico
          </Link>
          
          {isAdmin && (
            <>
              <div className="nav-divider" />
              <Link href="/admin/quality" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-emerald-400 hover:bg-[rgba(52,211,153,0.1)] transition-all whitespace-nowrap">
                <BarChart3 size={16} /> Qualidade
              </Link>
              <div className="nav-divider" />
              <Link href="/admin/corrections" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-blue-400 hover:bg-[rgba(59,130,246,0.1)] transition-all whitespace-nowrap">
                <Database size={16} /> Correções
              </Link>
              <div className="nav-divider" />
              <Link href="/admin/suggestions" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-orange-400 hover:bg-[rgba(240,58,23,0.1)] transition-all whitespace-nowrap">
                <Wand2 size={16} /> Sugestões
              </Link>
              <div className="nav-divider" />
              <Link href="/admin/credits" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-[var(--orange)] bg-[rgba(240,58,23,0.08)] hover:bg-[rgba(240,58,23,0.15)] transition-all border border-[rgba(240,58,23,0.2)] whitespace-nowrap">
                <ShieldCheck size={16} /> Painel Admin
              </Link>
            </>
          )}
        </nav>

        <div className="hidden md:block nav-divider" />

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Credits badge */}
          {credits !== undefined && (
            <Link href="/pricing" className="hidden sm:flex items-center gap-1.5 bg-[rgba(240,58,23,0.12)] border border-[var(--border)] rounded-full px-3 py-1.5 text-sm font-semibold text-[var(--orange)] hover:bg-[rgba(240,58,23,0.2)] transition-all">
              <Zap size={13} fill="currentColor" />
              {credits} créditos
            </Link>
          )}

          {/* User email */}
          {user && (
            <span className="hidden lg:block text-xs text-[var(--text-muted)] max-w-[140px] truncate">
              {user.full_name || user.email}
            </span>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--surface2)] transition-all"
          >
            <LogOut size={15} />
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface2)] transition-all"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[var(--border-subtle)] bg-[var(--surface)] px-5 py-4 flex flex-col gap-2 animate-fade-up">
          {credits !== undefined && (
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--orange)] mb-2">
              <Zap size={14} fill="currentColor" />
              {credits} créditos disponíveis
            </div>
          )}
          
          {isAdmin && (
            <>
              <Link href="/admin/quality" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-400 bg-[rgba(52,211,153,0.08)] mb-1">
                <BarChart3 size={15} /> Qualidade Global
              </Link>
              <Link href="/admin/corrections" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-400 bg-[rgba(59,130,246,0.08)] mb-1">
                <Database size={15} /> Correções
              </Link>
              <Link href="/admin/suggestions" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-orange-400 bg-[rgba(248,113,113,0.08)] mb-1">
                <Wand2 size={15} /> Sugestões
              </Link>
              <Link href="/admin/credits" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold text-[var(--orange)] bg-[rgba(240,58,23,0.1)] mb-2">
                <ShieldCheck size={15} /> Painel Administrativo
              </Link>
            </>
          )}

          <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)]">
            <LayoutDashboard size={15} /> Dashboard
          </Link>
          <Link href="/pricing" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)]">
            <CreditCard size={15} /> Comprar Créditos
          </Link>
          <Link href="/history" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)]">
            <Clock size={15} /> Histórico
          </Link>
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-[var(--surface2)] text-left">
            <LogOut size={15} /> Sair
          </button>
        </div>
      )}
    </header>
  )
}
