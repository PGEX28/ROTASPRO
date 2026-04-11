'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { Zap, LayoutDashboard, CreditCard, Clock, LogOut, Menu, X, Smartphone, ShieldCheck } from 'lucide-react'

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
    <header className="sticky top-0 z-50 backdrop-blur-md border-b border-[var(--border-subtle)] bg-[rgba(15,13,12,0.85)]">
      <div className="max-w-5xl mx-auto px-4 py-2.5 md:py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-[0_0_18px_var(--orange-glow)] flex-shrink-0">
            <Image src="/logo-app.png" alt="RotasPro" width={36} height={36} className="object-cover w-full h-full" />
          </div>
          <span className="font-syne font-extrabold text-lg text-[var(--text)] tracking-tight">
            Rotas<span className="text-[var(--orange)]">Pro</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg text-base font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-all">
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link href="/pricing" className="flex items-center gap-2 px-4 py-2 rounded-lg text-base font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-all">
            <CreditCard size={18} /> Créditos
          </Link>
          <Link href="/history" className="flex items-center gap-2 px-4 py-2 rounded-lg text-base font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-all">
            <Clock size={18} /> Histórico
          </Link>
          
          {isAdmin && (
            <Link href="/admin/credits" className="flex items-center gap-2 px-4 py-2 rounded-lg text-base font-bold text-[var(--orange)] bg-[rgba(240,58,23,0.08)] hover:bg-[rgba(240,58,23,0.15)] transition-all border border-[rgba(240,58,23,0.2)]">
              <ShieldCheck size={18} /> Painel Admin
            </Link>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Credits badge - Visible on mobile for better interaction */}
          {credits !== undefined && (
            <Link href="/pricing" className="flex items-center gap-1 bg-[rgba(240,58,23,0.12)] border border-[rgba(240,58,23,0.2)] rounded-full px-2.5 py-1 md:px-3 md:py-1.5 text-[11px] md:text-sm font-bold text-[var(--orange)] hover:bg-[rgba(240,58,23,0.2)] active:scale-95 transition-all">
              <Zap size={11} className="md:w-[13px] md:h-[13px]" fill="currentColor" />
              {credits} <span className="hidden xs:inline ml-0.5">créditos</span>
            </Link>
          )}

          {/* User profile / email - Hidden on mobile, shown on desktop */}
          {user && (
            <span className="hidden md:block text-xs text-[var(--text-muted)] max-w-[120px] truncate">
              {user.full_name || user.email?.split('@')[0]}
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
            <Link href="/admin/credits" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold text-[var(--orange)] bg-[rgba(240,58,23,0.1)] mb-2">
              <ShieldCheck size={15} /> Painel Administrativo
            </Link>
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
