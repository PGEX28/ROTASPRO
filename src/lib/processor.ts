import { createClient } from '@/lib/supabase'

const PREFIX_MAP: [RegExp, string][] = [
  [/^Srv\b/i, 'Servidão'],
  [/^Av\b/i, 'Avenida'],
  [/^R\b/i, 'Rua'],
  [/^Rod\b/i, 'Rodovia'],
  [/^Est\b/i, 'Estrada'],
  [/^Trav\b/i, 'Travessa'],
  [/^Al\b/i, 'Alameda'],
  [/^Pca\b/i, 'Praça'],
  [/^Trv\b/i, 'Travessa'],
]

const MIDDLE_EXP: Record<string, string> = {
  'Francisco T dos Santos': 'Francisco Thomaz dos Santos',
  'Antônio B dos Santos': 'Antônio Borges dos Santos',
  'José P Pires': 'José Paulo Pires',
  'Jacinto L de Oliveira': 'Jacinto Luiz de Oliveira',
  'Maria C Ferreira': 'Maria Carolina Ferreira',
  'Rozália P Ferreira': 'Rozália Paulina Ferreira',
  'João T de Carvalho': 'João Teixeira de Carvalho',
  'Felicidade M da Silva': 'Felicidade Maria da Silva',
  'Izidoro J Pires': 'Izidoro José Pires',
  'Euclides J Alves': 'Euclides João Alves',
  'Francisco Thomaz dos santos': 'Francisco Thomaz dos Santos',
}

const ADDR_CORR: Record<string, string> = {
  'Nereu Guizone, 890': 'Servidão Osnildo Leôncio Duarte, 890',
  'Servidão Gerônimo Luiz Oliveira, 85': 'Rua Gerônimo Luiz Oliveira, 85',
}

// Cache em memória para evitar chamadas repetidas ao Google na mesma sessão
const geocodeCache = new Map<string, { lat: number; lng: number; location_type: string; street?: string; formatted_address?: string; neighborhood?: string; postal_code?: string }>()

function normalizeCacheKey(address: string): string {
  return address.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
}

export type InputRow = Record<string, unknown>

export interface OutputRow {
  'AT ID': string | number
  'Destination Address': string
  'Bairro': string
  'City': string
  'Zipcode/Postal code': string
  'Latitude': string | number
  'Longitude': string | number
  'Address Line 2': string
  'Pacotes na Parada': string
}

export interface ProcessedRowResult {
  index: number
  status: string // 'ROOFTOP' | 'APPROXIMATE' | 'ERROR' | etc
  original: {
    address: string
    bairro: string
    zip: string
    lat: number
    lng: number
  }
  found: {
    address: string
    bairro: string
    zip: string
    lat: number
    lng: number
    precision: string
  }
  changed: {
    address: boolean
    bairro: boolean
    zip: boolean
    coords: boolean
  }
  error?: string
}

export interface QualityStats {
  totalRows: number
  shopeeCount: number
  cacheCount: number
  googleCount: number
  noneCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  suspectDistanceCount: number
  invalidDistanceCount: number
  rooftopCount: number
  interpolatedCount: number
  
  // Auditoria Shopee
  shopeeAuditCheckedCount: number
  shopeeAuditOkCount: number
  shopeeAuditSuspectCount: number
  shopeeAuditInvalidCount: number
  shopeeAuditNoReferenceCount: number

  // Monitoramento Persistente
  persistentHitCount: number
  persistentHighCount: number
  persistentSuspectCount: number
  persistentInvalidCount: number
}

export interface TransformResult {
  out: OutputRow[]
  unsequencedCount: number
  qualityStats: QualityStats
}

function expandAddress(addr: string): string {
  if (ADDR_CORR[addr]) return ADDR_CORR[addr]
  let expanded = addr
  
  const inlineExpansions: [RegExp, string][] = [
    [/\bN\s*Sra\b/i, 'Nossa Senhora'],
    [/\bPe\.\b/i, 'Padre'],
    [/\bProf\.\b/i, 'Professor'],
    [/\bDr\.\b/i, 'Doutor'],
  ]

  for (const [pat, rep] of PREFIX_MAP) {
    if (pat.test(expanded)) {
      expanded = expanded.replace(pat, rep)
      break
    }
  }

  for (const [pat, rep] of inlineExpansions) {
    expanded = expanded.replace(pat, rep)
  }

  for (const [abbr, full] of Object.entries(MIDDLE_EXP)) {
    if (expanded.includes(abbr)) expanded = expanded.split(abbr).join(full)
  }
  return expanded
}

