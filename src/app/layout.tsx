import type { Metadata } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-syne',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
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
    <html lang="pt-BR" className={`${syne.variable} ${dmSans.variable}`}>
      <body className="bg-bg text-text font-dm-sans antialiased">
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_35%_at_15%_5%,rgba(240,58,23,0.10)_0%,transparent_65%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_85%_90%,rgba(240,58,23,0.06)_0%,transparent_65%)]" />
        </div>
        <div className="relative z-10 min-h-screen flex flex-col">
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  )
}
