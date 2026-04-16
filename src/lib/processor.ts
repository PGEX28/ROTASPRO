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
  
  // Normalizações específicas de meio de string
  const inlineExpansions: [RegExp, string][] = [
    [/\bN\s*Sra\b/i, 'Nossa Senhora'],
    [/\bPe\.\b/i, 'Padre'],
    [/\bProf\.\b/i, 'Professor'],
    [/\bDr\.\b/i, 'Doutor'],
  ]

  // Aplica expansão de prefixo NO INÍCIO apenas se não houver um prefixo forte já presente
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

/**
 * Limpa nomes de ruas vindos do Google para evitar redundâncias como "Rua Servidão"
 */
function cleanStreetName(name: string): string {
  if (!name) return ''
  let clean = name.trim()
  
  // Se começar com "Rua Servidão" ou "Rua Avenida", remove o "Rua"
  if (/^rua\s+(servidão|servidao|avenida|travessa|rodovia|estrada|alameda|praça|praca)\b/i.test(clean)) {
    clean = clean.replace(/^rua\s+/i, '')
  }
  
  return clean
}

/**
 * Remove prefixos (Rua, Servidão, etc) para comparação de nomes "nus"
 */
function getCoreName(addr: string): string {
  let core = addr.toLowerCase()
                 .normalize('NFD')
                 .replace(/[\u0300-\u036f]/g, '')
                 .split(',')[0] // Pega só antes da vírgula
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

/**
 * Separa o endereço base do complemento.
 */
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

/**
 * Gera uma chave única focada APENAS em Logradouro e Número.
 * Aplica correções de ADDR_CORR e expansões antes de gerar a chave.
 */
/**
 * Expande abreviações comuns para nomes oficiais e completos
 */
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

/**
 * Converte strings com vírgula (Brasil) em números válidos (JS).
 */
function safeParseNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const clean = String(val).replace(',', '.').trim()
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

/**
 * Converte números (JS) em strings com vírgula (Brasil).
 */
function formatBrazilianCoord(val: number): string {
  if (!val) return '0'
  return String(val).replace('.', ',')
}

/**
 * Valida se as coordenadas da planilha são reais (não nulas, não zero).
 * Usa safeParseNumber para lidar com formato brasileiro (vírgula).
 */
function isValidCoordinate(lat: any, lng: any): boolean {
  const latNum = safeParseNumber(lat)
  const lngNum = safeParseNumber(lng)

  if (latNum === 0 && lngNum === 0) return false

  return latNum >= -90 && latNum <= 90 &&
         lngNum >= -180 && lngNum <= 180
}

function fuzzyStreetSignature(s: string): string {
  let clean = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(rua|servidao|avenida|al|travessa|rodovia|rotula|praca|estrada|loteamento)\b/gi, '')
    .replace(/\b(de|do|da|dos|das|e)\b/gi, '')
    
  // --- Tabela Fonética Avançada ---
  clean = clean
    .replace(/z/g, 's')
    .replace(/x/g, 's')
    .replace(/j/g, 'g')
    .replace(/ch/g, 's')
    .replace(/y/g, 'i')
    .replace(/h/g, '')
    .replace(/[aeiou]/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()

  let words = clean.split(/\s+/).filter(w => w.length > 0)
  
  // --- Estratégia Âncora (V10.0 Atômica) ---
  // Se houver mais de 2 palavras, mantém apenas a primeira e a última para ignorar nomes do meio/iniciais
  if (words.length >= 2) {
    words = [words[0], words[words.length - 1]]
  }
  
  return words.join('')
    .replace(/(.)\1+/g, '$1') // Remove letras duplicadas
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

  // 1. StreetCore igual (mandatório)
  if (p1.street !== p2.street) return false

  // 2. Verifica ausência de número (sn) de algum dos lados
  const isSn1 = !p1.num || p1.num === 'sn'
  const isSn2 = !p2.num || p2.num === 'sn'
  
  if (isSn1 || isSn2) {
    // Quando ausente: não usa regra de lat/lng para tentar agrupar. É conservador e exige igualdade.
    return p1.num === p2.num
  }

  // 3. numberKey deve bater.
  if (p1.num !== p2.num) return false

  // 4. Street & Number bateram! Checamos os 10m de tolerância local como confirmação final para evitar agrupamento equivocado.
  const lat1 = safeParseNumber(a['Latitude'])
  const lng1 = safeParseNumber(a['Longitude'])
  const lat2 = safeParseNumber(b['Latitude'])
  const lng2 = safeParseNumber(b['Longitude'])

  // Se um dos lados não tiver coord válida para checar, mas for validado na rua e número, funde.
  if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
    return true
  }

  const distM = getDistance(lat1, lng1, lat2, lng2) * 1000
  return distM <= 10
}


