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

export type OutputRow = {
  'AT ID': unknown
  'Destination Address': string
  'Bairro': unknown
  'City': unknown
  'Zipcode/Postal code': unknown
  'Latitude': unknown
  'Longitude': unknown
  'Address Line 2': string | null
  'Pacotes na Parada': string
}

export type TransformResult = {
  out: OutputRow[]
  unsequencedCount: number
}

/**
 * Expande abreviações para exibição final na planilha
 */
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

  for (const [pat, rep] of PREFIX_MAP) {
    if (pat.test(expanded)) { expanded = expanded.replace(pat, rep); break }
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
function getGroupingKey(r: InputRow): string {
  const rawAddr = String(r['Destination Address'] ?? '')
  
  // 1. Aplica correções estruturais (ex: Nereu Guizone -> Servidão Osnildo...)
  let addr = rawAddr
  if (ADDR_CORR[rawAddr]) {
    addr = ADDR_CORR[rawAddr]
  }

  // 2. Normalização de texto (remove acentos e converte para minúsculo)
  let clean = addr.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  // 3. Expansão massiva de abreviações para garantir correspondência de chaves
  const expansions: [RegExp, string][] = [
    [/\br[.\s]+/g, 'rua '],
    [/\bav[.\s]+/g, 'avenida '],
    [/\bsrv[.\s]+/g, 'servidao '],
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

  // 3.5 Remoção de conectores e espaços extras para chave robusta
  clean = clean.replace(/\b(de|do|da|dos|das|e)\b/g, ' ')
               .replace(/\s+/g, ' ')
               .trim()

  // 4. Extração estrutural de Rua + Número
  // Normalizamos separadores para espaços para facilitar a extração
  const normalizedAddr = clean.replace(/[,\-\/\.]/g, ' ')
  
  // Busca pelo padrão "nome da rua + numero"
  // (.+?) -> nome da rua (mínimo possível)
  // \s+ -> espaço(s)
  // (\d+) -> número
  // \b -> limite de palavra
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
  // Usamos coordenadas truncadas para diferenciar ruas homônimas em cidades diferentes
  // Multiplicar por 100 dá uma precisão de ~1.1km (nível de bairro)
  // Isso evita agrupar "Rua 1, 10" do Centro com "Rua 1, 10" do Campeche.
  const lat = Math.round(Number(r['Latitude'] || 0) * 100) 
  const lon = Math.round(Number(r['Longitude'] || 0) * 100)
  
  return `${streetKey}_${numKey}_${lat}_${lon}`
}



async function fetchCoords(address: string, city?: string, forceRefresh: boolean = false): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      body: JSON.stringify({ address, city, forceRefresh }),
      headers: { 'Content-Type': 'application/json' }
    })
    if (!res.ok) return null
    const data = await res.json()
    return { lat: data.lat, lng: data.lng }
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

