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

export interface TransformResult {
  out: OutputRow[]
  unsequencedCount: number
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

function getGroupingKey(r: InputRow): string {
  const rawAddr = String(r['Destination Address'] ?? '')
  
  // 1. Aplica correções estruturais
  let addr = rawAddr
  if (ADDR_CORR[rawAddr]) {
    addr = ADDR_CORR[rawAddr]
  }

  // 2. Normalização de texto
  let clean = addr.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  // 3. Expansão massiva
  clean = expandAbbreviations(clean)

  // 3.5 Remoção de conectores e espaços extras para chave robusta
  clean = clean.replace(/\b(de|do|da|dos|das|e)\b/g, ' ')
               .replace(/\s+/g, ' ')
               .trim()

  // 4. Extração estrutural de Rua + Número
  // Normalizamos separadores para espaços para facilitar a extração
  const normalizedAddr = clean.replace(/[,\-\/\.]/g, ' ')
  
  // Busca pelo padrão "nome da rua + numero"
  const match = normalizedAddr.match(/(.+?)\s+(\d+)\b/)
  
  let streetKey = ''
  let numKey = ''

  if (match) {
    streetKey = match[1].replace(/[^a-z0-9]/g, '')
    numKey = match[2]
  } else {
    // Fallback: se não achar o padrão, usa a string limpa inteira
    return normalizedAddr.replace(/[^a-z0-9]/g, '')
  }

  // 5. Adição de Confluência por Coordenadas (Região aproximada)
  const latValue = r['Latitude'] || r['latitude'] || 0
  const lonValue = r['Longitude'] || r['longitude'] || 0
  const lat = Math.round(safeParseNumber(latValue) * 100) 
  const lon = Math.round(safeParseNumber(lonValue) * 100)
  
  return `${streetKey}_${numKey}_${lat}_${lon}`
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
  onRowProcessed?: (res: ProcessedRowResult) => void
): Promise<TransformResult> {
  // 0. Pré-processamento removido (Google Only)

  /**
   * Padroniza o endereço original da planilha
   */
  const getCorrectedAddr = (r: InputRow) => {
    const originalAddr = String(r['Destination Address'] ?? '').trim()
    return standardizeAddress(originalAddr)
  }

  // 1. Identificar todas as queries únicas e frequências de coordenadas

  // 1. Identificar todas as queries únicas e frequências de coordenadas
  const coordsFrequency = new Map<string, number>()
  rows.forEach(r => {
    const coordKey = `${r['Latitude']}_${r['Longitude']}`
    if (r['Latitude'] && r['Longitude']) {
      coordsFrequency.set(coordKey, (coordsFrequency.get(coordKey) || 0) + 1)
    }
  })

  // 2. Processar cada linha com a estratégia Âncora Postal
  let enrichedRows = await Promise.all(rows.map(async (r, rowIndex) => {
    const updatedRow = { ...r }
    const originalAddr = String(r['Destination Address'] ?? '').trim()
    const originalBairro = String(r['Bairro'] ?? '').trim()
    const originalZip = String(r['Zipcode/Postal code'] ?? '').replace(/\D/g, '')
    const originalCity = String(r['City'] ?? '').trim()
    const oldLat = safeParseNumber(r['Latitude'] || r['latitude'] || 0)
    const oldLng = safeParseNumber(r['Longitude'] || r['longitude'] || 0)
    
    const coordKey = `${oldLat}_${oldLng}`
    const freq = coordsFrequency.get(coordKey) || 0
    const isGeneric = (oldLat === 0 && oldLng === 0) || freq > 1

    const houseNum = extractHouseNumber(originalAddr)
    
    // --- BUSCA CIRÚRGICA (Sincronização de Endereço/Coordenada) ---
    // Enviamos apenas Logradouro + Número + Cidade para evitar o viés de dados antigos
    const inputQuery = getSurgicalQuery(originalAddr, originalCity)
    
    // --- MODO ESPELHO GOOGLE: TENTATIVA 1 (Busca Direta por Texto) ---
    // Simulando o "copiar e colar" manual
    let newCoords = await fetchCoords(inputQuery, originalCity, isGeneric, oldLat !== 0 ? oldLat : undefined, oldLng !== 0 ? oldLng : undefined)
    let usedQuery = inputQuery

    // --- PASSO B: ANCORAGEM POSTAL (Fallback se não for ROOFTOP) ---
    if (!newCoords || newCoords.location_type !== 'ROOFTOP') {
        let officialStreet = ''
        if (originalZip && originalZip.length >= 8) {
          const zipRes = await fetchCoords(originalZip, originalCity, false)
          if (zipRes && zipRes.street) {
             officialStreet = zipRes.street.trim()
          }
        }

        if (officialStreet && houseNum) {
           const surgicalQuery = `${officialStreet}, ${houseNum}, ${originalCity}, Brazil`
           const secondTry = await fetchCoords(surgicalQuery, originalCity, isGeneric)
           
           if (secondTry && (secondTry.location_type === 'ROOFTOP' || !newCoords)) {
              newCoords = secondTry
              usedQuery = surgicalQuery
           }
        }
    }

    let newLat = oldLat
    let newLng = oldLng

    if (newCoords) {
      newLat = newCoords.lat
      newLng = newCoords.lng
      const isRooftop = newCoords.location_type === 'ROOFTOP'
      const isInterpolated = newCoords.location_type === 'RANGE_INTERPOLATED'
      const googleAddr = (newCoords.formatted_address || '').toLowerCase()
      const searchStreetBody = normalizeStreetBody(usedQuery)

      // HIERARQUIA DE CONFIANÇA (PRECISION GUARD)
      const isHighPrecision = isRooftop || isInterpolated
      const googleCity = String(newCoords.city ?? '').toLowerCase()
      
      const normGoogleAddr = normalizeForMatch(googleAddr)
      const normOrigCity = normalizeForMatch(originalCity)
      const normGoogleCity = normalizeForMatch(googleCity)
      
      const isSameRegion = normGoogleAddr.includes(normOrigCity) || normGoogleAddr.includes(normGoogleCity)

      // CÁLCULO DE DISTÂNCIA E TRAVA DE 150m
      const dist = getDistance(oldLat, oldLng, newLat, newLng)
      const isWithinLimit = isGeneric || dist <= 0.15 // 0.15km = 150 metros

      // PRECISION GUARD REFINADO
      const shouldUpdate = isHighPrecision && isSameRegion && isWithinLimit

      if (shouldUpdate) {
        // ATUALIZAÇÃO E FORMATAÇÃO BRASILEIRA (VÍRGULA)
        const formattedLat = formatBrazilianCoord(newLat)
        const formattedLng = formatBrazilianCoord(newLng)
        
        updatedRow['Latitude'] = formattedLat
        updatedRow['Longitude'] = formattedLng

        // PADRONIZAÇÃO AUTOMÁTICA E LIMPEZA DE PREFIXOS
        const googleStreet = cleanStreetName(newCoords.street || '')
        if (isRooftop && googleStreet && houseNum) {
           updatedRow['Destination Address'] = `${googleStreet}, ${houseNum}`
        } else if (isRooftop && newCoords.formatted_address) {
           updatedRow['Destination Address'] = cleanStreetName(newCoords.formatted_address.split(' - ')[0].split(', Florianópolis')[0].trim())
        } else {
           updatedRow['Destination Address'] = originalAddr
        }

        // LÓGICA DE METADADOS CONSERVADORA (NÃO ALTERAR CASO SEJA VÁLIDO)
        const normZ = (z: string) => (z || '').replace(/\D/g, '')
        const origZ = normZ(originalZip)
        const foundZ = normZ(newCoords.postal_code || '')
        
        // Se o CEP original for válido (8 dígitos) e pertencer à mesma zona, mantemos o original
        const keepOriginalZip = origZ.length === 8 && foundZ.startsWith(origZ.substring(0, 5))
        
        if (newCoords.neighborhood) {
          // Mantém o bairro original se estiver dentro do limite de 150m e não estiver vazio
          const keepOriginalBairro = originalBairro && dist <= 0.15
          if (!keepOriginalBairro) {
            updatedRow['Bairro'] = newCoords.neighborhood
          }
        }
        
        if (newCoords.city) updatedRow['City'] = newCoords.city
        
        if (newCoords.postal_code && !keepOriginalZip) {
          updatedRow['Zipcode/Postal code'] = newCoords.postal_code
        }
        
        console.log(`Mirror Mode: ${originalAddr} -> ${updatedRow['Destination Address']} (${newCoords.location_type})`)
      } 
      else if (isGeneric && isSameRegion && normalizeForMatch(googleAddr).includes(normalizeForMatch(searchStreetBody))) {
        updatedRow['Latitude'] = formatBrazilianCoord(newLat)
        updatedRow['Longitude'] = formatBrazilianCoord(newLng)
      }
    }
    // SINALIZAÇÃO PARA A UI (MODO ESPELHO)
    if (onRowProcessed) {
      const norm = (s: string) => (s || '').replace(/\D/g, '')
      const bChanged = !!(newCoords && newCoords.neighborhood && newCoords.neighborhood !== originalBairro)
      const zChanged = !!(newCoords && newCoords.postal_code && norm(newCoords.postal_code) !== norm(originalZip))
      const cChanged = !!(newCoords && (Math.abs(newLat - oldLat) > 0.0001 || Math.abs(newLng - oldLng) > 0.0001))
      const aChanged = !!(newCoords && updatedRow['Destination Address'] !== originalAddr)

      onRowProcessed({
        index: rowIndex,
        status: newCoords?.location_type || 'ERROR',
        error: newCoords ? undefined : 'Não encontrado',
        original: {
          address: originalAddr,
          bairro: originalBairro,
          zip: originalZip,
          lat: oldLat,
          lng: oldLng
        },
        found: {
          address: String(updatedRow['Destination Address'] || originalAddr),
          bairro: String(updatedRow['Bairro'] || originalBairro),
          zip: String(updatedRow['Zipcode/Postal code'] || originalZip),
          lat: newLat,
          lng: newLng,
          precision: newCoords?.location_type || 'NONE'
        },
        changed: {
          address: aChanged,
          bairro: bChanged,
          zip: zChanged,
          coords: cChanged
        }
      })
    }

    return updatedRow
  }))

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
  const groups = new Map<string, Group>()
  const order: string[] = []

  for (const r of sequenced) {
    const key = getGroupingKey(r)
    const [base] = splitAddr(String(r['Destination Address'] ?? ''))
    
    if (!groups.has(key)) {
      groups.set(key, { rows: [], unseqLabels: [], first: r, stop: Number(r['Stop']), base })
      order.push(key)
    } else {
      groups.get(key)!.stop = Math.min(groups.get(key)!.stop, Number(r['Stop']))
    }
    groups.get(key)!.rows.push(r)
  }

  // 2) Agrupar Não-Sequenciados (Manuais) e Mesclar
  type UnseqGroup = { first: InputRow; base: string; labels: string[] }
  const unseqGroups = new Map<string, UnseqGroup>()
  const unseqOrder: string[] = []

  unsequenced.forEach((r, i) => {
    const key = getGroupingKey(r)
    const pseudoSeq = `${maxSeq + i + 1} (+${i + 1})`

    if (groups.has(key)) {
      groups.get(key)!.unseqLabels.push(pseudoSeq)
    } else {
      if (!unseqGroups.has(key)) {
        const [base] = splitAddr(String(r['Destination Address'] ?? ''))
        unseqGroups.set(key, { first: r, base, labels: [] })
        unseqOrder.push(key)
      }
      unseqGroups.get(key)!.labels.push(pseudoSeq)
    }
  })

  const out: OutputRow[] = []

  // 3. Processar Grupos Manuais puros
  unseqOrder.forEach((key) => {
    const g = unseqGroups.get(key)!
    const [base, line2] = splitAddr(String(g.first['Destination Address'] ?? ''))
    out.push({
      'AT ID': (g.first['AT ID'] as string | number) ?? '',
      'Destination Address': expandAddress(base),
      'Bairro': String(g.first['Bairro'] ?? ''),
      'City': String(g.first['City'] ?? ''),
      'Zipcode/Postal code': String(g.first['Zipcode/Postal code'] ?? ''),
      'Latitude': (g.first['Latitude'] as string | number) ?? '0',
      'Longitude': (g.first['Longitude'] as string | number) ?? '0',
      'Address Line 2': String(line2 || ''),
      'Pacotes na Parada': g.labels.join(', '),
    })
  })

  // 4. Processar Grupos Sequenciados com mesclagem
  ;[...order]
    .sort((a, b) => groups.get(a)!.stop - groups.get(b)!.stop)
    .forEach((key) => {
      const g = groups.get(key)!
      const f = g.first
      const [, line2] = splitAddr(String(g.rows[0]['Destination Address'] ?? ''))
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
        'Address Line 2': String(line2 || ''),
        'Pacotes na Parada': allNums,
      })
    })

  return { out, unsequencedCount: unsequenced.length }
}

