'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { createBrowserClient } from '@supabase/ssr'

export function LandingNav() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [user, setUser] = useState<any>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
    }
    checkUser()

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [supabase])

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 h-[64px] px-[5%] flex items-center justify-between transition-all duration-300 ${
        isScrolled ? 'bg-bg/92 backdrop-blur-xl border-b border-border' : 'bg-transparent border-b border-transparent'
      }`}
    >
      <Link href="/" className="nav-logo text-white font-barlow-cond font-extrabold text-[1.3rem] tracking-wider decoration-0">
        Rotas<span className="text-orange">Pro</span>
      </Link>

      <ul className="hidden md:flex items-center gap-8 list-none">
        <li>
          <Link href="#como-funciona" className="text-text-muted hover:text-text text-[0.9rem] font-medium transition-colors">
            Como funciona
          </Link>
        </li>
        <li>
          <Link href="#beneficios" className="text-text-muted hover:text-text text-[0.9rem] font-medium transition-colors">
            Benefícios
          </Link>
        </li>
        <li>
          <Link href="#faq" className="text-text-muted hover:text-text text-[0.9rem] font-medium transition-colors">
            FAQ
          </Link>
        </li>
      </ul>

      <div className="flex items-center gap-4">
        {user ? (
          <Link 
            href="/dashboard"
            className="nav-cta bg-orange text-white px-5 py-2 rounded-[6px] text-[0.9rem] font-bold transition-opacity hover:opacity-90"
          >
            Dashboard
          </Link>
        ) : (
          <>
            <Link 
              href="/login"
              className="text-text-muted hover:text-text text-[0.9rem] font-medium transition-colors"
            >
              Entrar
            </Link>
            <Link 
              href="/signup"
              className="nav-cta bg-orange text-white px-5 py-2 rounded-[6px] text-[0.9rem] font-bold transition-opacity hover:opacity-90"
            >
              Começar agora
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
