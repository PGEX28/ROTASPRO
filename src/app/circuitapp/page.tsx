'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Navbar from '@/components/ui/Navbar'
import { 
  Download, 
  ShieldCheck, 
  Smartphone, 
  Zap, 
  ArrowLeft, 
  Info,
  Lock
} from 'lucide-react'
import Link from 'next/link'

export default function CircuitAppPage() {
  const [loading, setLoading] = useState(true)
  const [isAllowed, setIsAllowed] = useState(false)
  const [credits, setCredits] = useState<number>(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkAccess() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()
      
      if (profile) setCredits(profile.credits)

      const { data: purchaseData } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'paid')
        .ilike('plan_name', '%Básico%')
        .limit(1)

      if (purchaseData && purchaseData.length > 0) {
        setIsAllowed(true)
        setLoading(false)
      } else {
        setTimeout(() => {
          if (!purchaseData || purchaseData.length === 0) {
             router.push('/pricing')
          }
        }, 3000)
        setLoading(false)
      }
    }

    checkAccess()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[rgba(240,58,23,0.1)] border-t-[var(--orange)] animate-spin" />
          <p className="text-[var(--text-muted)] font-syne animate-pulse text-sm">Verificando acesso VIP...</p>
        </div>
      </div>
    )
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
          <Lock size={40} className="text-red-500" />
        </div>
        <h1 className="font-syne font-extrabold text-2xl text-white mb-4">Acesso Restrito</h1>
        <p className="text-[var(--text-muted)] max-w-md mb-8 leading-relaxed text-sm">
          Esta página é exclusiva para assinantes do **Plano Básico**. 
          Você será redirecionado para nossa página de planos em instantes.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center">
      <div className="w-full">
        <Navbar credits={credits} />
      </div>

      <main className="flex-1 w-full max-w-7xl px-6 py-12 pb-32 flex flex-col items-center justify-center">
        {/* Back Link - TOP LEFT */}
        <div className="w-full flex justify-start mb-12 lg:px-8">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--orange)] transition-colors group">
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-bold uppercase tracking-widest font-syne">Voltar ao Dashboard</span>
          </Link>
        </div>

        {/* MAIN CONSOLIDATED CONTAINER */}
        <div className="w-full bg-gradient-to-br from-[var(--surface)] to-[var(--bg)] border border-white/5 rounded-[32px] md:rounded-[56px] pt-12 pb-12 md:pt-20 md:pb-20 px-6 md:px-24 lg:px-32 shadow-2xl flex flex-col items-center animate-fade-up relative overflow-hidden mb-12">
          {/* Subtle Glow Effect inside the box */}
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-[var(--orange)]/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

          {/* Hero Content - FIRST BLOCK */}
          <div className="flex flex-col items-center text-center max-w-2xl px-2 md:px-4 vip-block-spacer">
            <div className="inline-flex items-center gap-2 bg-[rgba(240,58,23,0.1)] border border-[rgba(240,58,23,0.25)] rounded-full px-3 py-1 text-[9px] md:text-[10px] font-bold text-[var(--orange-light)] uppercase tracking-[0.2em] mb-[25px]">
              <Zap size={10} fill="currentColor" /> Benefício Exclusivo - Básico
            </div>
            
            <h1 className="font-syne font-extrabold text-3xl md:text-5xl lg:text-6xl text-white tracking-tight leading-[1.1] mb-[25px]">
              App <span className="text-[var(--orange)]">Circuit</span> Profissional
            </h1>
            
            <p className="text-[var(--text-muted)] text-xs md:text-base leading-relaxed mb-[25px] max-w-xl">
              Otimize suas entregas com o melhor roteirizador do mercado. Esta versão modificada oferece recursos premium desbloqueados para máxima produtividade.
            </p>
            
            <div className="flex flex-col items-center gap-[25px] w-full">
              <a 
                href="https://github.com/PGEX28/circuit-app-deploy/releases/download/v1.0.0/circuit-route-planner.xapk" 
                target="_blank" 
                rel="noopener noreferrer"
                download
                className="bg-[var(--orange)] hover:bg-[var(--orange-light)] text-white px-8 md:px-12 py-5 md:py-6 rounded-2xl font-syne font-extrabold text-lg md:text-xl transition-all shadow-[0_20px_50px_rgba(240,58,23,0.5)] hover:-translate-y-1 flex items-center justify-center gap-3 w-full sm:w-auto active:scale-95"
              >
                <Download size={24} className="md:w-7 md:h-7" /> Baixar App Oficial
              </a>
              <div className="flex items-center gap-2.5 px-4 text-[var(--text-muted)] bg-[var(--surface2)]/30 py-2 rounded-full border border-white/5">
                <ShieldCheck size={14} className="text-[var(--green)] md:w-4 md:h-4" />
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.1em]">Download Seguro e Verificado</span>
              </div>
            </div>
          </div>

          {/* Tutorial Content - SECOND BLOCK */}
          <div className="w-full vip-block-spacer flex flex-col items-center text-center">
            <div className="text-center mb-[25px]">
              <h2 className="font-syne font-extrabold text-2xl md:text-3xl text-white mb-[10px]">Tutorial de Instalação</h2>
              <div className="w-12 h-1 bg-[var(--orange)] mx-auto mb-[25px] rounded-full" />
              <p className="text-[var(--text-muted)] max-w-md mx-auto text-xs md:text-sm leading-relaxed text-center px-4">
                Siga este passo a passo para ativar sua versão premium com total segurança.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-[25px] w-full max-w-5xl">
              {[
                {
                  step: '01',
                  title: 'Download',
                  desc: 'Baixe o APK de forma simples diretamente do link oficial no GitHub Releases.',
                  icon: Download
                },
                {
                  step: '02',
                  title: 'Instalação',
                  desc: 'Habilite "Fontes Desconhecidas" no seu Android para permitir a instalação do app.',
                  icon: Smartphone
                },
                {
                  step: '03',
                  title: 'Ativação',
                  desc: 'Entre com seu telefone via SMS para liberar automaticamente os recursos PRO.',
                  icon: Zap
                }
              ].map((item, i) => (
                <div key={i} className="group p-8 md:p-10 rounded-[32px] bg-[var(--surface2)]/40 border border-white/5 hover:border-[rgba(240,58,23,0.3)] transition-all flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[rgba(240,58,23,0.08)] flex items-center justify-center mb-6">
                    <item.icon size={26} className="text-[var(--orange)]" />
                  </div>
                  <h4 className="font-syne font-bold text-lg md:text-xl text-white mb-3">{item.title}</h4>
                  <p className="text-[var(--text-muted)] text-xs md:text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Safety Alert - FINAL BLOCK */}
          <div className="flex flex-col items-center text-center max-w-2xl px-2 md:px-6">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center flex-shrink-0 border border-blue-500/20 mb-[25px]">
               <Info size={30} className="text-blue-400 md:w-9 md:h-9" />
            </div>
            <h4 className="font-syne font-bold text-xl md:text-2xl text-white mb-[10px] tracking-tight">Informação Importante</h4>
            <p className="text-[var(--text-muted)] text-xs md:text-sm leading-relaxed max-w-xl mx-auto px-4">
              O App é verificado e seguro. A ativação por número de telefone é obrigatória e necessária para contornar o sistema de proteção da licença original e habilitar as funções premium. Seus dados de rota e localização permanecem 100% privados e criptografados.
            </p>
          </div>
        </div>
      </main>

      <footer className="py-12 border-t border-white/5 w-full text-center text-[var(--text-muted)] text-[10px] uppercase tracking-[0.2em] font-bold opacity-60">
         <p>© {new Date().getFullYear()} RotasPro — VIP Central</p>
      </footer>
    </div>
  )
}
