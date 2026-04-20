'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export function LandingCTA() {
  const transition = { duration: 0.8, ease: [0.33, 1, 0.68, 1] as const }

  return (
    <>
      <div className="section-divider" />
      <section className="relative bg-bg section-spacing px-[5%] text-center overflow-hidden">
      {/* Radial Gradient Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(255,92,26,0.1)_0%,transparent_60%)] pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={transition}
        >
          <div className="section-label mx-auto justify-center flex">// Pronto para começar</div>
          <h2 className="font-barlow-cond font-extrabold text-[clamp(2.2rem,5vw,4rem)] text-white leading-tight mb-4">
            Pare de perder tempo<br />ajustando planilha na mão.
          </h2>
          <p className="text-text-muted text-[1.1rem] leading-relaxed max-w-[460px] mx-auto mb-10">
            Organize sua operação com mais praticidade e comece a rodar com uma base muito mais preparada.
          </p>

          <div className="flex flex-wrap gap-4 justify-center items-center">
            <Link 
              href="/signup" 
              className="btn-primary min-w-[240px]"
            >
              Quero usar o RotasPro →
            </Link>
            <Link 
              href="/pricing" 
              className="btn-secondary min-w-[200px]"
            >
              Ver planos
            </Link>
          </div>
        </motion.div>
      </div>
      </section>
    </>
  )
}
