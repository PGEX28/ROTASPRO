'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Navbar from '@/components/ui/Navbar'
import { Link2, Activity, Play, Pause, Database, MapPin, Settings2, Zap, BrainCircuit, AlertTriangle, Clock } from 'lucide-react'

type Correction = {
  id: string
  normalized_address: string
  corrected_lat: number
  corrected_lng: number
  confidence: number
  usage_count: number
  last_used_at: string
  is_active: boolean
  auto_approved: boolean
  auto_disabled: boolean
  auto_disabled_reason?: string
  created_at: string
}

export default function CorrectionsMonitorPage() {
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profile?.is_admin) {
        return router.push('/dashboard')
      }
      fetchData()
    }
    load()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('address_corrections')
      .select('*')
      .order('usage_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)

    try {
      const sReq = await fetch('/api/admin/settings')
      if (sReq.ok) {
         setSettings(await sReq.json())
      }
    } catch(e) {}

    if (data) setCorrections(data as Correction[])
    setLoading(false)
  }

  async function toggleAutoLearning() {
    if (!settings) return
    setSavingSettings(true)
    const nextState = !settings.auto_learning_enabled
    try {
       const res = await fetch('/api/admin/settings', {
         method: 'POST', body: JSON.stringify({ auto_learning_enabled: nextState })
       })
       if(res.ok) setSettings({ ...settings, auto_learning_enabled: nextState })
    } finally {
       setSavingSettings(false)
    }
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    setToggling(id)
    try {
      const is_active = !currentStatus
      const res = await fetch('/api/admin/corrections/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active })
      })
      if (res.ok) {
         setCorrections(prev => prev.map(c => c.id === id ? { ...c, is_active } : c))
      } else {
         alert('Falha ao atualizar o status')
      }
    } catch(e) {
      console.error(e)
    } finally {
      setToggling(null)
    }
  }

  function decodeAddress(base64Hash: string) {
    try {
      return decodeURIComponent(escape(atob(base64Hash)))
    } catch {
      return base64Hash
    }
  }

  // Dashboard Stats
  const totalActive = corrections.filter(c => c.is_active).length
  const totalUsages = corrections.reduce((acc, c) => acc + (c.usage_count || 0), 0)

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] items-center">
      <Navbar />

      <main className="w-full max-w-6xl px-6 py-10 flex flex-col gap-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--border-subtle)] pb-6">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                <Database size={28} />
             </div>
             <div>
               <h1 className="text-2xl font-syne font-bold text-[var(--text)]">Monitor de <span className="text-blue-400">Correções Persistentes</span></h1>
               <p className="text-sm text-[var(--text-muted)]">Catálogo de consertos de geolocalização e telemetria de hits no ambiente real</p>
             </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[var(--text-muted)] flex flex-col items-center">
            <Activity size={32} className="mb-4 animate-spin text-blue-400" />
            <p>Carregando monitor...</p>
          </div>
        ) : (
          <>
            {/* Auto Learning Settings Panel */}
            {settings && (
               <div className="bg-gradient-to-r from-[rgba(168,85,247,0.05)] to-[rgba(59,130,246,0.05)] border border-purple-500/20 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 mb-2 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                 <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                      <BrainCircuit size={24} />
                    </div>
                    <div>
                      <h2 className="font-syne font-bold text-[var(--text)] text-lg flex items-center gap-2">
                        Inteligência Auto-Learning 
                        {settings.auto_learning_enabled ? 
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1"><Zap size={10}/> ON</span> :
                          <span className="px-2 py-0.5 rounded-full bg-[var(--surface2)] text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">OFF</span>}
                      </h2>
                      <div className="text-xs text-[var(--text-muted)] mt-2 max-w-lg space-y-1">
                        <p>Quando ligada, sugestões são promovidas automaticamente quando:</p>
                        <ul className="ml-2 font-mono text-[11px] text-[var(--text-muted)] font-bold space-y-0.5 mt-1 mb-1">
                          <li>• Precisão ≥ {settings.min_confidence}%</li>
                          <li>• Ocorrências ≥ {settings.min_occurrences}</li>
                          <li>• Erro máximo ≤ {settings.max_avg_distance_km}km</li>
                        </ul>
                        <p className="pt-2 text-[10px] opacity-75 italic font-normal">(O sistema utiliza critérios mais rigorosos para garantir alta precisão nas correções automáticas)</p>
                      </div>
                    </div>
                 </div>
                 <div className="flex gap-3">
                    <button onClick={toggleAutoLearning} disabled={savingSettings} className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 ${settings.auto_learning_enabled ? 'bg-[var(--surface2)] text-[var(--text)] hover:text-red-400' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'}`}>
                       {savingSettings ? <Activity size={14} className="animate-spin" /> : <Settings2 size={14} />}
                       {settings.auto_learning_enabled ? 'DESLIGAR ROBÔ' : 'ATIVAR ROBÔ'}
                    </button>
                 </div>
               </div>
            )}

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
               <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border-subtle)] flex flex-col gap-1">
                 <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold">Total Aprovadas</p>
                 <p className="text-2xl font-bold font-syne text-[var(--text)]">{corrections.length}</p>
               </div>
               <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border-subtle)] flex flex-col gap-1">
                 <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold">Correções Ativas</p>
                 <p className="text-2xl font-bold font-syne text-emerald-400">{totalActive}</p>
               </div>
               <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border-subtle)] flex flex-col gap-1">
                 <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold">Desativadas (Mudo)</p>
                 <p className="text-2xl font-bold font-syne text-red-400">{corrections.length - totalActive}</p>
               </div>
               <div className="bg-[var(--surface)] p-4 rounded-xl border border-[var(--border-subtle)] flex flex-col gap-1">
                 <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-bold shadow-blue-500">Hits Utilizados (Sessões)</p>
                 <p className="text-2xl font-bold font-syne text-blue-400">{totalUsages}</p>
               </div>
            </div>

            {/* List / Table */}
            <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-sm">
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="bg-[var(--surface2)] text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
                       <th className="p-4 font-bold border-b border-[var(--border-subtle)]">Endereço Original Hash</th>
                       <th className="p-4 font-bold border-b border-[var(--border-subtle)]">Confiança</th>
                       <th className="p-4 font-bold border-b border-[var(--border-subtle)]">Hits</th>
                       <th className="p-4 font-bold border-b border-[var(--border-subtle)]">Histórico</th>
                       <th className="p-4 font-bold border-b border-[var(--border-subtle)]">Status</th>
                       <th className="p-4 font-bold border-b border-[var(--border-subtle)]">Ação</th>
                     </tr>
                   </thead>
                   <tbody className="text-sm divide-y divide-[var(--border-subtle)]">
                     {corrections.map(c => (
                       <tr key={c.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                         <td className="p-4 uppercase font-bold text-[var(--text)] tracking-wider">
                           {decodeAddress(c.normalized_address).replace(/_/g, ' — ')}
                           <div className="text-[10px] text-[var(--text-muted)] mt-1 font-mono normal-case tracking-normal py-0.5 flex items-center gap-1">
                              <MapPin size={10} /> {c.corrected_lat.toFixed(5)}, {c.corrected_lng.toFixed(5)}
                           </div>
                         </td>
                         <td className="p-4">
                           <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.confidence > 90 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                              {c.confidence}%
                           </span>
                         </td>
                         <td className="p-4 font-mono font-bold text-[var(--text)]">
                            {c.usage_count || 0}
                         </td>
                         <td className="p-4 text-[10px] text-[var(--text-muted)] uppercase">
                            <div className="flex flex-col gap-1">
                               <span className="flex items-center gap-1"><Clock size={10} /> {c.last_used_at ? new Date(c.last_used_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}</span>
                               {c.auto_approved ? (
                                  <span className="text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded w-max flex items-center gap-1">
                                    <BrainCircuit size={10} /> AUTO LEARNED
                                  </span>
                               ) : (
                                  <span className="text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded w-max flex items-center gap-1">
                                     MANUAL
                                  </span>
                               )}
                            </div>
                         </td>
                         <td className="p-4">
                           {c.is_active ? 
                              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold tracking-widest"><Play size={10}/> ATIVO</span> :
                              <div className="flex flex-col gap-1">
                                <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold tracking-widest"><Pause size={10}/> PAUSADO</span>
                                {c.auto_disabled && <span className="text-[9px] text-red-400/80 flex items-center gap-1"><AlertTriangle size={8}/> DESTROYED (IA)</span>}
                              </div>
                           }
                         </td>
                         <td className="p-4">
                            <button
                               onClick={() => toggleStatus(c.id, c.is_active)}
                               disabled={toggling === c.id}
                               className={`px-3 py-1.5 text-[11px] font-bold tracking-widest rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition-all ${
                                  c.is_active 
                                    ? 'bg-[var(--surface2)] text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10' 
                                    : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                               }`}
                            >
                               {toggling === c.id ? <Activity size={12} className="animate-spin" /> : <Link2 size={12} />}
                               {c.is_active ? 'DESATIVAR' : 'REATIVAR'}
                            </button>
                         </td>
                       </tr>
                     ))}
                     {corrections.length === 0 && (
                       <tr>
                         <td colSpan={6} className="text-center py-10 text-[var(--text-muted)] bg-[var(--surface2)]/50">
                           O sistema não possui correções aprovadas.
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
