'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Navbar from '@/components/ui/Navbar'
import { ShieldAlert, CheckCircle2, AlertTriangle, XCircle, MapPin, Search } from 'lucide-react'

type Suggestion = {
  id: string
  normalized_address: string
  occurrences: number
  street_match_count: number
  number_mismatch_count: number
  avg_distance_km: number
  last_google_lat: number
  last_google_lng: number
  last_shopee_lat: number
  last_shopee_lng: number
  confidence_score: number
  status: string
  created_at: string
}

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [actingOn, setActingOn] = useState<string | null>(null)
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

      fetchSuggestions()
    }
    load()
  }, [])

  async function fetchSuggestions() {
    setLoading(true)
    const { data } = await supabase
      .from('address_suggestions')
      .select('*')
      .eq('status', 'PENDING')
      .order('confidence_score', { ascending: false })
      .limit(50)

    if (data) setSuggestions(data as Suggestion[])
    setLoading(false)
  }

  async function handleAction(id: string, action: 'APPROVE' | 'REJECT') {
    setActingOn(id)
    try {
      const res = await fetch('/api/admin/suggestions/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
      })
      if (res.ok) {
        setSuggestions(prev => prev.filter(s => s.id !== id))
      } else {
        alert('Erro ao processar ação.')
      }
    } catch(e) {
      console.error(e)
    } finally {
      setActingOn(null)
    }
  }

  function decodeAddress(base64Hash: string) {
    try {
      return decodeURIComponent(escape(atob(base64Hash)))
    } catch {
      return base64Hash // fallback
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] items-center">
      <Navbar /> {/* Navbar can handle default or we hide credits if admin */}
      <main className="w-full max-w-5xl px-6 py-10 flex flex-col items-center">
        <div className="w-full">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-syne font-bold text-[var(--text)]">
                Sugestões <span className="text-orange-400">Inteligentes</span>
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                Avalie correções coletadas automaticamente pelo motor de roteirização
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 text-[var(--text-muted)] flex flex-col items-center">
              <Search size={32} className="mb-4 animate-pulse" />
              <p>Buscando padrões de endereço...</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-20 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-xl">
              <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-400" />
              <h2 className="text-xl font-bold text-[var(--text)] mb-2">Tudo atualizado!</h2>
              <p className="text-[var(--text-muted)]">Não há sugestões PENDENTES para avaliar no momento.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {suggestions.map((sugg) => (
                <div key={sugg.id} className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden group">
                  
                  {/* Status Strip */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${sugg.confidence_score > 70 ? 'bg-emerald-500' : sugg.confidence_score > 40 ? 'bg-amber-500' : 'bg-red-500'}`}></div>

                  <div className="flex-1 flex flex-col gap-3 ml-2">
                    {/* Header: Score e Occurrences */}
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                      <span className={`px-2 py-1 rounded-md uppercase tracking-wider shadow-sm ${sugg.confidence_score > 70 ? 'bg-emerald-500/10 text-emerald-400' : sugg.confidence_score > 40 ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                        Confiança: {sugg.confidence_score.toFixed(0)}/100
                      </span>
                      <span className="text-[var(--text-muted)] bg-[var(--surface2)] px-2 py-1 rounded-md">
                        Falhas detectadas: {sugg.occurrences}
                      </span>
                      <span className="text-[var(--text-muted)] bg-[var(--surface2)] px-2 py-1 rounded-md flex items-center gap-1">
                        <MapPin size={12} /> Desvio Média: {sugg.avg_distance_km}km
                      </span>
                    </div>

                    {/* Endereço */}
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] mb-1">Endereço Original Planilha</p>
                      <h3 className="text-lg font-bold text-[var(--text)] uppercase">
                        {decodeAddress(sugg.normalized_address).replace(/_/g, ' — ')}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-1 bg-[var(--bg)] p-3 rounded-lg border border-[var(--border-subtle)]">
                      <div>
                        <p className="text-xs text-[var(--text-muted)] mb-1 font-semibold flex items-center gap-1">
                          <AlertTriangle size={12} className="text-amber-400"/> Erro Planilha
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                          {sugg.last_shopee_lat.toFixed(6)}, {sugg.last_shopee_lng.toFixed(6)}
                        </p>
                      </div>
                      <div>
                         <p className="text-xs text-[var(--text-muted)] mb-1 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-emerald-400"/> Proposta Google API
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                          {sugg.last_google_lat.toFixed(6)}, {sugg.last_google_lng.toFixed(6)}
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col gap-2 shrink-0 sm:min-w-[140px]">
                    <button 
                      onClick={() => handleAction(sugg.id, 'APPROVE')}
                      disabled={actingOn !== null}
                      className="flex-1 sm:w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={16} /> {actingOn === sugg.id ? '...' : 'Aprovar'}
                    </button>
                    <button 
                      onClick={() => handleAction(sugg.id, 'REJECT')}
                      disabled={actingOn !== null}
                      className="flex-1 sm:w-full bg-[var(--surface2)] hover:bg-red-500/20 hover:text-red-400 border border-[var(--border)] disabled:opacity-50 text-[var(--text-muted)] font-bold py-2.5 px-4 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <XCircle size={16} /> Rejeitar
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
