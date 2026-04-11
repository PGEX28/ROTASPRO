import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Cria o redirect — cookies serão escritos neste response
  const redirectUrl = new URL('/dashboard', origin)
  const response = NextResponse.redirect(redirectUrl)

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error, data } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[Auth Callback] Erro:', error.message)
      return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
    }

    // Track IP for anti-abuse
    if (data?.user) {
      try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || request.headers.get('x-real-ip')
          || 'unknown'

        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Update the audit record with the IP (created by the trigger)
        await admin
          .from('signup_audit')
          .update({ ip_address: ip })
          .eq('user_id', data.user.id)
          .is('ip_address', null)

        // Check if this IP has too many accounts (5+) → flag as abuse
        const { count } = await admin
          .from('signup_audit')
          .select('*', { count: 'exact', head: true })
          .eq('ip_address', ip)

        if (count && count >= 3) {
          // Mark as abuse and remove free credits
          await admin
            .from('signup_audit')
            .update({ is_suspected_abuse: true })
            .eq('user_id', data.user.id)

          await admin
            .from('profiles')
            .update({ credits: 0 })
            .eq('id', data.user.id)
        }
      } catch (e) {
        console.error('[Anti-Abuse] Error tracking IP:', e)
      }
    }
  } else {
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  return response
}
