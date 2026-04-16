import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: NextRequest) {
  try {
    const { address, city, forceRefresh, lat: hintLat, lng: hintLng } = await req.json()

    if (!address) {
      return NextResponse.json({ error: 'Endereço não fornecido' }, { status: 400 })
    }

    // 1. Normalização básica para o Hash
    // Incluímos cidade no hash para diferenciar ruas homônimas
    const hintPart = (hintLat && hintLng) ? `_${Math.round(hintLat * 100)}_${Math.round(hintLng * 100)}` : ''
    const normalized = `${address}_${city || ''}${hintPart}`.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const addressHash = Buffer.from(normalized).toString('base64')

    // Inicializa Supabase com Service Role para bypass RLS
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 2. Verificar Cache no Supabase (Pular se forceRefresh for true)
    if (!forceRefresh) {
      const { data: cacheEntry } = await supabase
        .from('geocoding_cache')
        .select('lat, lng, full_address, location_type, neighborhood, city, state, postal_code')
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
    // A query já vem cirúrgica do processador (Logradouro, Número, Cidade)
    let searchData = await performSearch(hintLat, hintLng)
    
    if (searchData.status === 'OVER_QUERY_LIMIT') {
      return NextResponse.json({ error: 'Limite de cota do Google Maps excedido' }, { status: 429 })
    }

    // Priorizar resultado por precisão: ROOFTOP > RANGE_INTERPOLATED > primeiro resultado
    const results = searchData.results || []
    let bestResult = results.find((r: any) => r.geometry.location_type === 'ROOFTOP')
      || results.find((r: any) => r.geometry.location_type === 'RANGE_INTERPOLATED')
      || results[0]

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