function cleanStreetName(name: string): string {
  if (!name) return ''
  let clean = name.trim()
  if (/^rua\s+(servidão|servidao|avenida|travessa|rodovia|estrada|alameda|praça|praca)\b/i.test(clean)) {
    clean = clean.replace(/^rua\s+/i, '')
  }
  return clean
}

function getCoreName(addr: string): string {
  let core = addr.toLowerCase()
                 .normalize('NFD')
                 .replace(/[\u0300-\u036f]/g, '')
                 .split(',')[0]
                 .trim()

  const prefixes = [
    /^rua\b/i, /^avenida\b/i, /^servidao\b/i, /^rodovia\b/i, 
    /^estrada\b/i, /^travessa\b/i, /^alameda\b/i, /^pca\b/i, /^praca\b/i,
    /^srv\b/i, /^av\b/i, /^rod\b/i, /^est\b/i, /^trav\b/i, /^al\b/i, /^r\b/i
  ]

  for (const p of prefixes) {
    if (p.test(core)) {
      core = core.replace(p, '').trim()
      break
    }
  }

  return core
}

function splitAddr(addr: string): [string, string | null] {
  const raw = (addr || '').trim()
  const parts = raw.split(', ')
  if (parts.length >= 2) {
    const base = parts.slice(0, 2).join(', ')
    const line2 = parts.length > 2 ? parts.slice(2).join(', ') : null
    return [base, line2]
  }
  return [raw, null]
}

function expandAbbreviations(text: string): string {
  let clean = text.toLowerCase()
  const expansions: [RegExp, string][] = [
    [/\br[.\s]+/g, 'rua '],
    [/\bav[.\s]+/g, 'avenida '],
    [/\bsrv[.\s]+/g, 'servidão '],
    [/\brod[.\s]+/g, 'rodovia '],
    [/\best[.\s]+/g, 'estrada '],
    [/\bal[.\s]+/g, 'alameda '],
    [/\btrav[.\s]+/g, 'travessa '],
    [/\btrv[.\s]+/g, 'travessa '],
    [/\bpca[.\s]+/g, 'praça '],
    [/\bprca[.\s]+/g, 'praça '],
    [/\bdr[.\s]+/g, 'doutor '],
    [/\bprof[.\s]+/g, 'professor '],
    [/\bsha[.\s]+/g, 'senhor '],
    [/\bn\s+sra[.\s]+/g, 'nossa senhora '],
    [/\bns[.\s]+/g, 'nossa senhora '],
    [/\bpe[.\s]+/g, 'padre '],
    [/\bsta[.\s]+/g, 'santa '],
    [/\bsto[.\s]+/g, 'santo '],
  ]
  expansions.forEach(([re, rep]) => { clean = clean.replace(re, rep) })
  return clean
}

function safeParseNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const clean = String(val).replace(',', '.').trim()
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

function formatBrazilianCoord(val: number): string {
  if (!val) return '0'
  return String(val).replace('.', ',')
}

function isValidCoordinate(lat: any, lng: any): boolean {
  const latNum = safeParseNumber(lat)
  const lngNum = safeParseNumber(lng)
  if (latNum === 0 && lngNum === 0) return false
  return latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180
}

function fuzzyStreetSignature(s: string): string {
  let clean = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(rua|servidao|avenida|al|travessa|rodovia|rotula|praca|estrada|loteamento)\b/gi, '')
    .replace(/\b(de|do|da|dos|das|e)\b/gi, '')
    
  clean = clean
    .replace(/z/g, 's').replace(/x/g, 's').replace(/j/g, 'g').replace(/ch/g, 's')
    .replace(/y/g, 'i').replace(/h/g, '').replace(/[aeiou]/gi, '')
    .replace(/[^a-z0-9]/g, ' ').trim()

  let words = clean.split(/\s+/).filter(w => w.length > 0)
  if (words.length >= 2) {
    words = [words[0], words[words.length - 1]]
  }
  return words.join('').replace(/(.)\1+/g, '$1')
}

