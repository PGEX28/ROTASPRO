'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Navbar from '@/components/ui/Navbar'
import {
  BarChart3, Activity, MapPin, AlertTriangle, ShieldAlert,
  TrendingUp, Users, FileSpreadsheet, CheckCircle2, XCircle, Download
} from 'lucide-react'

interface QualitySummary {
  totalRows: number
  shopeeCount: number
  cacheCount: number
  googleCount: number
  noneCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  suspectDistanceCount: number
  invalidDistanceCount: number
  rooftopCount: number
  interpolatedCount: number
  // Auditoria Shopee (compatível com registros antigos via || 0)
  shopeeAuditCheckedCount?: number
  shopeeAuditOkCount?: number
  shopeeAuditSuspectCount?: number
  shopeeAuditInvalidCount?: number
  shopeeAuditNoReferenceCount?: number
}

interface HistoryRecord {
  id: string
  user_id: string
  file_name: string
  packages_processed: number
  stops_count: number
  manual_additions_count: number
  credits_used: number
  quality_summary: QualitySummary | null
  created_at: string
  profiles?: { email?: string; full_name?: string }
}

export default function QualityDashboard() {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadAll() {
      const { data } = await supabase
        .from('processing_history')
        .select('*, profiles(email, full_name)')
        .order('created_at', { ascending: false })
        .limit(200)

      if (data) setRecords(data as HistoryRecord[])
      setLoading(false)
    }
    loadAll()
  }, [])

  // Agregar métricas globais
  const agg = records.reduce(
    (acc, r) => {
      const q = r.quality_summary
      acc.totalProcessings++
      acc.totalPackages += r.packages_processed || 0
      acc.totalStops += r.stops_count || 0
      if (q) {
        acc.totalRows += q.totalRows || 0
        acc.shopee += q.shopeeCount || 0
        acc.cache += q.cacheCount || 0
        acc.google += q.googleCount || 0
        acc.none += q.noneCount || 0
        acc.high += q.highCount || 0
        acc.medium += q.mediumCount || 0
        acc.low += q.lowCount || 0
        acc.suspect += q.suspectDistanceCount || 0
        acc.invalid += q.invalidDistanceCount || 0
        acc.rooftop += q.rooftopCount || 0
        acc.interpolated += q.interpolatedCount || 0
        acc.auditChecked += q.shopeeAuditCheckedCount || 0
        acc.auditOk += q.shopeeAuditOkCount || 0
        acc.auditSuspect += q.shopeeAuditSuspectCount || 0
        acc.auditInvalid += q.shopeeAuditInvalidCount || 0
        acc.auditNoRef += q.shopeeAuditNoReferenceCount || 0
        acc.withStats++
      }
      return acc
    },
    {
      totalProcessings: 0, totalPackages: 0, totalStops: 0, totalRows: 0,
      shopee: 0, cache: 0, google: 0, none: 0,
      high: 0, medium: 0, low: 0,
      suspect: 0, invalid: 0, rooftop: 0, interpolated: 0, withStats: 0,
      auditChecked: 0, auditOk: 0, auditSuspect: 0, auditInvalid: 0, auditNoRef: 0,
    }
  )

  const pct = (val: number, total: number) => total > 0 ? ((val / total) * 100).toFixed(1) : '0.0'

  const exportToCSV = () => {
    if (!records || records.length === 0) return

    const headers = [
      'created_at', 'user_id', 'file_name', 'packages_processed', 'stops_count',
      'manual_additions_count', 'credits_used', 'totalRows', 'shopeeCount',
      'cacheCount', 'googleCount', 'noneCount', 'highCount', 'mediumCount',
      'lowCount', 'rooftopCount', 'interpolatedCount', 'suspectDistanceCount',
      'invalidDistanceCount', 'shopeeAuditCheckedCount', 'shopeeAuditOkCount',
      'shopeeAuditSuspectCount', 'shopeeAuditInvalidCount', 'shopeeAuditNoReferenceCount'
    ]

    const rows = records.map(r => {
      const q = r.quality_summary || {} as Partial<QualitySummary>
      return [
        r.created_at,
        r.user_id,
        `"${r.file_name?.replace(/"/g, '""') || ''}"`,
        r.packages_processed || 0,
        r.stops_count || 0,
        r.manual_additions_count || 0,
        r.credits_used || 0,
        q.totalRows || 0,
        q.shopeeCount || 0,
        q.cacheCount || 0,
        q.googleCount || 0,
        q.noneCount || 0,
        q.highCount || 0,
        q.mediumCount || 0,
        q.lowCount || 0,
        q.rooftopCount || 0,
        q.interpolatedCount || 0,
        q.suspectDistanceCount || 0,
        q.invalidDistanceCount || 0,
        q.shopeeAuditCheckedCount || 0,
        q.shopeeAuditOkCount || 0,
        q.shopeeAuditSuspectCount || 0,
        q.shopeeAuditInvalidCount || 0,
        q.shopeeAuditNoReferenceCount || 0
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `qualidade-global-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] items-center">
      <Navbar />
      <main className="w-full max-w-5xl px-6 py-10 flex flex-col items-center">
        <div className="w-full">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <BarChart3 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-syne font-bold text-[var(--text)]">
                Qualidade <span className="text-emerald-400">Global</span>
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                Métricas agregadas de todos os processamentos
              </p>
            </div>
          </div>
          <button 
            onClick={exportToCSV}
            disabled={loading || records.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-lg text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} className="text-[var(--text-muted)]" />
            <span className="font-medium text-sm">Exportar CSV</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[var(--text-muted)]">
            <Activity size={32} className="mx-auto mb-3 animate-pulse" />
            Carregando métricas...
          </div>
        ) : (
          <>
            {/* Cards de Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon={<FileSpreadsheet size={20} />} label="Processamentos" value={agg.totalProcessings} color="orange" />
              <StatCard icon={<TrendingUp size={20} />} label="Linhas Totais" value={agg.totalRows} color="blue" />
              <StatCard icon={<Users size={20} />} label="Com Métricas" value={agg.withStats} color="emerald" />
              <StatCard icon={<MapPin size={20} />} label="Paradas Geradas" value={agg.totalStops} color="purple" />
            </div>

            {/* Fonte das Coordenadas */}
            <SectionTitle title="Fonte das Coordenadas" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <MetricBar label="Shopee" value={agg.shopee} total={agg.totalRows} color="bg-emerald-500" />
              <MetricBar label="Cache" value={agg.cache} total={agg.totalRows} color="bg-blue-500" />
              <MetricBar label="Google" value={agg.google} total={agg.totalRows} color="bg-amber-500" />
              <MetricBar label="Sem Coord." value={agg.none} total={agg.totalRows} color="bg-red-500" />
            </div>

            {/* Qualidade */}
            <SectionTitle title="Qualidade das Coordenadas" />
            <div className="grid grid-cols-3 gap-4 mb-8">
              <QualityCard label="Alta" value={agg.high} pct={pct(agg.high, agg.totalRows)} icon={<CheckCircle2 size={18} />} color="emerald" />
              <QualityCard label="Média" value={agg.medium} pct={pct(agg.medium, agg.totalRows)} icon={<AlertTriangle size={18} />} color="amber" />
              <QualityCard label="Baixa" value={agg.low} pct={pct(agg.low, agg.totalRows)} icon={<XCircle size={18} />} color="red" />
            </div>

            {/* Precisão Google */}
            <SectionTitle title="Precisão Google Maps" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon={<MapPin size={20} />} label="ROOFTOP" value={agg.rooftop} color="emerald" sub={`${pct(agg.rooftop, agg.google + agg.rooftop + agg.interpolated)}%`} />
              <StatCard icon={<MapPin size={20} />} label="Interpolated" value={agg.interpolated} color="amber" sub={`${pct(agg.interpolated, agg.google + agg.rooftop + agg.interpolated)}%`} />
              <StatCard icon={<AlertTriangle size={20} />} label="Suspeita Distância" value={agg.suspect} color="amber" />
              <StatCard icon={<ShieldAlert size={20} />} label="Rejeitados (+2km)" value={agg.invalid} color="red" />
            </div>

            {/* Auditoria Shopee */}
            <SectionTitle title="Auditoria Shopee" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <StatCard icon={<Activity size={20} />} label="Auditadas" value={agg.auditChecked} color="blue" />
              <StatCard icon={<CheckCircle2 size={20} />} label="OK (≤0.2km)" value={agg.auditOk} color="emerald" sub={`${pct(agg.auditOk, agg.auditChecked)}%`} />
              <StatCard icon={<AlertTriangle size={20} />} label="Suspeitas (0.2-2km)" value={agg.auditSuspect} color="amber" sub={`${pct(agg.auditSuspect, agg.auditChecked)}%`} />
              <StatCard icon={<ShieldAlert size={20} />} label="Inválidas (+2km)" value={agg.auditInvalid} color="red" sub={`${pct(agg.auditInvalid, agg.auditChecked)}%`} />
              <StatCard icon={<XCircle size={20} />} label="Sem Referência" value={agg.auditNoRef} color="purple" />
            </div>

            {/* Últimos Processamentos */}
            <SectionTitle title="Últimos Processamentos" />
            <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--surface2)] text-[var(--text-muted)] text-xs uppercase">
                      <th className="px-4 py-3 text-left font-medium">Data</th>
                      <th className="px-4 py-3 text-left font-medium">Arquivo</th>
                      <th className="px-4 py-3 text-center font-medium">Linhas</th>
                      <th className="px-4 py-3 text-center font-medium">Shopee</th>
                      <th className="px-4 py-3 text-center font-medium">Google</th>
                      <th className="px-4 py-3 text-center font-medium">Alta</th>
                      <th className="px-4 py-3 text-center font-medium">Suspeito</th>
                      <th className="px-4 py-3 text-center font-medium">Rejeitado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.slice(0, 30).map((r) => {
                      const q = r.quality_summary
                      return (
                        <tr key={r.id} className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface2)] transition-colors">
                          <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                            {new Date(r.created_at).toLocaleDateString('pt-BR')}{' '}
                            <span className="text-xs opacity-60">{new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="px-4 py-3 text-[var(--text)] font-medium truncate max-w-[200px]">{r.file_name}</td>
                          <td className="px-4 py-3 text-center text-[var(--text)]">{q?.totalRows || '-'}</td>
                          <td className="px-4 py-3 text-center text-emerald-400 font-medium">{q?.shopeeCount || '-'}</td>
                          <td className="px-4 py-3 text-center text-amber-400 font-medium">{q?.googleCount || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            {q ? <span className="text-emerald-400 font-medium">{pct(q.highCount, q.totalRows)}%</span> : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {q?.suspectDistanceCount ? <span className="text-amber-400">{q.suspectDistanceCount}</span> : <span className="text-[var(--text-muted)]">0</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {q?.invalidDistanceCount ? <span className="text-red-400 font-bold">{q.invalidDistanceCount}</span> : <span className="text-[var(--text-muted)]">0</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        </div>
      </main>
    </div>
  )
}

/* ----- Sub-componentes ----- */

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-base font-syne font-bold text-[var(--text)] mb-3 flex items-center gap-2">
      <div className="w-1 h-4 rounded-full bg-emerald-500" />
      {title}
    </h2>
  )
}

function StatCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: number; color: string; sub?: string }) {
  const colorMap: Record<string, string> = {
    orange: 'text-[var(--orange)] bg-[rgba(240,58,23,0.08)]',
    blue: 'text-blue-400 bg-blue-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    red: 'text-red-400 bg-red-500/10',
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${colorMap[color] || ''}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-[var(--text)]">{value.toLocaleString('pt-BR')}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      {sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>}
    </div>
  )
}

function MetricBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--text)]">{label}</span>
        <span className="text-xs text-[var(--text-muted)]">{pct.toFixed(1)}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-[var(--surface2)] overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="text-lg font-bold text-[var(--text)] mt-2">{value.toLocaleString('pt-BR')}</p>
    </div>
  )
}

function QualityCard({ label, value, pct, icon, color }: { label: string; value: number; pct: string; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    amber: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
    red: 'text-red-400 border-red-500/20 bg-red-500/5',
  }

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || ''}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value.toLocaleString('pt-BR')}</p>
      <p className="text-xs opacity-70">{pct}% do total</p>
    </div>
  )
}