/**
 * Constrói uma query "cirúrgica" focada apenas no local exato, sem bairro ou cep viciados.
 */
function getSurgicalQuery(address: string, city: string): string {
  if (!address) return ''
  
  // 1. Expansão do Claude
  const expanded = expandAddress(address)
  
  // 2. Limpeza de ruído
  const clean = expanded.replace(/ - .*/, '').trim()

  // 3. Extração de Rua + Número
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
    const data = await res.json()
    return { 
      lat: data.lat, 
      lng: data.lng,
      formatted_address: data.formatted_address,
      location_type: data.location_type,
      street: data.street,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      postal_code: data.postal_code
    }
  } catch {
    return null
  }
}

/**
 * Calcula a distância entre dois pontos (Haversine) em km
 */
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
    .replace(/[aeiou]/gi, '') // Matching Consonantal: ignora vogais para evitar erro O vs U
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Extrai o número da casa de forma limpa, removendo zeros à esquerda e prefixos.
 */
function extractHouseNumber(addr: string): string {
  const match = addr.match(/,\s*(?:nº|n°|num|no)?\s*0*(\d+)/i) || addr.match(/\s+0*(\d+)\b/)
  return match ? match[1] : ''
}

/**
 * Valida se o retorno do Google corresponde ao endereço original.
 * Compara o corpo da rua (sem prefixos) e o número da casa.
 * Reutiliza getCoreName que já faz strip de Rua/Servidão/etc.
 */
function isAddressMatch(inputAddress: string, googleStreet: string): boolean {
  if (!googleStreet) return false

  const inputCore = getCoreName(inputAddress)
  const googleCore = getCoreName(googleStreet)

  // Se um dos cores for vazio, não dá pra validar
  if (!inputCore || !googleCore) return false

  // Verifica se o corpo do nome da rua do Google aparece no input (ou vice-versa)
  // Ex: input "florst" (floresta) deve incluir googleCore "florst"
  const inputNum = extractHouseNumber(inputAddress)
  const googleNum = extractHouseNumber(googleStreet)

  // Rua precisa bater (um contido no outro)
  const streetMatch = inputCore.includes(googleCore) || googleCore.includes(inputCore)

  // Número: se ambos existem, precisam ser iguais
  const numberMatch = (!inputNum || !googleNum) ? true : inputNum === googleNum

  return streetMatch && numberMatch
}

type AuditMatchResponse = {
  matched: boolean
  reason: string
}

function isShopeeAuditMatch(inputAddress: string, googleStreet: string, inputNumber: string, googleNumber: string): AuditMatchResponse {
  if (!googleStreet) return { matched: false, reason: 'EMPTY_GOOGLE_STREET' }

  const inputCore = getCoreName(inputAddress)
  const googleCore = getCoreName(googleStreet)

  if (!inputCore || !googleCore) return { matched: false, reason: 'EMPTY_STREET_CORE' }

  const streetMatch = inputCore.includes(googleCore) || googleCore.includes(inputCore)
  if (!streetMatch) return { matched: false, reason: 'STREET_MISMATCH' }

  // Street matched. Let's check number.
  if (!inputNumber && !googleNumber) return { matched: true, reason: 'MATCH_STREET_ONLY' }
  if (inputNumber && !googleNumber) return { matched: true, reason: 'MATCH_STREET_ONLY' }
  if (!inputNumber && googleNumber) return { matched: true, reason: 'MATCH_STREET_ONLY' }
  
  if (inputNumber === googleNumber) return { matched: true, reason: 'MATCH_STREET_AND_NUMBER' }

  return { matched: false, reason: 'NUMBER_MISMATCH' }
}

