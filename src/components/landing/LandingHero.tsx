'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Play } from 'lucide-react'

export function LandingHero() {
  const transition = { duration: 0.8, ease: [0.33, 1, 0.68, 1] as const }

  return (
    <section className="relative min-h-[100vh] flex flex-col items-center justify-center text-center px-[5%] pt-[120px] pb-[80px] overflow-hidden">
      {/* Background elements */}
      <div className="hero-bg-grid" />
      <div className="absolute inset-0 z-0">
        <img 
          src="/hero_delivery_context_bg_1776654257792.png" 
          alt="Contexto de entrega"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-bg via-transparent to-bg" />
      </div>
      <div className="hero-glow" />

      {/* Hero Tag */}
      <motion.div 
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
        className="hero-tag relative z-10 inline-flex items-center gap-2 bg-orange-dim border border-orange/25 text-orange px-[0.9rem] py-[0.35rem] rounded-full text-[0.78rem] font-semibold tracking-[0.08em] uppercase mb-[1.8rem]"
      >
        <span className="w-[6px] h-[6px] bg-orange rounded-full shadow-[0_0_6px_var(--orange)]" />
        Feito para entregadores Shopee
      </motion.div>

      {/* Headline */}
      <motion.h1 
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: 0.1 }}
        className="relative z-10 font-barlow-cond font-black text-[clamp(2.8rem,7vw,6.2rem)] leading-[0.95] tracking-tight max-w-[900px] mx-auto mb-6 text-white"
      >
        Transforme a planilha<br />
        em <span className="text-orange">rota pronta</span><br />
        para rodar.
      </motion.h1>

      {/* Subheadline */}
      <motion.p 
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: 0.2 }}
        className="relative z-10 text-[clamp(1rem,2vw,1.2rem)] text-text-muted max-w-[560px] mx-auto mb-10 leading-relaxed font-normal"
      >
        O RotasPro corrige, organiza e prepara sua planilha para uso rápido no Circuit — reduzindo retrabalho, endereços bagunçados e perda de tempo na operação.
      </motion.p>

      {/* CTAs */}
      <motion.div 
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: 0.3 }}
        className="relative z-10 flex flex-wrap gap-4 justify-center"
      >
        <Link 
          href="/signup" 
          className="btn-primary min-w-[200px]"
        >
          Começar agora →
        </Link>
        <Link 
          href="#como-funciona" 
          className="btn-secondary min-w-[200px] flex items-center justify-center gap-2"
        >
          Ver como funciona
        </Link>
      </motion.div>

      {/* Microcopy */}
      <motion.p 
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: 0.4 }}
        className="relative z-10 mt-6 text-[0.82rem] text-text-dim tracking-wide"
      >
        Sem complicação. Rápido, prático e pensado para a rotina real de entregas.
      </motion.p>
    </section>
  )
}
