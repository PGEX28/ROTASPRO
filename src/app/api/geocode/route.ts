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
        .select('lat, lng, full_address')
        .eq('address_hash', addressHash)
        .single()

      if (cacheEntry) {
        return NextResponse.json({
          lat: cacheEntry.lat,
          lng: cacheEntry.lng,
          formatted_address: cacheEntry.full_address,
          source: 'cache'
        })
      }
    }

    // 3. Se não houver cache, consultar Google Maps
    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json({ error: 'Google Maps API Key não configurada' }, { status: 500 })
    }

    let googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}&region=br&language=pt-BR`
    
    // Ancoragem (Location Bias): Se tivermos coordenadas da planilha, usamos como centro de busca
    if (hintLat && hintLng) {
      // Usamos 50m para criar uma "Confluência" ultra-restrita com a trava de segurança
      googleUrl += `&locationbias=circle:50@${hintLat},${hintLng}`
    }

    // Adiciona filtros de componentes para travar o resultado no Brasil e na cidade se fornecida
    let components = 'country:BR'
    if (city) {
      components += `|locality:${city}`
    }
    googleUrl += `&components=${encodeURIComponent(components)}`

    const response = await fetch(googleUrl)
    const data = await response.json()

    if (data.status !== 'OK' || !data.results[0]) {
      return NextResponse.json({ error: 'Endereço não encontrado no Google Maps', status: data.status }, { status: 404 })
    }

    const { lat, lng } = data.results[0].geometry.location
    const formattedAddress = data.results[0].formatted_address

    // 4. Salvar no Cache
    await supabase.from('geocoding_cache').insert({
      address_hash: addressHash,
      full_address: formattedAddress,
      lat,
      lng
    })

    return NextResponse.json({
      lat,
      lng,
      formatted_address: formattedAddress,
      source: 'google'
    })

  } catch (error: any) {
    console.error('Geocoding error:', error)
    return NextResponse.json({ error: 'Erro interno no servidor de geocodificação' }, { status: 500 })
  }
}
