'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { ArrowLeft, ShieldCheck, QrCode, CreditCard, Copy, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import Navbar from '@/components/ui/Navbar'

// Carregar a Public Key do Stripe (seguro para build)
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder')

export default function CheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const planId = params.planId as string

  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | null>(null)
  
  // Stripe state
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  
  // Pix state
  const [pixData, setPixData] = useState<{ qrCodeBase64: string, qrCode: string, orderId: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [pixPaid, setPixPaid] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Iniciar pagamento via Cartão de Crédito
  const handleStartCard = async () => {
    setLoading(true)
    setError(null)
    setPaymentMethod('card')
    
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: planId }),
      })
      const data = await response.json()

      if (data.clientSecret) {
        setClientSecret(data.clientSecret)
      } else {
        setError(data.error || 'Erro ao preparar o pagamento.')
      }
    } catch (err) {
      setError('Erro de conexão segura com a Stripe.')
    } finally {
      setLoading(false)
    }
  }

  // Iniciar pagamento via PIX
  const handleStartPix = async () => {
    setLoading(true)
    setError(null)
    setPaymentMethod('pix')
    
    try {
      const response = await fetch('/api/checkout/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: planId }),
      })
      const data = await response.json()

      if (data.qrCodeBase64 && data.orderId) {
        setPixData(data)
      } else {
        setError(data.error || 'Erro ao gerar o PIX.')
      }
    } catch (err) {
      setError('Erro de conexão com o Mercado Pago.')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (pixData?.qrCode) {
      navigator.clipboard.writeText(pixData.qrCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Polling para PIX
  useEffect(() => {
    if (!pixData || !pixData.orderId || pixPaid) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/pix/status?orderId=${pixData.orderId}`)
        const data = await res.json()
        
        if (data.status === 'paid') {
          setPixPaid(true)
          clearInterval(interval)
          setTimeout(() => {
            router.push('/dashboard')
          }, 3000)
        }
      } catch (e) {
        console.error('Erro no polling do Pix', e)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [pixData, pixPaid, router])


  // Formatação do Nome do Plano
  const formatPlanName = (id: string) => {
    if (!id) return 'Plano'
    const cleanId = id.toLowerCase()
    if (cleanId === 'basico') return 'Plano Básico'
    if (cleanId === 'pro') return 'Plano Pro'
    if (cleanId === 'elite') return 'Plano Elite'
    return `Plano ${id.charAt(0).toUpperCase() + id.slice(1)}`
  }

  const planName = formatPlanName(planId)

  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      <Navbar />

      <main className="flex-1 flex flex-col items-center px-4 py-12 md:py-20 w-full">
        
        {/* Navegação e Confiança */}
        <div className="w-full max-w-4xl mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/pricing" className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-sm font-semibold">
            <ArrowLeft size={16} /> Voltar para os Planos
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--green)] bg-[rgba(34,197,94,0.1)] px-3 py-1.5 rounded-full border border-[rgba(34,197,94,0.2)]">
            <ShieldCheck size={14} /> Pagamento 100% Seguro
          </div>
        </div>

        {/* Resumo do Pedido Header */}
        <div className="w-full max-w-4xl flex justify-center checkout-header-spacer">
          <div className="bg-[var(--surface2)] border border-[var(--border)] px-6 py-2 rounded-full shadow-sm flex items-center gap-2 text-[var(--text)]">
            <span className="text-[var(--text-muted)] text-sm">Finalizando compra do</span>
            <strong className="font-bold text-[var(--orange)]">{planName}</strong>
          </div>
        </div>

        {/* Cesta do Checkout */}
        <div className="w-full max-w-4xl bg-[var(--surface)] border border-[var(--border)] rounded-2xl md:rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.3)] overflow-hidden">
          
          <div className="p-6 md:p-10 min-h-[400px] flex flex-col items-center justify-center">
            
            {/* Escolha do Método de Pagamento */}
            {!paymentMethod && !loading && (
              <div className="flex flex-col items-center justify-center w-full animate-in fade-in zoom-in duration-500">
                <h2 className="text-2xl font-syne font-bold text-[var(--text)] mb-2 text-center">Escolha como deseja pagar</h2>
                <p className="text-[var(--text-muted)] mb-8 text-center max-w-md">Selecione PIX para liberação na hora, ou pague com segurança via cartão.</p>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg mx-auto justify-center">
                  <button
                    onClick={handleStartPix}
                    className="flex-1 flex flex-col items-center justify-center gap-3 bg-[var(--surface2)] border-2 border-[var(--border)] hover:border-[var(--orange)] rounded-2xl p-6 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--text)] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <QrCode size={24} />
                    </div>
                    <span className="font-bold text-[var(--text)]">Pagar com PIX</span>
                    <span className="text-xs text-[var(--orange)] font-semibold bg-[var(--surface)] px-2 py-1 rounded-md shadow-sm">Liberação Imediata</span>
                  </button>

                  <button
                    onClick={handleStartCard}
                    className="flex-1 flex flex-col items-center justify-center gap-3 bg-[var(--surface2)] border-2 border-[var(--border)] hover:border-[var(--text)] rounded-2xl p-6 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--text)] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <CreditCard size={24} />
                    </div>
                    <span className="font-bold text-[var(--text)]">Cartão de Crédito</span>
                    <span className="text-xs text-[var(--text-muted)] font-medium bg-[var(--surface)] px-2 py-1 rounded-md">Via Stripe</span>
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center gap-4 text-[var(--text-muted)]">
                <div className="w-10 h-10 border-4 border-[var(--surface2)] border-t-[var(--orange)] rounded-full animate-spin" />
                <p className="font-medium animate-pulse text-sm">Carregando ambiente seguro...</p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-2">
                  <ShieldCheck size={32} />
                </div>
                <h3 className="font-syne font-bold text-xl text-[var(--text)]">Algo deu errado</h3>
                <p className="text-[var(--text-muted)] text-sm max-w-sm">{error}</p>
                <button
                  onClick={() => {
                    setError(null)
                    setPaymentMethod(null)
                  }}
                  className="mt-4 px-6 py-2.5 bg-[var(--surface2)] border border-[var(--border)] hover:border-[var(--orange)] text-[var(--text)] rounded-xl font-semibold transition-all"
                >
                  Tentar Novamente
                </button>
              </div>
            )}

            {/* STRIPE EMBEDDED CHECKOUT */}
            {paymentMethod === 'card' && clientSecret && !error && !loading && (
              <div className="animate-in fade-in duration-500 w-full flex flex-col items-center">
                <div className="w-full max-w-[700px] mb-4 flex justify-start">
                   <button onClick={() => setPaymentMethod(null)} className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition flex items-center gap-2">
                     <ArrowLeft size={16} /> Trocar método de pagamento
                   </button>
                </div>
                <div id="checkout-stripe-container" className="w-full">
                  <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
              </div>
            )}

            {/* PIX CHECKOUT UI */}
            {paymentMethod === 'pix' && pixData && !error && !loading && (
              <div className="flex flex-col items-center justify-center animate-in fade-in duration-500 max-w-md mx-auto w-full">
                
                {pixPaid ? (
                   <div className="flex flex-col items-center justify-center text-center py-10 animate-in slide-in-bottom-4">
                     <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 size={40} />
                     </div>
                     <h3 className="text-2xl font-syne font-bold text-white mb-2">Pagamento Aprovado!</h3>
                     <p className="text-[var(--text-muted)]">Seus créditos já estão disponíveis. Redirecionando para o painel...</p>
                   </div>
                ) : (
                  <>
                    <div className="w-full flex justify-between items-center mb-6">
                      <button onClick={() => setPaymentMethod(null)} className="text-sm text-[var(--text-muted)] hover:text-white transition flex items-center gap-2">
                        <ArrowLeft size={14} /> Trocar
                      </button>
                      <span className="text-xs font-semibold px-2 py-1 bg-[var(--orange)] text-black rounded-md animate-pulse">Aguardando PIX</span>
                    </div>

                    <h2 className="text-xl font-syne font-bold text-center text-[var(--text)] mb-2">Escaneie o QR Code</h2>
                    <p className="text-sm text-[var(--text-muted)] text-center mb-8">Abra o app do seu banco e escaneie o código abaixo para pagar.</p>
                    
                    <div className="p-4 bg-white rounded-2xl shadow-xl mb-8 border-4 border-[var(--surface2)]">
                      <img src={`data:image/png;base64,${pixData.qrCodeBase64}`} alt="QR Code PIX" className="w-48 h-48 sm:w-56 sm:h-56 object-contain" />
                    </div>

                    <div className="w-full">
                      <p className="text-xs text-[var(--text-muted)] mb-2 uppercase tracking-wider font-bold">Ou copie o código (Pix Copia e Cola)</p>
                      <div className="flex items-center gap-2">
                        <input 
                          readOnly 
                          value={pixData.qrCode} 
                          className="flex-1 bg-[var(--surface2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-muted)] outline-none overflow-hidden text-ellipsis"
                        />
                        <button 
                          onClick={copyToClipboard}
                          className="bg-[var(--orange)] hover:bg-[#ff8533] text-black p-3 rounded-xl transition-colors font-bold flex items-center gap-2"
                        >
                          {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