export async function transformRows(rows: InputRow[]): Promise<TransformResult> {
  // Função auxiliar para construir o endereço completo para o Google
  const getFullQuery = (r: InputRow) => {
    const addr = String(r['Destination Address'] ?? '').trim()
    const bairro = String(r['Bairro'] ?? '').trim()
    const city = String(r['City'] ?? '').trim()
    // Filtramos partes vazias e adicionamos "Brazil" para forçar o país
    const parts = [addr, bairro, city, 'Brazil'].filter(p => p && p !== 'null' && p !== 'undefined')
    return parts.join(', ')
  }

  // 1. Identificar todas as queries únicas e frequências de coordenadas
  const coordsFrequency = new Map<string, number>()
  rows.forEach(r => {
    const coordKey = `${r['Latitude']}_${r['Longitude']}`
    if (r['Latitude'] && r['Longitude']) {
      coordsFrequency.set(coordKey, (coordsFrequency.get(coordKey) || 0) + 1)
    }
  })

  const queries = rows.map(r => ({
    originalAddr: String(r['Destination Address'] ?? ''),
    fullQuery: getFullQuery(r),
    city: String(r['City'] ?? '').trim()
  }))
  
  const queryToCity = new Map<string, string>()
  queries.forEach(q => queryToCity.set(q.fullQuery, q.city))
  
  const uniqueQueries = Array.from(new Set(queries.map(q => q.fullQuery)))
  
  // 2. Buscar coordenadas para todas as queries únicas (em paralelo)
  const coordsMap = new Map<string, { lat: number; lng: number }>()
  await Promise.all(uniqueQueries.map(async (query) => {
    const city = queryToCity.get(query)
    
    // Identificamos se qualquer linha associada a esta query tem coordenada compartilhada
    const associatedRows = rows.filter(r => getFullQuery(r) === query)
    const hasGenericSource = associatedRows.some(r => {
      const coordKey = `${r['Latitude']}_${r['Longitude']}`
      return (coordsFrequency.get(coordKey) || 0) > 1 // Mais de 1 rua na mesma coord = genérico
    })

    const coords = await fetchCoords(query, city, hasGenericSource)
    if (coords) coordsMap.set(query, coords)
  }))

  // 3. Cálculo de Centroides por Bairro (para detecção de Outliers)
  const neighborhoodCentroids = new Map<string, { lat: number; lng: number }>()
  const neighborhoodPoints = new Map<string, { lat: number; lng: number }[]>()

  uniqueQueries.forEach(query => {
    const coords = coordsMap.get(query)
    const neighborhood = queries.find(q => q.fullQuery === query)?.city // Usamos a cidade/bairro da query
    const rowsForQuery = rows.filter(r => getFullQuery(r) === query)
    const neighborhoodKey = String(rowsForQuery[0]?.['Bairro'] || 'Desconhecido')

    if (coords) {
      if (!neighborhoodPoints.has(neighborhoodKey)) neighborhoodPoints.set(neighborhoodKey, [])
      neighborhoodPoints.get(neighborhoodKey)?.push(coords)
    }
  })

  neighborhoodPoints.forEach((points, neighborhood) => {
    const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length
    const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length
    neighborhoodCentroids.set(neighborhood, { lat: avgLat, lng: avgLng })
  })

  // 4. Detecção de Outliers e Refinamento
  // Se uma parada está a > 5km do centroide do seu bairro, tentamos re-geocodificar sem o Bairro na query
  await Promise.all(uniqueQueries.map(async (query) => {
    const coords = coordsMap.get(query)
    if (!coords) return

    const rowsForQuery = rows.filter(r => getFullQuery(r) === query)
    const neighborhoodKey = String(rowsForQuery[0]?.['Bairro'] || 'Desconhecido')
    const centroid = neighborhoodCentroids.get(neighborhoodKey)

    if (centroid) {
      const distToCentroid = getDistance(centroid.lat, centroid.lng, coords.lat, coords.lng)
      
      // Se estiver muito longe do "centro do bairro", o nome do bairro pode estar poluindo a busca
      if (distToCentroid > 5) {
        console.warn(`Outlier detectado (${distToCentroid.toFixed(2)}km) para: ${query}. Refinando busca sem bairro...`)
        
        // Tentamos geocodificar apenas Rua + Cidade
        const cleanAddr = String(rowsForQuery[0]?.['Destination Address'] || '')
        const city = String(rowsForQuery[0]?.['City'] || '').trim()
        const refinedQuery = `${cleanAddr}, ${city}, Brazil`
        
        const refinedCoords = await fetchCoords(refinedQuery, city, true)
        if (refinedCoords) {
          coordsMap.set(query, refinedCoords)
        }
      }
    }
  }))

  // 5. Atualizar as linhas com as coordenadas obtidas + Blindagem Cirúrgica
  const enrichedRows = rows.map(r => {
    const query = getFullQuery(r)
    const newCoords = coordsMap.get(query)
    
    if (newCoords) {
      const oldLat = Number(r['Latitude'] || 0)
      const oldLng = Number(r['Longitude'] || 0)

      if (oldLat !== 0 && oldLng !== 0) {
        const coordKey = `${r['Latitude']}_${r['Longitude']}`
        const isGeneric = (coordsFrequency.get(coordKey) || 0) > 1
        const dist = getDistance(oldLat, oldLng, newCoords.lat, newCoords.lng)
        
        // Se a coordenada da planilha for genérica (muitas ruas na mesma coord),
        // we trust the Google result more as it's street-specific.
        if (isGeneric) {
          return { ...r, Latitude: newCoords.lat, Longitude: newCoords.lng }
        }

        // Se NÃO for genérica, aplicamos a trava de 2km (margem de bairro)
        if (dist > 2) {
          console.warn(`Desvio excessivo (${dist.toFixed(2)}km) detectado. Mantendo original para Segurança.`)
          return r
        }
      }

      return { ...r, Latitude: newCoords.lat, Longitude: newCoords.lng }
    }
    return r
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
      'AT ID': g.first['AT ID'],
      'Destination Address': expandAddress(base),
      'Bairro': g.first['Bairro'],
      'City': g.first['City'],
      'Zipcode/Postal code': g.first['Zipcode/Postal code'],
      'Latitude': g.first['Latitude'],
      'Longitude': g.first['Longitude'],
      'Address Line 2': line2,
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
        'AT ID': f['AT ID'],
        'Destination Address': expandAddress(g.base),
        'Bairro': f['Bairro'],
        'City': f['City'],
        'Zipcode/Postal code': f['Zipcode/Postal code'],
        'Latitude': f['Latitude'],
        'Longitude': f['Longitude'],
        'Address Line 2': line2,
        'Pacotes na Parada': allNums,
      })
    })

  return { out, unsequencedCount: unsequenced.length }
}

