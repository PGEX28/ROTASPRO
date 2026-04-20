'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle2, 
  X, 
  Check, 
  Plus, 
  Clock, 
  MapPin, 
  Zap, 
  Layout, 
  Smartphone, 
  Star,
  Package,
  RefreshCw,
  Target
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
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.33, 1, 0.68, 1] as const } }
}

export function LandingTrustBar() {
  const trustItems = [
    "Feito para operações no Brasil",
    "Compatível com planilhas Shopee",
    "Pronto para uso no Circuit",
    "Mobile-friendly",
    "Processamento rápido"
  ]

  return (
    <div className="w-full bg-bg2 border-y border-border py-6 px-[5%] overflow-hidden">
      <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
        {trustItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2.5 text-[0.85rem] text-text-muted font-medium whitespace-nowrap opacity-80 hover:opacity-100 transition-opacity">
            <Check strokeWidth={3} size={15} className="text-orange shrink-0" />
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

export function LandingProblem() {
  return (
    <>
      <div className="section-divider" />
      <section className="bg-bg2 section-spacing px-[5%]">
        <div className="max-w-[1200px] mx-auto flex flex-col items-center">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={itemVariants}
            className="mb-24 text-center"
          >
            <div className="section-label mx-auto mb-4">// O problema</div>
            <h2 className="font-barlow-cond font-extrabold text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] tracking-tight mb-8 text-white max-w-[900px] mx-auto uppercase">
              Sua operação perde tempo onde não deveria.
            </h2>
            <p className="text-text-muted text-[1.2rem] leading-relaxed max-w-[700px] mx-auto font-light">
              Planilhas desorganizadas, endereços inconsistentes, numeração confusa e retrabalho na hora de montar a rota fazem você perder produtividade logo no início do dia.
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full"
          >
            {[
              { icon: <MapPin size={24} />, title: 'Endereços bagunçados', text: 'Bairro, CEP e numeração muitas vezes não ajudam na montagem da rota.' },
              { icon: <Clock size={24} />, title: 'Mais tempo no app', text: 'A operação fica lenta, cansativa e pouco prática para quem precisa rodar rápido.' },
              { icon: <Package size={24} />, title: 'Paradas mal organizadas', text: 'Pacotes que poderiam estar juntos acabam virando mais trabalho no roteiro.' },
              { icon: <RefreshCw size={24} />, title: 'Menos eficiência', text: 'Mais tempo parado, mais retrabalho e menos fluidez na rua.' }
            ].map((card, i) => (
              <motion.div key={i} variants={itemVariants} className="pain-card text-center flex flex-col items-center justify-start p-10 min-h-[260px] group hover:border-orange/30 transition-all duration-500">
                <div className="w-16 h-16 mb-8 bg-bg3 flex items-center justify-center rounded-2xl border border-border/50 text-orange group-hover:scale-110 group-hover:bg-orange/5 group-hover:border-orange/20 transition-all duration-500 shadow-[0_0_20px_rgba(255,92,26,0.05)]">
                  {card.icon}
                </div>
                <h4 className="font-barlow-cond font-bold text-[1.3rem] tracking-wide mb-4 text-white uppercase group-hover:text-orange transition-colors duration-500">{card.title}</h4>
                <p className="text-[0.95rem] text-text-muted leading-relaxed font-light">{card.text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  )
}

export function LandingSolution() {
  return (
    <>
      <div className="section-divider" />
      <section className="bg-bg section-spacing px-[5%]">
        <div className="max-w-[1200px] mx-auto flex flex-col items-center text-center">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={itemVariants}
            className="mb-24"
          >
            <div className="section-label mx-auto mb-4">// A solução</div>
            <h2 className="font-barlow-cond font-extrabold text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] tracking-tight mb-8 text-white max-w-[900px] uppercase">
              O RotasPro organiza o caos antes da rota começar.
            </h2>
            <p className="text-text-muted text-[1.15rem] leading-relaxed max-w-[650px] mx-auto font-light">
              Você envia a planilha, o sistema corrige e reorganiza os dados, melhora a estrutura das paradas e devolve tudo pronto para seguir com mais velocidade e clareza.
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full max-w-[1000px]"
          >
            {[
              { num: '01', title: 'Corrige a base da planilha', text: 'Melhora a estrutura dos dados para deixar a operação mais limpa e legível.' },
              { num: '02', title: 'Organiza melhor as paradas', text: 'Ajuda a reduzir retrabalho e torna a leitura da rota mais prática no dia a dia.' },
              { num: '03', title: 'Entrega um arquivo pronto para uso', text: 'Receba a planilha corrigida para usar no seu fluxo com muito mais agilidade.' }
            ].map((item, i) => (
              <motion.div key={i} variants={itemVariants} className="flex flex-col items-center text-center gap-6">
                <span className="font-mono-dm text-[0.85rem] text-orange bg-orange-dim border border-orange/30 w-12 h-12 flex items-center justify-center rounded-full font-bold">
                  {item.num}
                </span>
                <div>
                  <h4 className="font-barlow-cond font-bold text-[1.3rem] text-white mb-3 tracking-wide uppercase">{item.title}</h4>
                  <p className="text-[0.95rem] text-text-muted leading-relaxed max-w-[280px] font-light">{item.text}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  )
}

export function LandingSteps() {
  const steps = [
    { 
      num: 1, 
      title: 'Envie sua planilha', 
      text: 'Faça upload da planilha da Shopee em poucos segundos. Sem configuração, sem complicação.',
      img: '/step_1_upload_shopee_sheet_1776654149061.png'
    },
    { 
      num: 2, 
      title: 'O RotasPro processa', 
      text: 'A plataforma corrige a estrutura dos dados e melhora a distribuição das paradas automaticamente.',
      img: '/step_2_processing_addresses_1776654164004.png'
    },
    { 
      num: 3, 
      title: 'Baixe a planilha pronta', 
      text: 'Receba o arquivo final para usar no Circuit com muito mais praticidade e agilidade.',
      img: '/step_3_circuit_mockup.png'
    }
  ]

  return (
    <>
      <div className="section-divider" />
      <section id="como-funciona" className="bg-bg2 section-spacing px-[5%]">
        <div className="max-w-[1200px] mx-auto text-center mb-24">
          <div className="section-label mx-auto mb-4">// Como funciona</div>
          <h2 className="font-barlow-cond font-extrabold text-[clamp(2.5rem,6vw,5rem)] text-white uppercase leading-[0.95] mb-6">
            O caminho da <span className="text-orange">produtividade</span>.
          </h2>
          <p className="text-text-muted text-[1.1rem] max-w-[600px] mx-auto font-light">
            Simples, rápido e pensado para a rotina real de quem está na rua.
          </p>
        </div>

        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
          {steps.map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.7 }}
              className="group relative bg-surface border border-border rounded-3xl overflow-hidden transition-all hover:border-orange/30 hover:translate-y-[-8px] shadow-2xl"
            >
              <div className="relative aspect-[16/10] overflow-hidden border-b border-border">
                <img 
                  src={step.img} 
                  alt={step.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent opacity-60" />
                
                <div className="absolute top-6 left-6 w-10 h-10 bg-orange rounded-xl flex items-center justify-center font-barlow-cond font-black text-[1.1rem] shadow-[0_0_20px_rgba(255,92,26,0.3)] text-white">
                  {step.num}
                </div>
              </div>

              <div className="p-10">
                <h3 className="font-barlow-cond font-bold text-[1.6rem] text-white mb-4 tracking-tight uppercase group-hover:text-orange transition-colors">
                  {step.title}
                </h3>
                <p className="text-[0.95rem] text-text-muted leading-relaxed font-light opacity-90">
                  {step.text}
                </p>
              </div>

              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange/0 to-transparent group-hover:via-orange/60 transition-all duration-500" />
            </motion.div>
          ))}
        </div>
      </section>
    </>
  )
}

export function LandingComparison() {
  return (
    <>
      <div className="section-divider" />
      <section className="bg-bg section-spacing px-[5%]">
        <div className="max-w-[1200px] mx-auto text-center mb-20">
          <div className="section-label mx-auto mb-4">// Antes e depois</div>
          <h2 className="font-barlow-cond font-extrabold text-[clamp(2.5rem,6vw,5rem)] text-white uppercase leading-[0.95]">A diferença é clara desde o início.</h2>
        </div>

        <div className="max-w-[900px] mx-auto grid md:grid-cols-[1fr_auto_1fr] gap-8 items-center">
          <div className="compare-col rounded-2xl overflow-hidden border border-border">
            <div className="bg-orange/10 text-orange border-b border-border px-8 py-5 font-barlow-cond font-bold text-[1rem] tracking-widest uppercase flex items-center justify-center gap-3">
              <X size={18} strokeWidth={3} /> Antes do RotasPro
            </div>
            <div className="p-8 flex flex-col gap-4 text-center">
              {[
                'Planilha confusa e desorganizada',
                'Endereços inconsistentes',
                'Mais tempo perdido ajustando',
                'Operação travada desde o início'
              ].map((it, i) => (
                <div key={i} className="flex flex-col items-center gap-2 text-[0.95rem] text-text-muted font-light">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange/40" />
                  {it}
                </div>
              ))}
            </div>
          </div>

          <div className="font-barlow-cond font-black text-[2rem] text-text-dim/30 tracking-widest text-center hidden md:block">VS</div>

          <div className="compare-col after border-green/30 rounded-2xl overflow-hidden">
            <div className="bg-green/10 text-green border-b border-green/20 px-8 py-5 font-barlow-cond font-bold text-[1rem] tracking-widest uppercase flex items-center justify-center gap-3">
              <Check size={18} strokeWidth={3} /> Depois do RotasPro
            </div>
            <div className="p-8 flex flex-col gap-4 text-center">
              {[
                'Planilha organizada e limpa',
                'Estrutura pronta para uso',
                'Mais agilidade na preparação',
                'Rota mais clara para executar'
              ].map((it, i) => (
                <div key={i} className="flex flex-col items-center gap-2 text-[1rem] text-white font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green" />
                  {it}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export function LandingFAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  const faqs = [
    { q: "O RotasPro funciona com planilhas da Shopee?", a: "Sim. O produto foi pensado exatamente para esse tipo de fluxo. É especializado na dor real da operação Shopee." },
    { q: "Preciso instalar algo?", a: "Não. O uso pode ser feito de forma simples pela plataforma web, sem instalação ou configuração adicional." },
    { q: "A planilha sai pronta para o Circuit?", a: "Essa é a proposta principal do RotasPro: preparar a base para esse uso com mais praticidade e menos ajustes manuais." },
    { q: "Posso usar pelo celular?", a: "Sim. A experiência é pensada para funcionar bem também no mobile, sem perda de funcionalidade." },
    { q: "Como funcionam os créditos?", a: "O uso da plataforma pode ser feito com base em créditos por processamento. Você usa conforme a necessidade da sua operação." },
    { q: "É difícil usar?", a: "Não. O fluxo é simples: enviar a planilha, o sistema processa, e você baixa o arquivo pronto. Sem etapas desnecessárias." }
  ]

  return (
    <>
      <div className="section-divider" />
      <section id="faq" className="bg-bg2 section-spacing px-[5%]">
        <div className="max-w-[850px] mx-auto flex flex-col items-center">
          <div className="text-center mb-16">
            <div className="section-label mx-auto mb-4">// Dúvidas frequentes</div>
            <h2 className="font-barlow-cond font-extrabold text-[clamp(2.5rem,6vw,5rem)] text-white uppercase leading-[0.95]">Respostas diretas.</h2>
          </div>

          <div className="flex flex-col w-full text-left gap-2">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-border/50 bg-bg3/30 rounded-xl overflow-hidden transition-colors hover:border-border">
                <button 
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  className="w-full flex justify-between items-center px-8 py-6 cursor-pointer text-left group"
                >
                  <span className={`font-bold text-[1rem] md:text-[1.1rem] transition-colors ${openIdx === i ? 'text-orange' : 'text-white'}`}>
                    {faq.q}
                  </span>
                  <Plus 
                    className={`text-orange transition-transform duration-300 shrink-0 ${openIdx === i ? 'rotate-45 scale-125' : 'rotate-0'}`} 
                    size={22} 
                  />
                </button>
                <AnimatePresence initial={false}>
                  {openIdx === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-8 pb-8 text-[0.95rem] md:text-[1rem] text-text-muted leading-relaxed font-light border-t border-border/20 pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export function LandingFooter() {
  return (
    <footer className="bg-bg2 border-t border-border py-20 px-[5%]">
      <div className="max-w-[1200px] mx-auto flex flex-col items-center text-center gap-12">
        <div>
          <Link href="/" className="font-barlow-cond font-black text-[1.8rem] tracking-tight text-white uppercase">
            Rotas<span className="text-orange">Pro</span>
          </Link>
          <div className="text-[0.9rem] text-text-dim mt-4 max-w-[350px] mx-auto font-light leading-relaxed">
            Mais organização no começo da rota. Mais agilidade no resto do dia. Processado com inteligência para entregadores reais.
          </div>
        </div>

        <ul className="flex flex-wrap justify-center gap-x-12 gap-y-6 list-none border-y border-border/30 py-8 w-full max-w-[800px]">
          <li><Link href="#" className="text-text-muted hover:text-orange text-[0.9rem] transition-colors font-medium uppercase tracking-widest">Início</Link></li>
          <li><Link href="#como-funciona" className="text-text-muted hover:text-orange text-[0.9rem] transition-colors font-medium uppercase tracking-widest">Como funciona</Link></li>
          <li><Link href="/pricing" className="text-text-muted hover:text-orange text-[0.9rem] transition-colors font-medium uppercase tracking-widest">Planos</Link></li>
          <li><Link href="#faq" className="text-text-muted hover:text-orange text-[0.9rem] transition-colors font-medium uppercase tracking-widest">FAQ</Link></li>
          <li><Link href="/login" className="text-text-muted hover:text-orange text-[0.9rem] transition-colors font-medium uppercase tracking-widest">Entrar</Link></li>
        </ul>

        <div className="flex flex-col gap-4 items-center">
          <div className="text-[0.8rem] text-text-dim uppercase tracking-widest font-medium opacity-50">
            Focado em performance logística brasileira
          </div>
          <div className="text-[0.85rem] text-text-dim/60">
            © 2026 RotasPro — Todos os direitos reservados.
          </div>
        </div>
      </div>
    </footer>
  )
}
