'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  Zap, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  Smartphone, 
  Truck, 
  Check, 
  ArrowRight, 
  Star 
} from 'lucide-react'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.33, 1, 0.68, 1] as const } }
}

export function LandingBenefits() {
  const benefits = [
    {
      icon: <Clock size={24} />,
      title: "Rápido e Prático",
      text: "Sua planilha processada em segundos. Menos tempo no escritório, mais tempo na rua."
    },
    {
      icon: <MapPin size={24} />,
      title: "Foco no Brasil",
      text: "Especialista em tratar os endereços complexos da nossa realidade logística."
    },
    {
      icon: <Zap size={24} />,
      title: "Elimine o Retrabalho",
      text: "Pare de ajustar endereços manualmente no celular. O RotasPro já faz isso por você."
    }
  ]

  return (
    <>
      <div className="section-divider" />
      <section id="beneficios" className="section-spacing px-[5%] bg-bg">
        <div className="max-w-[1200px] mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center"
          >
            {benefits.map((benefit, i) => (
              <motion.div 
                key={i} 
                variants={itemVariants}
                className="bg-bg2 border border-border rounded-2xl p-10 transition-all hover:bg-bg3 hover:border-orange/30 overflow-hidden relative group h-full flex flex-col items-center text-center max-w-[400px]"
              >
                <div className="w-[64px] h-[64px] bg-orange/10 rounded-2xl flex items-center justify-center text-orange mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-[0_0_20px_rgba(255,92,26,0.1)]">
                  {benefit.icon}
                </div>
                <h3 className="font-barlow-cond font-bold text-[1.5rem] tracking-tight text-white mb-5 uppercase group-hover:text-orange transition-colors">
                  {benefit.title}
                </h3>
                <p className="text-text-muted text-[1rem] leading-relaxed font-light">
                  {benefit.text}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  )
}

export function LandingDifferentiators() {
  return (
    <>
      <div className="section-divider" />
      <section className="section-spacing px-[5%] bg-bg2 relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange/5 blur-[120px] rounded-full -mr-64 -mt-64" />
        
        <div className="max-w-[1200px] mx-auto flex flex-col items-center text-center relative z-10">
          {/* Title Content */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="mb-20 w-full"
          >
            <div className="section-label mx-auto mb-4">// O diferencial</div>
            <h2 className="font-barlow-cond font-extrabold text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] tracking-tight mb-10 text-white max-w-[900px] mx-auto uppercase">
              Por que escolher o <span className="text-orange">RotasPro?</span>
            </h2>
            <p className="text-text-muted text-[1.25rem] leading-relaxed mb-16 max-w-[750px] mx-auto font-light">
              Não somos apenas um corretor de endereços. Somos a ponte inteligente entre a sua planilha da Shopee e a rua.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1100px] mx-auto justify-items-center">
              {[
                "Especializado em fluxo Shopee (Vshope)",
                "Correção gramatical de endereços",
                "Limpeza de CEPs inválidos ou ausentes",
                "Otimização para importação no Circuit",
                "Suporte técnico focado no Brasil",
                "Processamento imediato e seguro"
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center justify-center gap-5 bg-bg/40 border border-border/50 p-8 rounded-2xl hover:border-orange/30 transition-all group w-full max-w-[340px] text-center">
                  <div className="w-10 h-10 bg-green/10 rounded-full flex items-center justify-center text-green group-hover:bg-green/20 group-hover:scale-110 transition-all">
                    <Check size={20} strokeWidth={4} />
                  </div>
                  <span className="text-[1.05rem] font-bold text-text-muted uppercase tracking-wider leading-tight group-hover:text-white transition-colors">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Action Panel */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="w-full max-w-[700px]"
          >
            <div className="bg-surface border border-white/5 rounded-3xl p-10 md:p-16 relative overflow-hidden group shadow-2xl">
              <div className="relative z-10">
                <div className="flex items-center justify-center gap-3 mb-8">
                  <Star size={20} fill="var(--orange)" stroke="var(--orange)" />
                  <span className="text-orange font-mono-dm text-[0.85rem] tracking-[0.2em] uppercase font-black">Destaque Operacional</span>
                  <Star size={20} fill="var(--orange)" stroke="var(--orange)" />
                </div>
                <h4 className="font-barlow-cond font-bold text-[2.2rem] leading-[1.1] text-white mb-10 uppercase tracking-tighter">
                  Mais paradas por hora, <br />menos estresse na preparação.
                </h4>
                
                <div className="grid grid-cols-2 gap-10 mb-12 pt-10 border-t border-white/5">
                  <div className="flex flex-col items-center">
                    <div className="text-[2.5rem] font-barlow-cond font-black text-white leading-none">94%</div>
                    <div className="text-[0.8rem] text-text-dim uppercase tracking-[0.15em] font-bold mt-2">Precisão em CEPs</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="text-[2.5rem] font-barlow-cond font-black text-white leading-none">2.5x</div>
                    <div className="text-[0.8rem] text-text-dim uppercase tracking-[0.15em] font-bold mt-2">Mais velocidade</div>
                  </div>
                </div>

                <div className="text-[1rem] text-text-muted leading-relaxed font-light italic opacity-80 max-w-[480px] mx-auto">
                  "O RotasPro me salva 40 minutos todos os dias só na parte de limpar a planilha. Agora a rota entra limpa direto no Circuit."
                </div>
              </div>

              {/* Background Glows */}
              <div className="absolute -top-10 -right-10 w-64 h-64 bg-orange/5 blur-[80px] rounded-full group-hover:bg-orange/10 transition-all duration-700" />
              <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-blue/5 blur-[80px] rounded-full" />
            </div>
          </motion.div>
        </div>
      </section>
    </>
  )
}