function extractCanonicalParts(rawAddr: string): { street: string; num: string } {
  let cleanAddr = rawAddr
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s,]/g, ' ') 
    .replace(/\s+/g, ' ')
    .trim()

  cleanAddr = expandAbbreviations(cleanAddr)
  cleanAddr = cleanAddr.replace(/\b(de|do|da|dos|das|e)\b/g, ' ').replace(/\s+/g, ' ').trim()

  const match = cleanAddr.match(/^(.*?)[,\s]\s*(\d+[a-z]?)/i)
  let streetPart = ''
  let numPart = ''

  if (match) {
    streetPart = match[1].trim().replace(/,$/, '').trim()
    numPart = match[2].toLowerCase()
  } else {
    const fallbackMatch = cleanAddr.match(/(.+?)\s+(\d+)\b/)
    if (fallbackMatch) {
      streetPart = fallbackMatch[1]
      numPart = fallbackMatch[2]
    } else {
      streetPart = cleanAddr
      numPart = 'sn'
    }
  }

  const street = fuzzyStreetSignature(streetPart)
  return { street, num: numPart }
}

function shouldMergeSameCanonicalAddress(a: InputRow, b: InputRow): boolean {
  const addr1 = String(a['Destination Address'] ?? '')
  const addr2 = String(b['Destination Address'] ?? '')
  
  const p1 = extractCanonicalParts(addr1)
  const p2 = extractCanonicalParts(addr2)

  if (p1.street !== p2.street) return false
  const isSn1 = !p1.num || p1.num === 'sn'
  const isSn2 = !p2.num || p2.num === 'sn'
  if (isSn1 || isSn2) {
    return p1.num === p2.num
  }

  if (p1.num !== p2.num) return false

  const lat1 = safeParseNumber(a['Latitude'])
  const lng1 = safeParseNumber(a['Longitude'])
  const lat2 = safeParseNumber(b['Latitude'])
  const lng2 = safeParseNumber(b['Longitude'])

  if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
    return true
  }

  const distM = getDistance(lat1, lng1, lat2, lng2) * 1000
  return distM <= 10
}

function getSurgicalQuery(address: string, city: string): string {
  if (!address) return ''
  const expanded = expandAddress(address)
  const clean = expanded.replace(/ - .*/, '').trim()
  const match = clean.match(/(.*)[,\s]\s*(\d+[A-Za-z]?)$/)
  if (match) {
    const logradouro = match[1].trim()
    const numero = match[2].trim()
    return `${logradouro}, ${numero}, ${city}, SC, Brasil`
  }
  return `${clean}, ${city}, SC, Brasil`
}

