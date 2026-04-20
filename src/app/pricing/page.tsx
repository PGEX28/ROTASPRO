'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Navbar from '@/components/ui/Navbar'
import PixModal from '@/components/PixModal'
import { PLANS } from '@/lib/plans'
import { Check, Zap, Star, Crown, Rocket, ShieldCheck, Infinity, Smartphone, ArrowRight } from 'lucide-react'

const planIcons = [Zap, Rocket, Star, Crown]

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pixData, setPixData] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handlePurchase(plan: any) {
    setLoading(plan.id)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { 
      router.push('/login')
      return 
    }

    try {
      // Chamada para API de Checkout PIX (Mercado Pago)
      const res = await fetch('/api/checkout/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: plan.id })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar PIX')
      }

      // Exibe o modal com os dados do Mercado Pago
      setPixData(data)
      setIsModalOpen(true)
      setLoading(null)
    } catch (err: any) {
      setError(err.message || 'Erro ao processar pagamento.')
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1 flex flex-col items-center px-4 py-8 md:py-20 gap-10 md:gap-12 w-full">
        {/* ── Header ── */}
        <div className="text-center animate-fade-up w-full max-w-xl">
          <div className="inline-flex items-center gap-2 bg-[rgba(240,58,23,0.1)] border border-[rgba(240,58,23,0.28)] rounded-full px-4 py-1.5 text-[11px] font-semibold text-[var(--orange-light)] uppercase tracking-widest mb-5">
            <Zap size={11} fill="currentColor" /> Planos e Créditos
          </div>
          <h1 className="font-syne font-extrabold text-3xl md:text-5xl text-[var(--text)] tracking-tight leading-[1.08] mb-4">
            Escolha seu <span className="text-[var(--orange)]">plano</span>
          </h1>
          <p className="text-[var(--text-muted)] text-base leading-relaxed">
            Cada crédito = 1 planilha processada. Quanto mais créditos, menor o custo por processamento.
          </p>
        </div>

        {/* ── Plans grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 w-full max-w-5xl animate-fade-up">
          {PLANS.map((plan, i) => {
            const Icon = planIcons[i]
            const isHL = plan.highlight
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300
                  ${isHL
                    ? 'bg-[var(--surface)] border-2 border-[var(--orange)] shadow-[0_0_60px_rgba(240,58,23,0.25)] scale-[1.03]'
                    : 'bg-[var(--surface)] border border-[var(--border)] hover:border-[rgba(240,58,23,0.5)] hover:-translate-y-1 hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)]'
                  }`}
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div className={`absolute top-0 left-0 right-0 h-[2px] ${isHL ? 'bg-[var(--orange)]' : 'bg-gradient-to-r from-transparent via-[rgba(240,58,23,0.5)] to-transparent'}`} />

                {plan.badge && (
                  <div className="absolute top-4 right-4">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wide uppercase
                      ${isHL ? 'bg-[var(--orange)] text-white' : 'bg-[var(--surface2)] text-[var(--orange)] border border-[var(--border)]'}`}>
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="p-6 flex flex-col gap-5 flex-1">
                  {/* Icon */}
                  <div className={`w-12 h-12 flex-shrink-0 ml-2 rounded-xl flex items-center justify-center ${isHL ? 'bg-[var(--orange)] shadow-[0_4px_20px_rgba(240,58,23,0.5)]' : 'bg-[var(--surface2)] border border-[var(--border)]'}`}>
                    <Icon size={22} className={isHL ? 'text-white' : 'text-[var(--orange)]'} />
                  </div>

                  {/* Name */}
                  <div className="text-center w-full">
                    <h3 className="font-syne font-extrabold text-xl text-[var(--text)]">{plan.name}</h3>
                    <p className="text-[var(--text-muted)] text-xs mt-1 leading-relaxed">{plan.description}</p>
                  </div>

                  {/* Price */}
                  <div className="py-8 border-y border-[var(--border-subtle)] w-full flex flex-col items-center justify-center gap-3">
                    <div className="flex items-baseline gap-1 justify-center">
                      <span className="text-[var(--text-muted)] text-sm font-medium">R$</span>
                      <span className="font-syne font-extrabold text-4xl leading-none text-[var(--text)]">{plan.price}</span>
                    </div>
                    <div className="flex items-center gap-5 justify-center">
                      <div className="flex items-center gap-1.5 bg-[rgba(240,58,23,0.12)] border border-[rgba(240,58,23,0.25)] rounded-full px-3 py-1">
                        <Zap size={10} className="text-[var(--orange)]" fill="currentColor" />
                        <span className="text-xs font-bold text-[var(--orange)]">{plan.credits} créditos</span>
                      </div>
                      <span className="text-xs text-[var(--text-dim)]">R$ {plan.pricePerCredit.toFixed(2)}/un</span>
                    </div>
                  </div>

                  {/* Perks */}
                  <div className="flex flex-col flex-1 w-full items-center">
                    <ul className="flex flex-col gap-2.5 w-max max-w-full">
                      {plan.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-2.5 text-sm text-[var(--text-muted)] text-left">
                          <Check size={14} className="text-[var(--green)] mt-0.5 flex-shrink-0" />
                          <span className="leading-tight">{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA button */}
                  <button
                    onClick={() => handlePurchase(plan)}
                    disabled={loading !== null}
                    className={`w-full rounded-xl py-[22px] font-syne font-bold text-lg flex items-center justify-center gap-2 transition-all duration-200
                      ${isHL
                        ? 'bg-[var(--orange)] text-white shadow-[0_4px_30px_rgba(240,58,23,0.5)] hover:bg-[var(--orange-light)] hover:shadow-[0_6px_40px_rgba(240,58,23,0.65)] hover:-translate-y-0.5'
                        : 'bg-[var(--surface2)] text-[var(--text)] border-2 border-[rgba(240,58,23,0.4)] hover:border-[var(--orange)] hover:bg-[rgba(240,58,23,0.1)] hover:text-[var(--orange)] hover:-translate-y-0.5'
                      } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                  >
                    {loading === plan.id ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      `R$ ${plan.price}`
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-semibold">
              <ShieldCheck size={20} />
              {error}
            </div>
          </div>
        )}

        {/* Hard Separator */}
        <div className="w-full max-w-5xl border-b border-[var(--border-subtle)]/50" />

        {/* ── FAQ ── */}
        <div className="w-full max-w-3xl animate-fade-up -mt-4 bg-[var(--background)] relative" style={{ animationDelay: '0.3s' }}>
          <div className="text-center mb-10">
            <h2 className="font-syne font-extrabold text-2xl md:text-3xl text-[var(--text)] mb-3">Como funcionam os créditos?</h2>
            <p className="text-[var(--text-muted)] text-sm">Simples, transparente e sem surpresas.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { Icon: Zap,         title: '1 crédito = 1 planilha',  desc: 'Cada processamento completo desconta exatamente 1 crédito do seu saldo.',     color: 'text-[var(--orange)]', bg: 'bg-[rgba(240,58,23,0.1)]'   },
              { Icon: ShieldCheck, title: 'Pagamento seguro',         desc: 'Créditos pré-pagos sem assinatura. Compre e use quando precisar.',            color: 'text-blue-400',        bg: 'bg-[rgba(96,165,250,0.1)]'  },
              { Icon: Infinity,    title: 'Sem vencimento',           desc: 'Seus créditos não expiram. Use no seu ritmo, sem pressa.',                    color: 'text-[var(--green)]',  bg: 'bg-[rgba(34,197,94,0.1)]'   },
              { Icon: Smartphone,  title: '100% mobile',              desc: 'Feito para entregadores Shopee. Acesse do celular em campo, sem complicação.', color: 'text-purple-400',      bg: 'bg-[rgba(167,139,250,0.1)]' },
            ].map(({ Icon, title, desc, color, bg }) => (
              <div key={title} className="flex items-center gap-5 p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] hover:border-[rgba(240,58,23,0.2)] transition-all">
                <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={26} className={color} />
                </div>
                <div className="text-left">
                  <p className="text-[15px] font-bold text-[var(--text)] mb-1">{title}</p>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Modal PIX */}
      <PixModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        pixData={pixData} 
      />
    </div>
  )
}
