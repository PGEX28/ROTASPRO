export type Plan = {
  id: string
  name: string
  price: number
  credits: number
  pricePerCredit: number
  description: string
  highlight: boolean
  badge?: string
  perks: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'piloto',
    name: 'Piloto',
    price: 10,
    credits: 10,
    pricePerCredit: 1.0,
    description: 'Ideal para testes e entregas eventuais',
    highlight: false,
    perks: [
      '10 processamentos completos',
      'Suporte dedicado',
    ],
  },
  {
    id: 'basico',
    name: 'Básico',
    price: 25,
    credits: 28,
    pricePerCredit: 0.89,
    description: 'Perfeito para uso semanal regular',
    highlight: false,
    perks: [
      'Tudo do plano Piloto +',
      '28 processamentos completos',
      '11% mais barato por crédito',
      'Histórico completo',
    ],
  },
  {
    id: 'profissional',
    name: 'Profissional',
    price: 50,
    credits: 60,
    pricePerCredit: 0.83,
    description: 'Para entregadores em tempo integral',
    highlight: true,
    badge: 'Mais Popular',
    perks: [
      'Tudo do plano Básico +',
      '60 processamentos completos',
      '17% mais barato por crédito',
    ],
  },
  {
    id: 'frota',
    name: 'Frota / Top',
    price: 100,
    credits: 130,
    pricePerCredit: 0.76,
    description: 'Máxima economia para alta demanda',
    highlight: false,
    badge: 'Melhor Custo',
    perks: [
      'Tudo do plano Profissional +',
      '130 processamentos completos',
      '24% mais barato por crédito',
    ],
  },
]
