'use client'

import { useState, useEffect } from 'react'
import { X, Copy, Check, QrCode, Zap, ShieldCheck, Loader2 } from 'lucide-react'

interface PixModalProps {
  isOpen: boolean
  onClose: () => void
  pixData: {
    qrCode: string
    qrCodeBase64: string
    status: string
    amount: number
    orderId: string
  } | null
}

export default function PixModal({ isOpen, onClose, pixData }: PixModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !pixData) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(pixData.qrCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_100px_rgba(240,58,23,0.2)] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 pb-0 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(240,58,23,0.1)] flex items-center justify-center border border-[rgba(240,58,23,0.2)]">
              <QrCode size={20} className="text-[var(--orange)]" />
            </div>
            <div>
              <h3 className="font-syne font-extrabold text-lg text-[var(--text)]">Pagamento PIX</h3>
              <p className="text-[var(--text-muted)] text-[11px] uppercase tracking-widest font-bold">Mercado Pago</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--surface2)] transition-colors text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex flex-col items-center gap-6">
          
          {/* QR Code */}
          <div className="relative p-4 bg-white rounded-2xl shadow-xl">
            <img 
              src={`data:image/png;base64,${pixData.qrCodeBase64}`} 
              alt="QR Code Pix"
              className="w-48 h-48 md:w-56 md:h-56"
            />
            <div className="absolute inset-0 border-4 border-dashed border-[rgba(240,58,23,0.1)] rounded-2xl pointer-events-none" />
          </div>

          {/* Amount */}
          <div className="text-center">
            <p className="text-[var(--text-muted)] text-xs mb-1 uppercase font-bold tracking-tight">Valor Total</p>
            <p className="font-syne font-extrabold text-3xl text-[var(--text)]">R$ {pixData.amount.toFixed(2).replace('.', ',')}</p>
          </div>

          {/* Copy and Paste */}
          <div className="w-full flex flex-col gap-2">
            <p className="text-[var(--text-muted)] text-[10px] uppercase font-bold text-center tracking-widest">Código Pix "Copia e Cola"</p>
            <div className="flex items-center gap-2 p-3 bg-[var(--surface2)] border border-[var(--border-subtle)] rounded-xl group hover:border-[var(--orange)] transition-all">
              <input 
                readOnly
                value={pixData.qrCode}
                className="bg-transparent border-none text-xs text-[var(--text-muted)] flex-1 focus:outline-none overflow-hidden text-ellipsis whitespace-nowrap"
              />
              <button 
                onClick={handleCopy}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  copied 
                  ? 'bg-[var(--green)] text-white' 
                  : 'bg-[var(--orange)] text-white hover:scale-105 active:scale-95'
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-2 px-4 py-2 bg-[rgba(240,58,23,0.05)] border border-[rgba(240,58,23,0.1)] rounded-full animate-pulse">
            <Loader2 size={12} className="text-[var(--orange)] animate-spin" />
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Aguardando confirmação...</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-[rgba(0,0,0,0.2)] flex flex-col gap-4 border-t border-[var(--border)]">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-[var(--green)] flex-shrink-0" />
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              O saldo será creditado instantaneamente após a confirmação do pagamento pelo Banco Central. 
              <span className="text-[var(--text)] font-semibold"> Não feche esta janela caso queira acompanhar o status.</span>
            </p>
          </div>
          
          <button 
            onClick={onClose}
            className="w-full py-4 rounded-xl border border-[var(--border)] text-[var(--text-muted)] text-sm font-bold hover:bg-[var(--surface2)] transition-colors"
          >
            Fechar e Ver Saldo no Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