/**
 * Gera variações do endereço para retry progressivo no geocoding.
 * Cada variante é uma tentativa diferente de encontrar o ponto no Google.
 */
function buildAddressVariants(surgicalQuery: string, base: string, city: string): string[] {
  const variants = [surgicalQuery]

  // Variante 2: endereço sem número (fallback para pelo menos achar a rua)
  const noNumber = base.replace(/,\s*\d+.*$/, '').trim()
  if (noNumber !== base) {
    variants.push(`${noNumber}, ${city}, SC, Brasil`)
  }

  return variants
}

/**
 * Variantes específicas para Auditoria Shopee: 
 * Mantém no máximo 3 querries: ultralivre (SurgicalQuery atual), base limpa e base sem número.
 */
function buildShopeeAuditVariants(surgicalQuery: string, base: string, city: string): string[] {
  const v1 = surgicalQuery

  const cleaned = standardizeAddress(base)
  const v2 = `${cleaned}, ${city}`

  const noNumber = cleaned.replace(/(,\s*\d+|\s+n\s*\d+|\s+\d+).*$/i, '').trim()
  const v3 = noNumber !== cleaned ? `${noNumber}, ${city}` : ''

  // Usamos array form para deduplicar e limpa variações sem número q fiquem vazias
  const unique = Array.from(new Set([v1, v2, v3])).filter(Boolean)
  return unique.slice(0, 3)
}

/**
 * Score de confiança baseado na fonte e tipo de precisão.
 */
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

type CoordResult = { lat: number; lng: number; confidence: number; source: string; location_type: string }

function pickBestCoordinates(current: CoordResult | null, candidate: CoordResult | null): CoordResult | null {
  if (!current || !current.lat) return candidate
  if (!candidate || !candidate.lat) return current
  return candidate.confidence > current.confidence ? candidate : current
}

/**
 * Classifica risco de desvio por distância entre coordenada Shopee e Google.
 */
function classifyDistanceRisk(distanceKm: number): 'OK' | 'SUSPECT' | 'INVALID' {
  if (distanceKm > 2) return 'INVALID'
  if (distanceKm > 0.2) return 'SUSPECT'
  return 'OK'
}

/**
 * Normaliza o nome da rua para comparação (remove Rua, Servidão, etc)
 */