async function fetchCoords(address: string, city?: string, forceRefresh: boolean = false, lat?: number, lng?: number): Promise<{ 
  lat: number; 
  lng: number; 
  formatted_address?: string; 
  location_type?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postal_code?: string;
} | null> {
  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      body: JSON.stringify({ address, city, forceRefresh, lat, lng }),
      headers: { 'Content-Type': 'application/json' }
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

function normalizeForMatch(str: string): string {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[aeiou]/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function extractHouseNumber(addr: string): string {
  const match = addr.match(/,\s*(?:nº|n°|num|no)?\s*0*(\d+)/i) || addr.match(/\s+0*(\d+)\b/)
  return match ? match[1] : ''
}

function isAddressMatch(inputAddress: string, googleStreet: string): boolean {
  if (!googleStreet) return false
  const inputCore = getCoreName(inputAddress)
  const googleCore = getCoreName(googleStreet)
  if (!inputCore || !googleCore) return false
  const inputNum = extractHouseNumber(inputAddress)
  const googleNum = extractHouseNumber(googleStreet)
  const streetMatch = inputCore.includes(googleCore) || googleCore.includes(inputCore)
  const numberMatch = (!inputNum || !googleNum) ? true : inputNum === googleNum
  return streetMatch && numberMatch
}

function isShopeeAuditMatch(inputAddress: string, googleStreet: string, inputNumber: string, googleNumber: string): { matched: boolean; reason: string } {
  if (!googleStreet) return { matched: false, reason: 'EMPTY_GOOGLE_STREET' }
  const inputCore = getCoreName(inputAddress)
  const googleCore = getCoreName(googleStreet)
  if (!inputCore || !googleCore) return { matched: false, reason: 'EMPTY_STREET_CORE' }
  const streetMatch = inputCore.includes(googleCore) || googleCore.includes(inputCore)
  if (!streetMatch) return { matched: false, reason: 'STREET_MISMATCH' }
  if (!inputNumber && !googleNumber) return { matched: true, reason: 'MATCH_STREET_ONLY' }
  if (inputNumber === googleNumber) return { matched: true, reason: 'MATCH_STREET_AND_NUMBER' }
  return { matched: false, reason: 'NUMBER_MISMATCH' }
}

function buildAddressVariants(surgicalQuery: string, base: string, city: string): string[] {
  const variants = [surgicalQuery]
  const noNumber = base.replace(/,\s*\d+.*$/, '').trim()
  if (noNumber !== base) variants.push(`${noNumber}, ${city}, SC, Brasil`)
  return variants
}

function buildShopeeAuditVariants(surgicalQuery: string, base: string, city: string): string[] {
  const v1 = surgicalQuery
  const cleaned = base.trim() 
  const v2 = `${cleaned}, ${city}`
  const noNumber = cleaned.replace(/(,\s*\d+|\s+n\s*\d+|\s+\d+).*$/i, '').trim()
  const v3 = noNumber !== cleaned ? `${noNumber}, ${city}` : ''
  return Array.from(new Set([v1, v2, v3])).filter(Boolean).slice(0, 3)
}

function getConfidenceScore(locationType?: string, source?: string): number {
  if (source === 'SHOPEE') return 98
  switch (locationType) {
    case 'ROOFTOP': return 95
    case 'RANGE_INTERPOLATED': return 70
    default: return 40
  }
}

function mapQuality(locationType?: string, source?: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (source === 'SHOPEE') return 'HIGH'
  switch (locationType) {
    case 'ROOFTOP': return 'HIGH'
    case 'RANGE_INTERPOLATED': return 'MEDIUM'
    default: return 'LOW'
  }
}

function pickBestCoordinates(current: any, candidate: any): any {
  if (!current || !current.lat) return candidate
  if (!candidate || !candidate.lat) return current
  return candidate.confidence > current.confidence ? candidate : current
}

function classifyDistanceRisk(distanceKm: number): 'OK' | 'SUSPECT' | 'INVALID' {
  if (distanceKm > 2) return 'INVALID'
  if (distanceKm > 0.2) return 'SUSPECT'
  return 'OK'
}

export async function transformRows(
  rows: InputRow[], 
  onRowProcessed?: (res: ProcessedRowResult) => void
): Promise<TransformResult> {
  const BATCH_SIZE = 10
  const MAX_SHOPEE_AUDIT = 20
  let processedCount = 0
  let shopeeAuditCount = 0

  const stats: QualityStats = {
    totalRows: rows.length,
    shopeeCount: 0, cacheCount: 0, googleCount: 0, noneCount: 0,
    highCount: 0, mediumCount: 0, lowCount: 0,
    suspectDistanceCount: 0, invalidDistanceCount: 0,
    rooftopCount: 0, interpolatedCount: 0,
    shopeeAuditCheckedCount: 0, shopeeAuditOkCount: 0,
    shopeeAuditSuspectCount: 0, shopeeAuditInvalidCount: 0,
    shopeeAuditNoReferenceCount: 0,
    persistentHitCount: 0, persistentHighCount: 0, 
    persistentSuspectCount: 0, persistentInvalidCount: 0
  }

  const enrichedRows: InputRow[] = []
  const supabase = createClient()
  const { data: activeCorrections } = await supabase
    .from('address_corrections')
    .select('id, normalized_address, corrected_lat, corrected_lng, confidence')
    .eq('is_active', true)
  
  const correctionsMap = new Map()
  if (activeCorrections) {
    for (const corr of activeCorrections) {
      correctionsMap.set(corr.normalized_address, corr)
    }
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const processedBatch = await Promise.all(batch.map(async (r, batchIdx) => {
      const globalIndex = i + batchIdx
      const updatedRow = { ...r }
      const originalAddr = String(r['Destination Address'] ?? '').trim()
      const originalBairro = String(r['Bairro'] ?? '').trim()
      const originalZip = String(r['Zipcode/Postal code'] ?? '').replace(/\D/g, '')
      const city = String(r['City'] ?? 'Florianópolis')
      const hintLat = safeParseNumber(r['Latitude'])
      const hintLng = safeParseNumber(r['Longitude'])

      const [base, origLine2] = splitAddr(originalAddr)
      updatedRow['Address Line 2'] = origLine2 || ''

      let best: any = null
      let addressHash = ''
      try {
         addressHash = btoa(unescape(encodeURIComponent(base.toLowerCase().trim() + ' | ' + city.toLowerCase().trim())))
      } catch (e) {}
      
      const persistentCorr = correctionsMap.get(addressHash)

      if (persistentCorr) {
         best = {
           lat: persistentCorr.corrected_lat,
           lng: persistentCorr.corrected_lng,
           confidence: persistentCorr.confidence || 100,
           source: 'PERSISTENT',
           location_type: 'ROOFTOP'
         }
         updatedRow['_persistent_hit'] = true
         updatedRow['_persistent_id'] = persistentCorr.id
         updatedRow['_persistent_confidence'] = persistentCorr.confidence || 100
         updatedRow['_persistent_source'] = 'ADMIN_DB'
         stats.persistentHitCount++
         if (best.confidence >= 90) stats.persistentHighCount++
         
         if (isValidCoordinate(r['Latitude'], r['Longitude'])) {
            const hitDist = getDistance(best.lat, best.lng, hintLat, hintLng)
            if (hitDist > 1.5) { updatedRow['_persistent_risk'] = 'INVALID'; stats.persistentInvalidCount++ }
            else if (hitDist > 0.2) { updatedRow['_persistent_risk'] = 'SUSPECT'; stats.persistentSuspectCount++ }
            else { updatedRow['_persistent_risk'] = 'OK' }
         }
      } else if (isValidCoordinate(r['Latitude'], r['Longitude'])) {
        best = {
          lat: hintLat,
          lng: hintLng,
          confidence: getConfidenceScore(undefined, 'SHOPEE'),
          source: 'SHOPEE',
          location_type: 'SHOPEE_ORIGINAL',
        }

        if (shopeeAuditCount < MAX_SHOPEE_AUDIT) {
          shopeeAuditCount++
          stats.shopeeAuditCheckedCount++
          updatedRow['_shopee_audit_checked'] = true
          try {
            const surgicalQuery = getSurgicalQuery(base, city)
            const auditVariants = buildShopeeAuditVariants(surgicalQuery, base, city)
            let auditGeo = null
            let lastRejectionReason = 'GOOGLE_EMPTY_RESULTS'

            for (const variant of auditVariants) {
              const candidate = await fetchCoords(variant, city, false, hintLat, hintLng)
              if (!candidate) continue
              const locType = candidate.location_type || ''
              if (locType === 'ROOFTOP' || locType === 'RANGE_INTERPOLATED') {
                const matchResult = isShopeeAuditMatch(base, candidate.street || '', extractHouseNumber(base), extractHouseNumber(candidate.street || candidate.formatted_address || ''))
                if (matchResult.matched) {
                  auditGeo = { ...candidate, variantUsed: variant, matchReason: matchResult.reason }
                  break
                } else { lastRejectionReason = matchResult.reason }
              } else { lastRejectionReason = 'INVALID_LOCATION_TYPE' }
            }

            if (auditGeo) {
              const dKm = getDistance(hintLat, hintLng, auditGeo.lat, auditGeo.lng)
              const risk = classifyDistanceRisk(dKm)
              updatedRow['_shopee_audit_match'] = true
              updatedRow['_shopee_audit_distance_km'] = Math.round(dKm * 1000) / 1000
              updatedRow['_shopee_audit_risk'] = risk
              updatedRow['_shopee_audit_google_lat'] = auditGeo.lat
              updatedRow['_shopee_audit_google_lng'] = auditGeo.lng
              updatedRow['_shopee_audit_location_type'] = auditGeo.location_type
              updatedRow['_shopee_audit_match_reason'] = auditGeo.matchReason || ''
              if (risk === 'OK') stats.shopeeAuditOkCount++
              else if (risk === 'SUSPECT') stats.shopeeAuditSuspectCount++
              else if (risk === 'INVALID') stats.shopeeAuditInvalidCount++
            } else {
              updatedRow['_shopee_audit_match'] = false
              updatedRow['_shopee_audit_risk'] = 'NO_REFERENCE'
              stats.shopeeAuditNoReferenceCount++
            }
          } catch (e) { stats.shopeeAuditNoReferenceCount++ }
        }
      } else {
        const surgicalQuery = getSurgicalQuery(base, city)
        const cacheKey = normalizeCacheKey(surgicalQuery)
        const cached = geocodeCache.get(cacheKey)
        if (cached) {
          best = pickBestCoordinates(best, {
            lat: cached.lat, lng: cached.lng,
            confidence: getConfidenceScore(cached.location_type, 'CACHE'),
            source: 'CACHE', location_type: cached.location_type,
          })
          updatedRow['Bairro'] = cached.neighborhood || updatedRow['Bairro']
          updatedRow['Zipcode/Postal code'] = cached.postal_code || updatedRow['Zipcode/Postal code']
        } else {
          const variants = buildAddressVariants(surgicalQuery, base, city)
          for (const variant of variants) {
            if (best && best.confidence >= 95) break
            const geo = await fetchCoords(variant, city, false, hintLat, hintLng)
            if (geo && (geo.location_type === 'ROOFTOP' || geo.location_type === 'RANGE_INTERPOLATED')) {
              if (isAddressMatch(base, geo.street || '')) {
                let distRisk: any = null
                if (isValidCoordinate(hintLat, hintLng)) {
                  const dKm = getDistance(hintLat, hintLng, geo.lat, geo.lng)
                  distRisk = classifyDistanceRisk(dKm)
                  updatedRow['_distance_km'] = Math.round(dKm * 1000) / 1000
                  updatedRow['_distance_risk'] = distRisk
                  if (distRisk === 'SUSPECT') stats.suspectDistanceCount++
                  if (distRisk === 'INVALID') stats.invalidDistanceCount++
                }
                if (distRisk !== 'INVALID') {
                  best = pickBestCoordinates(best, {
                    lat: geo.lat, lng: geo.lng,
                    confidence: getConfidenceScore(geo.location_type, 'GOOGLE'),
                    source: 'GOOGLE', location_type: geo.location_type,
                  })
                  if (geo.location_type === 'ROOFTOP') stats.rooftopCount++
                  if (geo.location_type === 'RANGE_INTERPOLATED') stats.interpolatedCount++
                  geocodeCache.set(cacheKey, { ...geo })
                  updatedRow['Bairro'] = geo.neighborhood || updatedRow['Bairro']
                  updatedRow['Zipcode/Postal code'] = geo.postal_code || updatedRow['Zipcode/Postal code']
                  if (geo.street && extractHouseNumber(geo.formatted_address || '')) {
                    updatedRow['Destination Address'] = `${cleanStreetName(geo.street)}, ${extractHouseNumber(geo.formatted_address || '')}`
                  }
                }
              }
            }
          }
        }
      }

      if (best) {
        updatedRow['Latitude'] = formatBrazilianCoord(best.lat)
        updatedRow['Longitude'] = formatBrazilianCoord(best.lng)
      }

      const source = best?.source || 'NONE'
      const quality = mapQuality(best?.location_type, best?.source)
      updatedRow['_coordinate_source'] = source
      updatedRow['_quality'] = quality
      updatedRow['_confidence'] = best?.confidence || 0

      if (source === 'SHOPEE') stats.shopeeCount++
      else if (source === 'CACHE') stats.cacheCount++
      else if (source === 'GOOGLE') stats.googleCount++
      else stats.noneCount++
      if (quality === 'HIGH') stats.highCount++
      else if (quality === 'MEDIUM') stats.mediumCount++
      else stats.lowCount++

      processedCount++
      if (onRowProcessed) {
        onRowProcessed({
          index: globalIndex,
          status: best?.location_type || (best ? 'APPROXIMATE' : 'ERROR'),
          original: { address: originalAddr, bairro: originalBairro, zip: originalZip, lat: hintLat, lng: hintLng },
          found: {
            address: String(updatedRow['Destination Address'] || originalAddr),
            bairro: String(updatedRow['Bairro'] || originalBairro),
            zip: String(updatedRow['Zipcode/Postal code'] || originalZip),
            lat: best?.lat || hintLat, lng: best?.lng || hintLng,
            precision: best?.location_type || 'NONE'
          },
          changed: {
            address: updatedRow['Destination Address'] !== originalAddr,
            bairro: updatedRow['Bairro'] !== originalBairro,
            zip: updatedRow['Zipcode/Postal code'] !== originalZip,
            coords: best && (Math.abs(best.lat - hintLat) > 0.0001 || Math.abs(best.lng - hintLng) > 0.0001) || false
          }
        })
      }
      return updatedRow
    }))
    enrichedRows.push(...processedBatch)
  }

  // Ordenação por CEP
  enrichedRows.sort((a, b) => {
    const cepA = String(a['Zipcode/Postal code'] ?? '').replace(/\D/g, '')
    const cepB = String(b['Zipcode/Postal code'] ?? '').replace(/\D/g, '')
    return cepA.localeCompare(cepB)
  })

  const sequenced = enrichedRows.filter((r) => r['Sequence'] !== '-' && r['Sequence'] != null && r['Stop'] !== '-')
  const unsequenced = enrichedRows.filter((r) => r['Sequence'] === '-' || r['Stop'] === '-')
  const maxSeq = sequenced.length > 0 ? Math.max(...sequenced.map((r) => Number(r['Sequence']))) : 0

  type Group = { rows: InputRow[]; unseqLabels: string[]; first: InputRow; stop: number; base: string }
  const groups: Group[] = []

  for (const r of sequenced) {
    let target = groups.find(g => shouldMergeSameCanonicalAddress(g.first, r))
    if (!target) {
      const [base] = splitAddr(String(r['Destination Address'] ?? ''))
      groups.push({ rows: [r], unseqLabels: [], first: r, stop: Number(r['Stop']), base })
    } else {
      target.stop = Math.min(target.stop, Number(r['Stop']))
      target.rows.push(r)
    }
  }

  const unseqGroups: { first: InputRow; base: string; labels: string[] }[] = []
  unsequenced.forEach((r, i) => {
    const pseudoSeq = `${maxSeq + i + 1} (+${i + 1})`
    let addedToSeq = false
    let targetSeqGroup = groups.find(g => shouldMergeSameCanonicalAddress(g.first, r))
    if (targetSeqGroup) {
      targetSeqGroup.unseqLabels.push(pseudoSeq)
      addedToSeq = true
    }
    if (!addedToSeq) {
      let targetUnseqGroup = unseqGroups.find(g => shouldMergeSameCanonicalAddress(g.first, r))
      if (targetUnseqGroup) {
        targetUnseqGroup.labels.push(pseudoSeq)
      } else {
        const [base] = splitAddr(String(r['Destination Address'] ?? ''))
        unseqGroups.push({ first: r, base, labels: [pseudoSeq] })
      }
    }
  })

  const out: OutputRow[] = []
  unseqGroups.forEach((g) => {
    const [base] = splitAddr(String(g.first['Destination Address'] ?? ''))
    out.push({
      'AT ID': (g.first['AT ID'] as string | number) ?? '',
      'Destination Address': expandAddress(base),
      'Bairro': String(g.first['Bairro'] ?? ''),
      'City': String(g.first['City'] ?? ''),
      'Zipcode/Postal code': String(g.first['Zipcode/Postal code'] ?? ''),
      'Latitude': (g.first['Latitude'] as string | number) ?? '0',
      'Longitude': (g.first['Longitude'] as string | number) ?? '0',
      'Address Line 2': String(g.first['Address Line 2'] ?? ''),
      'Pacotes na Parada': g.labels.join(', '),
    })
  })

  groups.sort((a, b) => a.stop - b.stop).forEach((g) => {
    const f = g.first
    const allNums = [...g.rows.map((r) => String(r['Sequence'])), ...g.unseqLabels].join(', ')
    out.push({
      'AT ID': (f['AT ID'] as string | number) ?? '',
      'Destination Address': expandAddress(g.base),
      'Bairro': String(f['Bairro'] ?? ''),
      'City': String(f['City'] ?? ''),
      'Zipcode/Postal code': String(f['Zipcode/Postal code'] ?? ''),
      'Latitude': (f['Latitude'] as string | number) ?? '0',
      'Longitude': (f['Longitude'] as string | number) ?? '0',
      'Address Line 2': String(f['Address Line 2'] ?? ''),
      'Pacotes na Parada': allNums,
    })
  })

  return { out, unsequencedCount: unsequenced.length, qualityStats: stats }
}
