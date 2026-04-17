'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import {
  Upload, FileSpreadsheet, X, Zap, AlertTriangle,
  CheckCircle2, Download, RotateCcw, Clock, CreditCard, TrendingUp,
  MapPin, Navigation, LocateFixed, ShieldCheck, Search, Activity, Settings2, BrainCircuit
} from 'lucide-react'
import Navbar from '@/components/ui/Navbar'
import InstallBanner from '@/components/ui/InstallBanner'
import { transformRows, type OutputRow, type ProcessedRowResult, type QualityStats } from '@/lib/processor'

type Screen = 'upload' | 'processing' | 'success'
type StepState = 'idle' | 'active' | 'done'

export default function DashboardPage() {
  const [credits, setCredits] = useState<number>(0)
  const [processedCount, setProcessedCount] = useState<number>(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [steps, setSteps] = useState<StepState[]>(['idle', 'idle', 'idle'])
  const [result, setResult] = useState<{ paradas: number; pacotes: number; semOrdem: number } | null>(null)
  const [processedWB, setProcessedWB] = useState<unknown>(null)
  const [isBasicMember, setIsBasicMember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [processedRows, setProcessedRows] = useState<ProcessedRowResult[]>([])
  const [currentAddress, setCurrentAddress] = useState<string>('')
  const [stats, setStats] = useState({ total: 0, rooftop: 0, corrected: 0, errors: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const loadData = useCallback(async (retries = 3) => {
    try {
      setIsLoading(true)
      setError(null)
      
      // 1. Otimização 4G: Validação via sessão local (instantânea)
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user

      if (!user) {
        router.push('/login')
        return
      }

      setUserId(user.id)
      
      // 2. Carregamento Sequencial (Créditos primeiro - Vital)
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('credits, is_basic')
        .eq('id', user.id)
        .single()

      if (profileErr && retries > 0) throw profileErr

      if (profile) {
        setCredits(profile.credits || 0)
        setIsBasicMember(!!profile.is_basic)
      }
      
      // Libera o loading principal assim que os créditos carregam
      setIsLoading(false)

      // 3. Carregamento Progressivo (Histórico em background)
      supabase.from('processing_history')
        .select('id')
        .eq('user_id', user.id)
        .then(({ data: hist }) => {
          if (hist) setProcessedCount(hist.length)
        })

    } catch (err: any) {
      console.error(`Tentativa de carregamento falhou no 4G:`, err)
      if (retries > 0) {
        setTimeout(() => loadData(retries - 1), 1000)
      } else {
        setError("Instabilidade na rede móvel detectada. Tente recarregar.")
        setIsLoading(false)
      }
    }
  }, [supabase, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleFile = useCallback((f: File) => {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) { setError('Formato inválido. Use .xlsx, .xls ou .csv'); return }
    setFile(f); setError(null)
  }, [])

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function fmtSize(b: number) {
    if (b < 1024) return b + ' B'
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
    return (b / 1048576).toFixed(1) + ' MB'
  }

  function animateProgress(from: number, to: number, duration = 700): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now()
      function frame(now: number) {
        const p = Math.min((now - start) / duration, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        setProgress(Math.round(from + (to - from) * ease))
        if (p < 1) requestAnimationFrame(frame); else resolve()
      }
      requestAnimationFrame(frame)
    })
  }

  function setStep(i: number, state: StepState) {
    setSteps((s) => s.map((v, idx) => idx === i ? state : v))
  }

  async function startProcessing() {
    if (!file || !userId) return
    if (credits < 1) { setError('Créditos insuficientes. Adquira mais créditos para continuar.'); return }
    setError(null); setScreen('processing'); setProgress(0); setSteps(['active', 'idle', 'idle'])
    setStats({ total: 0, rooftop: 0, corrected: 0, errors: 0 })
    setProcessedRows([])
    setCurrentAddress('')

    const XLSX = await import('xlsx')
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        await animateProgress(0, 25)
        const wb = XLSX.read(e.target!.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[]

        setStep(0, 'done'); setStep(1, 'active')
        
        const { out: transformed, unsequencedCount, qualityStats } = await transformRows(rows, (res) => {
          // Progress mapping: 25-65%
          // res is ProcessedRowResult (individual row), passed from inside loop
          setProcessedRows(prev => [res, ...prev].slice(0, 10))
          setCurrentAddress(res.original.address)
          setStats(prev => ({
            total: prev.total + 1,
            rooftop: res.status === 'ROOFTOP' ? prev.rooftop + 1 : prev.rooftop,
            corrected: (res.changed.bairro || res.changed.zip || res.changed.coords) ? prev.corrected + 1 : prev.corrected,
            errors: res.status === 'ERROR' ? prev.errors + 1 : prev.errors
          }))
          // Optional: handle overall progress if transformRows provides it
        })

        setStep(1, 'done'); setStep(2, 'active')

        await animateProgress(65, 100)

        const wbOut = XLSX.utils.book_new()
        const wsOut = XLSX.utils.json_to_sheet(transformed, {
          header: ['AT ID', 'Destination Address', 'Bairro', 'City', 'Zipcode/Postal code', 'Latitude', 'Longitude', 'Address Line 2', 'Pacotes na Parada'],
        })
        XLSX.utils.book_append_sheet(wbOut, wsOut, 'Planilha Processada')
        setProcessedWB(wbOut)

        const totalPacotes = transformed.reduce((acc: number, r: OutputRow) => acc + String(r['Pacotes na Parada']).split(',').length, 0)

        const { error: creditErr } = await supabase.rpc('deduct_credit', { user_id_input: userId })
        if (!creditErr) { setCredits((c) => c - 1); setProcessedCount((c) => c + 1) }

        const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
        const fileNameToSave = `Rota Corrigida - ${date}`

        const XLSX_WRITE = await import('xlsx')
        const xlsxBuffer = XLSX_WRITE.write(wbOut, { bookType: 'xlsx', type: 'array' })
        const blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const filePath = `${userId}/${Date.now()}-${fileNameToSave}.xlsx`
        await supabase.storage.from('processed-files').upload(filePath, blob, { contentType: blob.type })

        await supabase.from('processing_history').insert({ 
          user_id: userId, 
          file_name: fileNameToSave, 
          packages_processed: totalPacotes, 
          stops_count: transformed.length,
          manual_additions_count: unsequencedCount,
          credits_used: 1,
          file_path: filePath,
          quality_summary: qualityStats
        })

        // Audit & Suggestions
        try {
          const auditIssues = transformed
            .filter((r: any) => r._shopee_audit_checked && r._shopee_audit_ok === false && r._shopee_audit_match_reason)
            .map((r: any) => ({
              raw_address: r['Destination Address'] || '',
              city: r['City'] || '',
              match_reason: r._shopee_audit_match_reason,
              distance_km: r._shopee_audit_distance_km || 0,
              google_lat: r._shopee_audit_google_lat,
              google_lng: r._shopee_audit_google_lng,
              shopee_lat: Number(r['Latitude']) || 0,
              shopee_lng: Number(r['Longitude']) || 0
            }));

          if (auditIssues.length > 0) {
            fetch('/api/audit/suggestions', {
              method: 'POST',
              body: JSON.stringify({ issues: auditIssues }),
              headers: { 'Content-Type': 'application/json' }
            }).catch(e => console.error("Falha ao enviar sugestoes", e));
          }
        } catch (suggErr) {
          console.error("Falha silenciosa ao processar sugestoes:", suggErr);
        }

        // Usage Tracking
        try {
          const uniqueUsageLogs = Array.from(
             transformed
               .filter((r: any) => r._persistent_hit && r._persistent_id)
               .reduce((acc: Map<string, string>, r: any) => {
                  const risk = r._persistent_risk || 'OK';
                  const exist = acc.get(r._persistent_id);
                  if (!exist || risk === 'INVALID' || (risk === 'SUSPECT' && exist !== 'INVALID')) {
                     acc.set(r._persistent_id, risk);
                  }
                  return acc;
               }, new Map<string, string>())
               .entries()
           ).map(([id, risk]) => ({ id, risk }));

          if (uniqueUsageLogs.length > 0) {
            fetch('/api/corrections/usage', {
              method: 'POST',
              body: JSON.stringify({ metrics: uniqueUsageLogs }),
              headers: { 'Content-Type': 'application/json' }
            }).catch(e => console.error("Falha ao registrar uso de correcao", e));
          }
        } catch (usageErr) {
          console.error("Falha silenciosa ao registrar uso:", usageErr);
        }

        setStep(2, 'done')
        setTimeout(() => { setResult({ paradas: transformed.length, pacotes: totalPacotes, semOrdem: unsequencedCount }); setScreen('success') }, 500)
      } catch (err: unknown) {
        setError('Erro ao processar: ' + (err instanceof Error ? err.message : 'Erro desconhecido'))
        setScreen('upload')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function downloadFile() {
    if (!processedWB || !file) return
    const XLSX = await import('xlsx')
    const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
    const fileName = `Rota Corrigida - ${date}.xlsx`
    XLSX.writeFile(processedWB as Parameters<typeof XLSX.writeFile>[0], fileName)
  }

  function resetApp() {
    setScreen('upload'); setFile(null); setProgress(0); setSteps(['idle', 'idle', 'idle'])
    setResult(null); setProcessedWB(null); setError(null)
    setStats({ total: 0, rooftop: 0, corrected: 0, errors: 0 })
    setProcessedRows([])
    setCurrentAddress('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const stepLabels = ['Lendo arquivo e validando dados', 'Calculando distâncias e otimizando rotas', 'Gerando planilha de saída']

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-bg">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-[3px] border-[rgba(240,58,23,0.1)] border-t-[var(--orange)] animate-spin" />
          <Zap size={20} className="absolute inset-0 m-auto text-[var(--orange)]" fill="currentColor" />
        </div>
        <p className="text-sm font-syne font-bold text-[var(--text-muted)] uppercase tracking-widest animate-pulse">Iniciando seção segura...</p>
      </div>
    )
  }

  if (error && !userId) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-6 bg-bg text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <AlertTriangle size={32} className="text-red-400" />
        </div>
        <h2 className="font-syne font-extrabold text-2xl mb-2">Erro de Conectividade</h2>
        <p className="text-[var(--text-muted)] text-sm mb-8 max-w-xs">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-[var(--surface2)] text-[var(--text)] border border-[var(--border)] rounded-xl px-8 py-3 font-bold hover:bg-[var(--surface)] transition-all flex items-center gap-2"
        >
          <RotateCcw size={16} /> Tentar Novamente
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar credits={credits} />

      <main className="flex-1 flex items-start md:items-center justify-center px-4 py-6 md:py-10 w-full">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          <div className="text-center animate-fade-up">
            <div className="inline-flex items-center gap-2 bg-[rgba(240,58,23,0.1)] border border-[rgba(240,58,23,0.25)] rounded-full px-4 py-1.5 text-[11px] font-semibold text-[var(--orange-light)] uppercase tracking-widest mb-4">
              <Zap size={11} fill="currentColor" /> Processador de Planilhas
            </div>
            <h1 className="font-syne font-extrabold text-2xl md:text-3xl lg:text-4xl text-[var(--text)] tracking-tight leading-tight mb-3">
              Processe suas <span className="text-[var(--orange)]">rotas</span><br className="hidden md:block" /> com precisão
            </h1>
            <p className="text-[var(--text-muted)] text-xs md:text-sm leading-relaxed max-w-sm mx-auto">
              Envie sua planilha Shopee e receba as rotas organizadas em segundos.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 animate-slide-in" style={{ animationDelay: '0.05s' }}>
            {[
              { icon: Zap,         label: 'Créditos',    value: credits,        color: 'text-[var(--orange)]', bg: 'bg-[rgba(240,58,23,0.1)]',  href: '/pricing' },
              { icon: TrendingUp,  label: 'Processadas', value: processedCount, color: 'text-[var(--green)]',  bg: 'bg-[rgba(34,197,94,0.1)]',  href: '/history' },
              { icon: FileSpreadsheet,  label: 'Histórico',   value: 'Ver',          color: 'text-blue-400',        bg: 'bg-[rgba(96,165,250,0.1)]', href: '/history' },
            ].map(({ icon: Icon, label, value, color, bg, href }) => (
              <Link key={label} href={href} className="rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] p-3 md:p-4 flex flex-col items-center gap-1 hover:border-[rgba(240,58,23,0.3)] transition-all text-center">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon size={14} className={color} />
                </div>
                <div className={`font-syne font-bold text-lg md:text-xl leading-none ${color}`}>{value}</div>
                <div className="text-[9px] md:text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{label}</div>
              </Link>
            ))}
          </div>

          <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden relative animate-slide-in" style={{ animationDelay: '0.1s' }}>
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--orange)] to-transparent" />
            <div className="p-6 md:p-10">

              {screen === 'upload' && (
                <div className="flex flex-col gap-6">
                  <div className="text-center">
                    <h2 className="font-syne font-extrabold text-xl md:text-2xl text-[var(--text)] mb-2">Enviar planilha</h2>
                    <p className="text-[var(--text-muted)] text-sm md:text-base">Selecione ou arraste sua planilha de rotas</p>
                  </div>

                  {!file ? (
                    <div
                      onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-[rgba(240,58,23,0.3)] rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer hover:border-[var(--orange)] hover:bg-[rgba(240,58,23,0.03)] transition-all text-center group"
                    >
                      <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-[rgba(240,58,23,0.1)] border border-[rgba(240,58,23,0.2)] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload size={24} className="text-[var(--orange)]" />
                      </div>
                      <div>
                        <p className="font-syne font-bold text-[var(--text)] mb-1">Selecionar planilha</p>
                        <p className="text-[var(--text-muted)] text-xs">.xlsx · .xls · .csv — Arraste ou clique aqui</p>
                      </div>
                      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 bg-[rgba(240,58,23,0.07)] border border-[rgba(240,58,23,0.25)] rounded-2xl px-5 py-4">
                      <div className="w-12 h-12 rounded-xl bg-[rgba(240,58,23,0.15)] flex items-center justify-center flex-shrink-0">
                        <FileSpreadsheet size={24} className="text-[var(--orange)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)] truncate">{file.name}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{fmtSize(file.size)}</p>
                      </div>
                      <button onClick={resetApp} className="text-[var(--text-muted)] hover:text-red-400 p-2 rounded-xl hover:bg-[var(--surface2)] transition-all">
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {credits === 0 && (
                    <Link href="/pricing" className="flex items-center gap-3 bg-[rgba(240,58,23,0.08)] border border-[rgba(240,58,23,0.3)] rounded-xl px-4 py-3.5 hover:bg-[rgba(240,58,23,0.12)] transition-all">
                      <AlertTriangle size={18} className="text-[var(--orange)] flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-[var(--orange)]">Sem créditos disponíveis</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">Clique aqui para adquirir créditos</p>
                      </div>
                    </Link>
                  )}

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center gap-2">
                       <AlertTriangle size={15} className="flex-shrink-0" /> {error}
                    </div>
                  )}

                  <button
                    onClick={startProcessing}
                    disabled={!file || credits === 0}
                    className="w-full bg-[var(--orange)] text-white rounded-xl py-4 md:py-5 font-syne font-extrabold text-base md:text-lg flex items-center justify-center gap-2.5 shadow-[0_4px_24px_rgba(240,58,23,0.4)] hover:bg-[var(--orange-light)] active:scale-[0.98] transition-all disabled:bg-[var(--surface2)] disabled:text-[var(--text-dim)] disabled:border disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    <Zap size={18} fill="currentColor" />
                    <span className="tracking-wide">Processar Planilha</span>
                    <span className="text-[10px] font-bold tracking-wider opacity-80 bg-black/20 px-2 py-0.5 rounded-full uppercase ml-1">1 crédito</span>
                  </button>

                  <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
                    {['⚡ Rápido', '📱 Mobile', '🔒 Privado', '📊 Excel'].map((f) => (
                      <span key={f} className="text-[11px] text-[var(--text-muted)]">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {screen === 'processing' && (
                <div className="flex flex-col gap-8 animate-fade-in">
                  <div className="flex flex-col items-center gap-6 py-6 border-b border-[rgba(255,255,255,0.05)]">
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 rounded-full border-[3px] border-[rgba(240,58,23,0.12)] border-t-[var(--orange)]" style={{ animation: 'spin 0.85s linear infinite' }} />
                      <div className="absolute inset-3 rounded-full border-2 border-[rgba(240,58,23,0.08)] border-b-[var(--orange-light)]" style={{ animation: 'spin 0.55s linear infinite reverse' }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Zap size={18} className="text-[var(--orange)]" fill="currentColor" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="font-syne font-bold text-xl text-[var(--text)]">Processando planilha...</p>
                      <p className="text-[var(--text-muted)] text-sm mt-1">Aguarde enquanto otimizamos suas rotas</p>
                    </div>
                  </div>
                  <div className="w-full">
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-[10px] font-mono text-[var(--text-muted)] truncate max-w-[80%] uppercase tracking-wider">
                        Progresso
                      </span>
                      <span className="text-xs font-bold text-[var(--orange)]">{progress}%</span>
                    </div>
                    <div className="h-2 bg-[var(--surface2)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full shadow-[0_0_10px_var(--orange-glow)]" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,var(--orange-dark),var(--orange-light))', transition: 'width 0.1s ease' }} />
                    </div>
                  </div>
                  
                  <div className="w-full flex flex-col gap-3 pb-[10px]">
                    {stepLabels.map((label, i) => (
                      <div key={i} className={`flex items-center gap-3 text-sm transition-colors duration-300 ${steps[i] === 'done' ? 'text-[var(--green)]' : steps[i] === 'active' ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'}`}>
                        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${steps[i] === 'done' ? 'border-[var(--green)] bg-[rgba(34,197,94,0.12)]' : steps[i] === 'active' ? 'border-[var(--orange)] bg-[rgba(240,58,23,0.15)]' : 'border-[rgba(255,255,255,0.08)]'}`} style={steps[i] === 'active' ? { animation: 'pulse-dot 1s infinite' } : {}}>
                          {steps[i] === 'done' ? '✓' : i + 1}
                        </div>
                        {label}
                      </div>
                    ))}
                  </div>

                      {/* Real-time processing log */}
                      <div className="bg-[var(--surface2)] rounded-xl border border-[var(--border-subtle)] p-4 overflow-hidden animate-fade-up">
                         <div className="flex justify-between items-center">
                           <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Processamento em Tempo Real</span>
                           <div className="flex gap-4">
                             <div className="flex items-center gap-1.5">
                               <div className="w-1.5 h-1.5 rounded-full bg-[var(--orange)]" />
                               <span className="text-[10px] font-bold text-[var(--text)]">{stats.total} total</span>
                             </div>
                             <div className="flex items-center gap-1.5">
                               <div className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                               <span className="text-[10px] font-bold text-[var(--text)]">{stats.rooftop} precisão</span>
                             </div>
                           </div>
                         </div>
                      </div>
                </div>
              )}

              {screen === 'success' && result && (
                <div className="flex flex-col gap-8 animate-fade-up">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-20 h-20 rounded-full border-[3px] border-[var(--green)] flex items-center justify-center shadow-[0_0_32px_var(--green-glow)] animate-pop-in">
                      <CheckCircle2 size={42} className="text-[var(--green)]" />
                    </div>
                    <div>
                      <h2 className="font-syne font-extrabold text-2xl text-[var(--text)] mb-1.5">Processamento Concluído!</h2>
                      <p className="text-[var(--text-muted)] text-sm">Sua planilha foi otimizada com sucesso.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 py-2">
                    <div className="flex flex-col items-center justify-center p-4 bg-[var(--surface2)] border border-[var(--border-subtle)] rounded-2xl animate-fade-up" style={{ animationDelay: '0.1s' }}>
                      <span className="text-3xl font-syne font-extrabold text-[var(--orange)] mb-1">{result.paradas}</span>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Paradas</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-[var(--surface2)] border border-[var(--border-subtle)] rounded-2xl animate-fade-up" style={{ animationDelay: '0.2s' }}>
                      <span className="text-3xl font-syne font-extrabold text-[var(--orange)] mb-1">{result.pacotes}</span>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Pacotes</span>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-[var(--surface2)] border border-[var(--border-subtle)] rounded-2xl animate-fade-up" style={{ animationDelay: '0.3s' }}>
                      <span className="text-3xl font-syne font-extrabold text-[var(--orange)] mb-1">{result.semOrdem}</span>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)]">Sem Ordem</span>
                    </div>
                  </div>

                  <button onClick={downloadFile} className="w-full flex items-center justify-center gap-2.5 bg-[var(--green)] text-white rounded-xl py-6 md:py-8 font-syne font-bold text-base shadow-[0_4px_24px_rgba(34,197,94,0.35)] hover:brightness-110 active:scale-[0.98] transition-all">
                    <Download size={20} /> Baixar Planilha Processada
                  </button>
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                    <span className="text-xs text-[var(--text-muted)]">ou</span>
                    <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                  </div>
                  <button onClick={resetApp} className="w-full flex items-center justify-center gap-2 bg-[var(--surface2)] border border(--border-subtle)] text-[var(--text-muted)] rounded-xl py-3.5 text-sm font-semibold hover:text-[var(--text)] transition-all">
                    <RotateCcw size={14} /> Processar nova planilha
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      <InstallBanner />
    </div>
  )
}