function normalizeStreetBody(name: string): string {
  const clean = normalizeForMatch(name)
  return clean
    .replace(/^(rua|servidao|srv|avenida|av|travessa|rodovia|rod|praca)\.?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}


/**
 * Padroniza o endereço para um formato limpo que o Google Maps entende melhor
 */
function standardizeAddress(address: string): string {
  let clean = expandAbbreviations(address.trim())
    
    // 1. Limpeza de ruídos e formatação de número
    .replace(/\s+n[:º°]?\s*(\d+)/i, ', $1') // " n: 123" -> ", 123"
    .replace(/,\s+/g, ', ') // Padroniza vírgula existente

  // Se não houver vírgula mas houver um número no final, adiciona a vírgula
  // Ex: "Rua X 10" -> "Rua X, 10"
  if (!clean.includes(',') && /[a-z\s]+\s+\d+/i.test(clean)) {
    clean = clean.replace(/([a-z\s]+)\s+(\d+.*)$/i, '$1, $2')
  }

  // Remove complementos agressivamente para focar no ponto do geocodificador
  // Remove "Casa", "Lote", "Fundo", "Frente", etc que estejam APÓS o número
  clean = clean.replace(/(,\s*\d+)\s*(casa|fundo|frente|ap|bloco|sala|loja|lote|quadra|qd|lt).*/i, '$1')
    
  return clean
}

export async function transformRows(
  rows: InputRow[], 
  onProgress?: (percent: number) => void
): Promise<TransformResult> {
  const BATCH_SIZE = 10 // Processar 10 endereços por vez
  const MAX_SHOPEE_AUDIT = 20 // Auditar no máximo 20 coordenadas Shopee por processamento
  let processedCount = 0
  let shopeeAuditCount = 0

  // Contadores de qualidade
  const stats: QualityStats = {
    totalRows: rows.length,
    shopeeCount: 0, cacheCount: 0, googleCount: 0, noneCount: 0,
    highCount: 0, mediumCount: 0, lowCount: 0,
    suspectDistanceCount: 0, invalidDistanceCount: 0,
    rooftopCount: 0, interpolatedCount: 0,
    shopeeAuditCheckedCount: 0, shopeeAuditOkCount: 0,
    shopeeAuditSuspectCount: 0, shopeeAuditInvalidCount: 0,
    shopeeAuditNoReferenceCount: 0,
    
    // Novas vars 
    persistentHitCount: 0, persistentHighCount: 0, 
    persistentSuspectCount: 0, persistentInvalidCount: 0
  }
  const enrichedRows: InputRow[] = []

  // Baixar dicionário de correções do Admin 
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

  // 1. Processamento Assíncrono com Google API
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const processedBatch = await Promise.all(batch.map(async (r) => {
      const updatedRow = { ...r }
      const originalAddr = String(r['Destination Address'] ?? '').trim()
      const city = String(r['City'] ?? 'Florianópolis')
      const hintLat = safeParseNumber(r['Latitude'])
      const hintLng = safeParseNumber(r['Longitude'])

      // Extraímos o complemento se existir para manter a estrutura da planilha
      const [base, origLine2] = splitAddr(originalAddr)
      updatedRow['Address Line 2'] = origLine2 || ''

      // --- DECISÃO DE MELHOR COORDENADA ---
      let best: CoordResult | null = null

      let addressHash = ''
      try {
         addressHash = btoa(unescape(encodeURIComponent(base.toLowerCase().trim() + ' | ' + city.toLowerCase().trim())))
      } catch (e) {
         // default ignora falha utf8 enc
      }
      
      const persistentCorr = correctionsMap.get(addressHash)

      if (persistentCorr) {
         best = {
           lat: persistentCorr.corrected_lat,
           lng: persistentCorr.corrected_lng,
           confidence: persistentCorr.confidence || 100,
           source: 'PERSISTENT',
           location_type: 'ROOFTOP' // Override absoluto pro motor Google
         }
         
         updatedRow['_persistent_hit'] = true
         updatedRow['_persistent_id'] = persistentCorr.id
         updatedRow['_persistent_confidence'] = persistentCorr.confidence || 100
         updatedRow['_persistent_source'] = 'ADMIN_DB'
         stats.persistentHitCount++
         if (best.confidence >= 90) stats.persistentHighCount++
         
         // Auditar a própria correção! Se o user botou na Shopee mas o master Admin DB 
         // diz lat/long mto diferentes (acima de 1km), significa q a correcao ta esquisita.
         if (isValidCoordinate(r['Latitude'], r['Longitude'])) {
            const hitDist = getDistance(best.lat, best.lng, hintLat, hintLng)
            if (hitDist > 1.5) {
               updatedRow['_persistent_risk'] = 'INVALID'
               stats.persistentInvalidCount++
            } else if (hitDist > 0.2) {
               updatedRow['_persistent_risk'] = 'SUSPECT'
               stats.persistentSuspectCount++
            } else {
               updatedRow['_persistent_risk'] = 'OK'
            }
         }
      } else if (isValidCoordinate(r['Latitude'], r['Longitude'])) {
        best = {
          lat: hintLat,
          lng: hintLng,
          confidence: getConfidenceScore(undefined, 'SHOPEE'),
          source: 'SHOPEE',
          location_type: 'SHOPEE_ORIGINAL',
        }


        // --- AUDITORIA SHOPEE (não substitui, apenas mede) ---
        if (shopeeAuditCount < MAX_SHOPEE_AUDIT) {
          shopeeAuditCount++
          stats.shopeeAuditCheckedCount++
          updatedRow['_shopee_audit_checked'] = true

          try {
            const surgicalQuery = getSurgicalQuery(base, city)
            const auditVariants = buildShopeeAuditVariants(surgicalQuery, base, city)
            let auditGeo = null
            let lastRejectionReason = 'GOOGLE_EMPTY_RESULTS'
            let auditGeometricCenterGeo = null

            for (const variant of auditVariants) {
              const candidate = await fetchCoords(variant, city, false, hintLat, hintLng)
              if (!candidate) continue

              const locType = candidate.location_type || ''
              
              if (locType === 'GEOMETRIC_CENTER' && !auditGeometricCenterGeo) {
                 auditGeometricCenterGeo = { ...candidate, variantUsed: variant }
              }

              if (locType === 'ROOFTOP' || locType === 'RANGE_INTERPOLATED') {
                const inputNum = extractHouseNumber(base)
                const googleNum = extractHouseNumber(candidate.street || candidate.formatted_address || '')
                
                const matchResult = isShopeeAuditMatch(base, candidate.street || '', inputNum, googleNum)
                
                if (matchResult.matched) {
                  auditGeo = { ...candidate, variantUsed: variant, matchReason: matchResult.reason }
                  break
                } else {
                  lastRejectionReason = matchResult.reason
                }
              } else {
                lastRejectionReason = 'INVALID_LOCATION_TYPE'
              }
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
              updatedRow['_shopee_audit_variant_used'] = auditGeo.variantUsed
              updatedRow['_shopee_audit_google_street'] = auditGeo.street || ''
              updatedRow['_shopee_audit_google_number'] = extractHouseNumber(auditGeo.street || auditGeo.formatted_address || '') || ''
              updatedRow['_shopee_audit_google_formatted_address'] = auditGeo.formatted_address || ''
              updatedRow['_shopee_audit_match_reason'] = auditGeo.matchReason || ''

              if (risk === 'OK') stats.shopeeAuditOkCount++
              else if (risk === 'SUSPECT') stats.shopeeAuditSuspectCount++
              else if (risk === 'INVALID') stats.shopeeAuditInvalidCount++

              // Salvar no cache para que próximas linhas com mesmo endereço não gastem API
              const cacheKey = normalizeCacheKey(auditGeo.variantUsed)
              geocodeCache.set(cacheKey, {
                lat: auditGeo.lat, lng: auditGeo.lng,
                location_type: auditGeo.location_type || 'UNKNOWN',
                street: auditGeo.street,
                formatted_address: auditGeo.formatted_address,
                neighborhood: auditGeo.neighborhood,
                postal_code: auditGeo.postal_code,
              })
            } else {
              updatedRow['_shopee_audit_match'] = false
              updatedRow['_shopee_audit_risk'] = 'NO_REFERENCE'
              
              let failReason = lastRejectionReason + '_ALL_VARIANTS'
              if (lastRejectionReason === 'GOOGLE_EMPTY_RESULTS') failReason = 'NO_USABLE_REFERENCE_FOUND'
              if (lastRejectionReason === 'INVALID_LOCATION_TYPE') failReason = 'INVALID_LOCATION_TYPE_ALL_VARIANTS'
              
              updatedRow['_shopee_audit_rejection_reason'] = failReason
              
              if (auditGeometricCenterGeo) {
                updatedRow['_shopee_audit_location_type'] = 'GEOMETRIC_CENTER'
                updatedRow['_shopee_audit_variant_used'] = auditGeometricCenterGeo.variantUsed
              }

              stats.shopeeAuditNoReferenceCount++
            }
          } catch (e: any) {
            updatedRow['_shopee_audit_checked'] = false
            updatedRow['_shopee_audit_risk'] = 'NO_REFERENCE'
            updatedRow['_shopee_audit_rejection_reason'] = 'EXCEPTION_IN_AUDIT'
            stats.shopeeAuditNoReferenceCount++
          }
        } else {
          updatedRow['_shopee_audit_checked'] = false
        }
      } else {
        // Sem coordenadas válidas — verificar cache local antes de chamar Google
        const surgicalQuery = getSurgicalQuery(base, city)
        const cacheKey = normalizeCacheKey(surgicalQuery)

        const cached = geocodeCache.get(cacheKey)
        if (cached) {
          // CACHE HIT
          const cacheResult: CoordResult = {
            lat: cached.lat,
            lng: cached.lng,
            confidence: getConfidenceScore(cached.location_type, 'CACHE'),
            source: 'CACHE',
            location_type: cached.location_type,
          }
          best = pickBestCoordinates(best, cacheResult)

          updatedRow['Bairro'] = cached.neighborhood || updatedRow['Bairro']
          updatedRow['Zipcode/Postal code'] = cached.postal_code || updatedRow['Zipcode/Postal code']
          if (cached.street && cached.formatted_address) {
            const houseNum = extractHouseNumber(cached.formatted_address) || extractHouseNumber(base)
            if (houseNum) {
              updatedRow['Destination Address'] = `${cleanStreetName(cached.street)}, ${houseNum}`
            }
          }
        } else {
          // CACHE MISS — retry inteligente com variantes de endereço
          const variants = buildAddressVariants(surgicalQuery, base, city)

          for (const variant of variants) {
            if (best && best.confidence >= 95) break // Já temos ROOFTOP, para

            const geo = await fetchCoords(variant, city, false, hintLat, hintLng)

            if (geo && (geo.location_type === 'ROOFTOP' || geo.location_type === 'RANGE_INTERPOLATED')) {
              const addressValid = isAddressMatch(base, geo.street || '')

              if (addressValid) {
                // DISTANCE CHECK: rejeitar Google se estiver >2km do hint Shopee
                let distRisk: 'OK' | 'SUSPECT' | 'INVALID' | null = null
                if (isValidCoordinate(hintLat, hintLng)) {
                  const dKm = getDistance(hintLat, hintLng, geo.lat, geo.lng)
                  distRisk = classifyDistanceRisk(dKm)
                  updatedRow['_distance_km'] = Math.round(dKm * 1000) / 1000
                  updatedRow['_distance_risk'] = distRisk
                  if (distRisk === 'SUSPECT') stats.suspectDistanceCount++
                  if (distRisk === 'INVALID') stats.invalidDistanceCount++
                }

                // Só aceita o Google se a distância for OK ou SUSPECT (não INVALID)
                if (distRisk !== 'INVALID') {
                  const googleResult: CoordResult = {
                    lat: geo.lat,
                    lng: geo.lng,
                    confidence: getConfidenceScore(geo.location_type, 'GOOGLE'),
                    source: 'GOOGLE',
                    location_type: geo.location_type,
                  }
                  best = pickBestCoordinates(best, googleResult)

                  if (geo.location_type === 'ROOFTOP') stats.rooftopCount++
                  if (geo.location_type === 'RANGE_INTERPOLATED') stats.interpolatedCount++

                  // Salvar no cache local para reuso
                  geocodeCache.set(cacheKey, {
                    lat: geo.lat,
                    lng: geo.lng,
                    location_type: geo.location_type,
                    street: geo.street,
                    formatted_address: geo.formatted_address,
                    neighborhood: geo.neighborhood,
                    postal_code: geo.postal_code,
                  })

                  updatedRow['Bairro'] = geo.neighborhood || updatedRow['Bairro']
                  updatedRow['Zipcode/Postal code'] = geo.postal_code || updatedRow['Zipcode/Postal code']
                  
                  if (geo.street && geo.formatted_address) {
                    const houseNum = extractHouseNumber(geo.formatted_address) || extractHouseNumber(base)
                    if (houseNum) {
                      updatedRow['Destination Address'] = `${cleanStreetName(geo.street)}, ${houseNum}`
                    }
                  }
                }
                // Se INVALID, não aceita — mantém dados atuais
              }
            }
          }
        }
      }

      // Aplicar a melhor coordenada encontrada
      if (best) {
        updatedRow['Latitude'] = formatBrazilianCoord(best.lat)
        updatedRow['Longitude'] = formatBrazilianCoord(best.lng)
      }

      // Telemetria leve (campos internos — não aparecem no export do Circuit)
      const source = best?.source || 'NONE'
      const quality = mapQuality(best?.location_type, best?.source)
      updatedRow['_coordinate_source'] = source
      updatedRow['_quality'] = quality
      updatedRow['_confidence'] = best?.confidence || 0

      // Acumular contadores de qualidade
      if (source === 'SHOPEE') stats.shopeeCount++
      else if (source === 'CACHE') stats.cacheCount++
      else if (source === 'GOOGLE') stats.googleCount++
      else stats.noneCount++
      if (quality === 'HIGH') stats.highCount++
      else if (quality === 'MEDIUM') stats.mediumCount++
      else stats.lowCount++

      processedCount++
      if (onProgress) {
        onProgress((processedCount / rows.length) * 100)
      }

      return updatedRow
    }))
    enrichedRows.push(...processedBatch)
  }

  // 4. Ordenar a planilha final por CEP (Organização de Logística)
  enrichedRows.sort((a, b) => {
    const cepA = String(a['Zipcode/Postal code'] ?? '').replace(/\D/g, '')
    const cepB = String(b['Zipcode/Postal code'] ?? '').replace(/\D/g, '')
    return cepA.localeCompare(cepB)
  })


  const sequenced = enrichedRows.filter(
    (r) => r['Sequence'] !== '-' && r['Sequence'] != null && r['Stop'] !== '-'
  )
  const unsequenced = enrichedRows.filter(
    (r) => r['Sequence'] === '-' || r['Stop'] === '-'
  )

  const maxSeq =
    sequenced.length > 0
      ? Math.max(...sequenced.map((r) => Number(r['Sequence'])))
      : 0

  // 1) Agrupar Sequenciados
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

  // 2) Agrupar Não-Sequenciados (Manuais) e Mesclar
  type UnseqGroup = { first: InputRow; base: string; labels: string[] }
  const unseqGroups: UnseqGroup[] = []

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

  // 3. Processar Grupos Manuais puros
  unseqGroups.forEach((g) => {
    const originalLine2 = String(g.first['Address Line 2'] ?? '')
    const [base] = splitAddr(String(g.first['Destination Address'] ?? ''))
    out.push({
      'AT ID': (g.first['AT ID'] as string | number) ?? '',
      'Destination Address': expandAddress(base),
      'Bairro': String(g.first['Bairro'] ?? ''),
      'City': String(g.first['City'] ?? ''),
      'Zipcode/Postal code': String(g.first['Zipcode/Postal code'] ?? ''),
      'Latitude': (g.first['Latitude'] as string | number) ?? '0',
      'Longitude': (g.first['Longitude'] as string | number) ?? '0',
      'Address Line 2': originalLine2,
      'Pacotes na Parada': g.labels.join(', '),
    })
  })

  // 4. Processar Grupos Sequenciados com mesclagem
  ;[...groups]
    .sort((a, b) => a.stop - b.stop)
    .forEach((g) => {
      const f = g.first
      const originalLine2 = String(f['Address Line 2'] ?? '')
      const seqNums = g.rows.map((r) => String(r['Sequence']))
      const allNums = [...seqNums, ...g.unseqLabels].join(', ')
      out.push({
        'AT ID': (f['AT ID'] as string | number) ?? '',
        'Destination Address': expandAddress(g.base),
        'Bairro': String(f['Bairro'] ?? ''),
        'City': String(f['City'] ?? ''),
        'Zipcode/Postal code': String(f['Zipcode/Postal code'] ?? ''),
        'Latitude': (f['Latitude'] as string | number) ?? '0',
        'Longitude': (f['Longitude'] as string | number) ?? '0',
        'Address Line 2': originalLine2,
        'Pacotes na Parada': allNums,
      })
    })

  return { out, unsequencedCount: unsequenced.length, qualityStats: stats }
}

