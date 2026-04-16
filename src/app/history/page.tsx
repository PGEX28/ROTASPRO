'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, type ProcessingRecord, type Purchase } from '@/lib/supabase'
import Navbar from '@/components/ui/Navbar'
import Link from 'next/link'
import { Clock, FileSpreadsheet, CreditCard, Zap, Package, TrendingUp, ArrowRight, Download } from 'lucide-react'

function fmt(dateStr: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr))
}

const supabase = createClient()

async function handleDownload(filePath: string, fileName: string) {
  const { data, error } = await supabase.storage.from('processed-files').download(filePath)
  if (error || !data) return
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-[var(--surface2)] animate-pulse flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-3 w-3/4 bg-[var(--surface2)] rounded animate-pulse" />
        <div className="h-2.5 w-1/2 bg-[var(--surface2)] rounded animate-pulse" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="h-3 w-14 bg-[var(--surface2)] rounded animate-pulse" />
        <div className="h-2.5 w-10 bg-[var(--surface2)] rounded animate-pulse" />
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const [credits, setCredits] = useState(0)
  const [history, setHistory] = useState<ProcessingRecord[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [tab, setTab] = useState<'processing' | 'purchases'>('processing')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: profile }, { data: hist }, { data: purch }] = await Promise.all([
        supabase.from('profiles').select('credits').eq('id', user.id).single(),
        supabase.from('processing_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('purchases').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      ])

      if (profile) setCredits(profile.credits)
      if (hist) setHistory(hist)
      if (purch) setPurchases(purch)
      setLoading(false)
    }
    load()
  }, [])

  const totalProcessed = history.reduce((a, r) => a + r.packages_processed + (r.manual_additions_count || 0), 0)
  const totalSpent = purchases.filter(p => p.status === 'paid').reduce((a, p) => a + Number(p.amount_paid), 0)

  const stats = [
    { icon: Zap,            label: 'Créditos',   value: credits,                               color: 'text-[var(--orange)]', bg: 'bg-[rgba(240,58,23,0.1)]',   border: 'border-[rgba(240,58,23,0.2)]'  },
    { icon: FileSpreadsheet, label: 'Planilhas',  value: history.length,                        color: 'text-blue-400',        bg: 'bg-[rgba(96,165,250,0.08)]', border: 'border-[rgba(96,165,250,0.2)]' },
    { icon: Package,         label: 'Pacotes',    value: totalProcessed,                        color: 'text-purple-400',      bg: 'bg-[rgba(167,139,250,0.08)]',border: 'border-[rgba(167,139,250,0.2)]'},
    { icon: TrendingUp,      label: 'Investido',  value: `R$ ${totalSpent.toFixed(0)}`,         color: 'text-[var(--green)]',  bg: 'bg-[rgba(34,197,94,0.08)]',  border: 'border-[rgba(34,197,94,0.2)]' },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar credits={credits} />

      <main className="flex-1 flex flex-col items-center px-4 py-6 md:py-10 w-full">
        <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* ── Header ── */}
        <div className="mb-8 animate-fade-up">
          <div className="inline-flex items-center gap-2 bg-[rgba(240,58,23,0.1)] border border-[rgba(240,58,23,0.25)] rounded-full px-3.5 py-1.5 text-[11px] font-semibold text-[var(--orange-light)] uppercase tracking-widest mb-4">
            <Clock size={11} /> Histórico
          </div>
          <h1 className="font-syne font-extrabold text-2xl md:text-3xl text-[var(--text)] tracking-tight leading-tight mb-2">
            Seu histórico
          </h1>
          <p className="text-[var(--text-muted)] text-sm leading-relaxed">
            Acompanhe todos os processamentos e compras realizadas.
          </p>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-3 animate-slide-in">
          {stats.map(({ icon: Icon, label, value, color, bg, border }) => (
            <div key={label} className={`rounded-2xl bg-[var(--surface)] border ${border} p-4 flex items-center gap-3`}>
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className={color} />
              </div>
              <div className="min-w-0">
                <div className={`font-syne font-extrabold text-2xl leading-none ${color}`}>{value}</div>
                <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider mt-1">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-2 p-2 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-2xl">
          {([
            { key: 'processing', label: 'Processamentos', Icon: FileSpreadsheet },
            { key: 'purchases',  label: 'Compras',         Icon: CreditCard },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-lg font-bold transition-all
                ${tab === key
                  ? 'bg-[var(--surface2)] text-[var(--text)] shadow-md border border-[var(--border-subtle)]'
                  : 'text-[var(--text-muted)]'}`}
            >
              <Icon className={`md:w-[18px] md:h-[18px] w-4 h-4`} /> <span className="text-sm md:text-lg">{label}</span>
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : tab === 'processing' ? (
          history.length === 0 ? (
            <div className="text-center py-16 px-6 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)]">
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface2)] flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet size={28} className="text-[var(--text-dim)]" />
              </div>
              <p className="font-syne font-bold text-[var(--text)] mb-1.5">Nenhum processamento ainda</p>
              <p className="text-sm text-[var(--text-muted)] mb-5">Processe sua primeira planilha no Dashboard.</p>
              <Link href="/dashboard" className="inline-flex items-center gap-2 bg-[var(--orange)] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[var(--orange-light)] transition-colors">
                Ir para o Dashboard <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {history.map((record, i) => (
                <div
                  key={record.id}
                  className="rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] p-4 flex items-center gap-4 hover:border-[rgba(240,58,23,0.3)] transition-all animate-slide-in"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className="w-11 h-11 rounded-xl bg-[rgba(240,58,23,0.1)] flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet size={18} className="text-[var(--orange)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] md:text-sm font-semibold text-[var(--text)] truncate">{record.file_name}</p>
                    <p className="text-[10px] md:text-xs text-[var(--text-muted)] mt-0.5">{fmt(record.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {record.file_path && (
                      <button
                        onClick={() => handleDownload(record.file_path!, record.file_name)}
                        className="w-8 h-8 rounded-lg bg-[rgba(34,197,94,0.1)] flex items-center justify-center hover:bg-[rgba(34,197,94,0.2)] transition-colors"
                        title="Baixar planilha"
                      >
                        <Download size={14} className="text-green-400" />
                      </button>
                    )}
                    <div className="flex items-center gap-1 bg-[rgba(240,58,23,0.1)] rounded-full px-2 py-0.5">
                      <Zap size={9} className="text-[var(--orange)]" fill="currentColor" />
                      <span className="text-[11px] font-bold text-[var(--orange)]">{record.credits_used} crédito</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          purchases.length === 0 ? (
            <div className="text-center py-16 px-6 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)]">
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface2)] flex items-center justify-center mx-auto mb-4">
                <CreditCard size={28} className="text-[var(--text-dim)]" />
              </div>
              <p className="font-syne font-bold text-[var(--text)] mb-1.5">Nenhuma compra ainda</p>
              <p className="text-sm text-[var(--text-muted)] mb-5">Adquira créditos para começar a processar.</p>
              <Link href="/pricing" className="inline-flex items-center gap-2 bg-[var(--orange)] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[var(--orange-light)] transition-colors">
                Ver planos <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {purchases.map((purchase, i) => (
                <div
                  key={purchase.id}
                  className="rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] p-4 flex items-center gap-4 hover:border-[rgba(240,58,23,0.3)] transition-all animate-slide-in"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${purchase.status === 'paid' ? 'bg-[rgba(34,197,94,0.12)]' : 'bg-[var(--surface2)]'}`}>
                    <CreditCard size={18} className={purchase.status === 'paid' ? 'text-[var(--green)]' : 'text-[var(--text-muted)]'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">Plano {purchase.plan_name}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{fmt(purchase.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <div className="text-sm font-bold text-[var(--text)]">R$ {Number(purchase.amount_paid).toFixed(2)}</div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-[rgba(240,58,23,0.1)] rounded-full px-2 py-0.5">
                        <Zap size={9} className="text-[var(--orange)]" fill="currentColor" />
                        <span className="text-[11px] font-bold text-[var(--orange)]">+{purchase.credits_added}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide
                        ${purchase.status === 'paid' ? 'bg-[rgba(34,197,94,0.15)] text-[var(--green)]' : 'bg-[rgba(240,58,23,0.12)] text-[var(--orange)]'}`}>
                        {purchase.status === 'paid' ? 'Pago' : 'Pendente'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        </div>
      </main>
    </div>
  )
}
