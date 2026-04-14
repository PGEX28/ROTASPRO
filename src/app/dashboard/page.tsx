'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import {
  Upload, FileSpreadsheet, X, Zap, AlertTriangle,
  CheckCircle2, Download, RotateCcw, Clock, CreditCard, TrendingUp,
  MapPin, Navigation, LocateFixed, ShieldCheck, Search
} from 'lucide-react'
import Navbar from '@/components/ui/Navbar'
import InstallBanner from '@/components/ui/InstallBanner'
import { transformRows, type OutputRow, type ProcessedRowResult } from '@/lib/processor'

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return // O Middleware (proxy.ts) redireciona automaticamente pro login if !user
      setUserId(user.id)
      const [{ data: profile }, { data: hist }] = await Promise.all([
        supabase.from('profiles').select('credits').eq('id', user.id).single(),
        supabase.from('processing_history').select('id').eq('user_id', user.id),
      ])
      if (profile) setCredits(profile.credits)
      if (hist) setProcessedCount(hist.length)

      // Verificar se o usuário já comprou o Plano Básico no passado
      const { data: purchaseData } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'paid')
        .ilike('plan_name', '%Básico%')
        .limit(1)
      
      if (purchaseData && purchaseData.length > 0) {
        setIsBasicMember(true)
      }
    }
    load()
  }, [])

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
        await animateProgress(25, 65)
        
        const { out: transformed, unsequencedCount } = await transformRows(rows, (res) => {
          setProcessedRows(prev => [res, ...prev].slice(0, 10)) // Mostra os 10 mais recentes na tela de processamento
          setCurrentAddress(res.original.address)
          setStats(prev => ({
            total: prev.total + 1,
            rooftop: res.status === 'ROOFTOP' ? prev.rooftop + 1 : prev.rooftop,
            corrected: (res.changed.bairro || res.changed.zip || res.changed.coords) ? prev.corrected + 1 : prev.corrected,
            errors: res.status === 'ERROR' ? prev.errors + 1 : prev.errors
          }))
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

        // Upload processed file to Supabase Storage
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
          file_path: filePath
        })

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

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar credits={credits} />

      {/* Page body — centered horizontally AND vertically */}
      <main className="flex-1 flex items-start md:items-center justify-center px-4 py-6 md:py-10 w-full">
        <div className="w-full max-w-2xl flex flex-col gap-6">

          {/* Hero */}
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

          {/* Quick stats */}
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

          {/* CIRCUIT APP BANNER - DESATIVADO TEMPORARIAMENTE
          {isBasicMember && (
            <div className="animate-fade-up border border-[rgba(240,58,23,0.3)] bg-gradient-to-br from-[var(--surface)] to-[rgba(240,58,23,0.05)] rounded-2xl p-6 relative overflow-hidden group shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
              <div className="absolute top-4 left-4 z-20">
                <span className="text-[var(--orange)] text-[10px] font-bold uppercase tracking-widest bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">Acesso VIP</span>
              </div>
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap size={60} fill="var(--orange)" />
              </div>
              <div className="flex flex-col items-center gap-4 relative z-10 pt-6">
                <div className="w-14 h-14 bg-[var(--orange)] rounded-2xl flex items-center justify-center shadow-[0_5px_15px_rgba(240,58,23,0.3)] flex-shrink-0">
                  <Download className="text-white" size={28} />
                </div>
                <div className="flex-1 text-center">
                  <h3 className="font-syne font-extrabold text-white text-xl mb-2">App Circuit Modificado</h3>
                  <p className="text-[var(--text-muted)] text-xs leading-relaxed max-w-md mx-auto">
                    Tutorial: Este aplicativo é totalmente seguro e exclusivo para o Plano Básico. <strong className="text-orange-400">Importante:</strong> ele funciona apenas mediante autenticação por número de telefone.
                  </p>
                </div>
                <Link 
                  href="/circuitapp" 
                  className="bg-[var(--orange)] hover:bg-[var(--orange-light)] text-white px-8 py-3.5 rounded-xl font-syne font-bold text-sm transition-all shadow-lg hover:-translate-y-0.5 flex items-center gap-2 whitespace-nowrap w-full sm:w-auto justify-center"
                >
                  <Download size={16} /> Acessar App VIP
                </Link>
              </div>
            </div>
          )}
          */}

          {/* Main card */}
          <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden relative animate-slide-in" style={{ animationDelay: '0.1s' }}>
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--orange)] to-transparent" />
            <div className="p-6 md:p-10">

              {/* UPLOAD */}
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

              {/* PROCESSING */}
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
                </div>
              )}

              {/* SUCCESS */}
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

                  {/* STATS GRID RESTORED */}
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
                  <button onClick={resetApp} className="w-full flex items-center justify-center gap-2 bg-[var(--surface2)] border border-[var(--border-subtle)] text-[var(--text-muted)] rounded-xl py-3.5 text-sm font-semibold hover:text-[var(--text)] transition-all">
                    <RotateCcw size={14} /> Processar nova planilha
                  </button>
                  <Link href="/history" className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--orange)] transition-colors mx-auto">
                    <Clock size={12} /> Ver histórico completo
                  </Link>
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
