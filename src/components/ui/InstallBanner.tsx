'use client'

import { useEffect, useState } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Check if previously dismissed (24h cooldown)
    const lastDismissed = localStorage.getItem('install-banner-dismissed')
    if (lastDismissed) {
      const elapsed = Date.now() - Number(lastDismissed)
      if (elapsed < 24 * 60 * 60 * 1000) {
        setDismissed(true)
        return
      }
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setDeferredPrompt(null)
  }

  function handleDismiss() {
    setDismissed(true)
    localStorage.setItem('install-banner-dismissed', String(Date.now()))
  }

  if (isInstalled || dismissed || !deferredPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">
      <div className="max-w-2xl mx-auto bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-[0_8px_40px_rgba(0,0,0,0.6)] flex items-center gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-[var(--border)] bg-black">
          <img src="/icon-192x192.png" alt="RotasPro Icon" className="w-full h-full object-cover" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--text)]">Instalar RotasPro</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Acesse mais rápido direto da tela inicial</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 bg-[var(--orange)] text-white rounded-lg px-4 py-2.5 text-sm font-bold hover:bg-[var(--orange-light)] transition-all shadow-[0_2px_12px_rgba(240,58,23,0.4)]"
          >
            <Download size={14} />
            Instalar
          </button>
          <button
            onClick={handleDismiss}
            className="text-[var(--text-muted)] hover:text-[var(--text)] p-2 rounded-lg hover:bg-[var(--surface2)] transition-all"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
