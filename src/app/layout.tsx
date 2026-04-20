import type { Metadata } from 'next'
import { Barlow, Barlow_Condensed, DM_Mono } from 'next/font/google'
import './globals.css'

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-barlow',
  display: 'swap',
})

const barlowCond = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-barlow-cond',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'RotasPro — Corretor de Rotas para Shopee',
  description:
    'Plataforma profissional de otimização e correção de rotas para entregadores Shopee. Processe sua planilha em segundos com créditos por uso.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
  },
}

export const viewport = {
  themeColor: '#0F0D0C',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${barlow.variable} ${barlowCond.variable} ${dmMono.variable}`}>
      <body suppressHydrationWarning className="bg-bg text-text font-barlow antialiased">
        <div className="relative z-10 min-h-screen flex flex-col">
          {children}
        </div>
        
        {/* Script para remover Service Workers antigos que possam estar cacheando o app incorretamente */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for(let registration of registrations) {
                    registration.unregister();
                    console.log('Service Worker desregistrado para limpeza de cache.');
                  }
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
