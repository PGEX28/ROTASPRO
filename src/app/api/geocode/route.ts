import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createJSClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { logSecurityEvent } from '@/lib/audit'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Esquema de validação para Geocodificação
const geocodeSchema = z.object({
  address: z.string().min(3, 'Endereço muito curto'),
  city: z.string().optional(),
  forceRefresh: z.boolean().optional(),
  lat: z.number().optional(),
  lng: z.number().optional()
}).strict()

export async function POST(req: NextRequest) {
  try {
    const supabaseUser = await createClient()
    const { data: { user } } = await supabaseUser.auth.getUser()

    if (!user) {
      await logSecurityEvent({
        event_type: 'UNAUTHORIZED_GEOCODE_ATTEMPT',
        severity: 'warning',
        metadata: { path: '/api/geocode' }
      })
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const json = await req.json()
    const result = geocodeSchema.safeParse(json)

    if (!result.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: result.error.format() }, { status: 400 })
    }

    const { address, city, forceRefresh, lat: hintLat, lng: hintLng } = result.data

    // 1. Normalização básica para o Hash
    // Incluímos cidade no hash para diferenciar ruas homônimas
    const hintPart = (hintLat && hintLng) ? `_${Math.round(hintLat * 100)}_${Math.round(hintLng * 100)}` : ''
    const normalized = `${address}_${city || ''}${hintPart}`.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const addressHash = Buffer.from(normalized).toString('base64')

    // Inicializa Supabase com Service Role para bypass RLS
    const supabase = createJSClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 2. Verificar Cache no Supabase (Pular se forceRefresh for true)
    if (!forceRefresh) {
      const { data: cacheEntry } = await supabase
        .from('geocoding_cache')
        .select('lat, lng, full_address, street, location_type, neighborhood, city, state, postal_code')
        .eq('address_hash', addressHash)
        .single()

      if (cacheEntry) {
        return NextResponse.json({
          lat: cacheEntry.lat,
          lng: cacheEntry.lng,
          formatted_address: cacheEntry.full_address,
          location_type: cacheEntry.location_type,
          neighborhood: cacheEntry.neighborhood,
          city: cacheEntry.city,
          state: cacheEntry.state,
          postal_code: cacheEntry.postal_code,
          source: 'cache'
        })
      }
    }

    // 3. Se não houver cache, consultar Google Maps
    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json({ error: 'Google Maps API Key não configurada' }, { status: 500 })
    }

    // 3. Função de busca no Google
    async function performSearch(biasLat?: number, biasLng?: number) {
      let googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}&region=br&language=pt-BR`
      
      // GPS hint: usa 'bounds' (parâmetro real da Geocoding API) com ~500m de raio
      if (biasLat && biasLng) {
        const delta = 0.005 // ~500m em graus
        const sw = `${biasLat - delta},${biasLng - delta}`
        const ne = `${biasLat + delta},${biasLng + delta}`
        googleUrl += `&bounds=${sw}|${ne}`
      }

      googleUrl += `&components=${encodeURIComponent('country:BR')}`

      const response = await fetch(googleUrl)
      return await response.json()
    }

    // TENTATIVA 1: Busca Local (com âncora de 500m se houver hint)
    let searchData = await performSearch(hintLat, hintLng)
    
    if (searchData.status === 'OVER_QUERY_LIMIT') {
      return NextResponse.json({ error: 'Limite de cota do Google Maps excedido' }, { status: 429 })
    }

    // Busca inteligente: Priorizar ROOFTOP
    let results = searchData.results || []
    let bestResult = results.find((r: any) => r.geometry.location_type === 'ROOFTOP')

    // TENTATIVA 2: Busca Global (sem âncora) se ainda não achou ROOFTOP
    if (!bestResult && results.length > 0) {
      const globalData = await performSearch()
      const globalRooftop = (globalData.results || []).find((r: any) => r.geometry.location_type === 'ROOFTOP')
      
      if (globalRooftop) {
        bestResult = globalRooftop
      }
    }

    // Fallback Final: se nenhuma busca achou ROOFTOP, usamos o primeiro resultado
    if (!bestResult) {
      bestResult = results[0]
    }

    if (!bestResult) {
      return NextResponse.json({ error: 'Endereço não encontrado no Google Maps', status: searchData.status }, { status: 404 })
    }

    const { lat, lng } = bestResult.geometry.location
    const locationType = bestResult.geometry.location_type
    const formattedAddress = bestResult.formatted_address

    // Parser de componentes de endereço
    const addrComponents = bestResult.address_components || []
    const getComp = (type: string, useShort = false) => {
      const comp = addrComponents.find((c: any) => c.types.includes(type))
      return comp ? (useShort ? comp.short_name : comp.long_name) : ''
    }

    const street = getComp('route')
    const neighborhood = getComp('sublocality_level_1') || getComp('neighborhood')
    const cityResult = getComp('locality') || getComp('administrative_area_level_2')
    const state = getComp('administrative_area_level_1', true)
    const postalCode = getComp('postal_code')

    // 4. Salvar no Cache (upsert para evitar falha em hash duplicado)
    await supabase.from('geocoding_cache').upsert({
      address_hash: addressHash,
      full_address: formattedAddress,
      street,
      location_type: locationType,
      lat,
      lng,
      neighborhood,
      city: cityResult,
      state,
      postal_code: postalCode
    }, { onConflict: 'address_hash' })

    return NextResponse.json({
      lat,
      lng,
      formatted_address: formattedAddress,
      location_type: locationType,
      street,
      neighborhood,
      city: cityResult,
      state,
      postal_code: postalCode,
      source: 'google'
    })

  } catch (error: any) {
    console.error('Geocoding error:', error)
    return NextResponse.json({ error: 'Erro interno no servidor de geocodificação' }, { status: 500 })
  }
}
