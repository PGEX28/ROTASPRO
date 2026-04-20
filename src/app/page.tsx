import { LandingNav } from '@/components/landing/LandingNav'
import { LandingHero } from '@/components/landing/LandingHero'
import { 
  LandingTrustBar, 
  LandingProblem, 
  LandingSolution, 
  LandingSteps, 
  LandingComparison, 
  LandingFAQ, 
  LandingFooter 
} from '@/components/landing/LandingSections'
import { LandingCTA } from '@/components/landing/LandingCTA'
import { LandingBenefits, LandingDifferentiators } from '@/components/landing/LandingBenefits'

export default function RootPage() {
  return (
    <main className="min-h-screen bg-bg text-text selection:bg-orange selection:text-white">
      {/* Navigation */}
      <LandingNav />

      {/* Hero Section */}
      <LandingHero />

      {/* Trust Band */}
      <LandingTrustBar />

      {/* Problem & Solution Flow */}
      <LandingProblem />
      <LandingSolution />

      {/* How it works */}
      <LandingSteps />

      {/* Benefits Grid */}
      <LandingBenefits />

      {/* Before vs After */}
      <LandingComparison />

      {/* Differentiators */}
      <LandingDifferentiators />

      {/* Strong Final CTA */}
      <LandingCTA />

      {/* Questions */}
      <LandingFAQ />

      {/* Footer */}
      <LandingFooter />
    </main>
  )
}
