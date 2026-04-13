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



async function fetchCoords(address: string, city?: string, forceRefresh: boolean = false, lat?: number, lng?: number): Promise<{ lat: number; lng: number; formatted_address?: string; location_type?: string } | null> {
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
      location_type: data.location_type
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

/**
 * Normaliza o nome da rua para comparação (remove Rua, Servidão, etc)
 */
function normalizeStreetBody(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/^(rua|servidao|srv|avenida|av|travessa|rodovia|rod|praca)\.?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Busca informações oficiais do CEP na API ViaCEP
 */
async function fetchCepInfo(cep: string): Promise<{ logradouro: string; bairro: string; localidade: string; uf: string } | null> {
  const cleanCep = String(cep || '').replace(/\D/g, '')
  if (cleanCep.length !== 8) return null
  
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.erro) return null
    return {
      logradouro: data.logradouro,
      bairro: data.bairro,
      localidade: data.localidade,
      uf: data.uf
    }
  } catch {
    return null
  }
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
  if (!clean.includes(',') && /[a-z\s]+\s+\d+/i.test(clean)) {
    clean = clean.replace(/([a-z\s]+)\s+(\d+.*)$/i, '$1, $2')
  }

  // Remove complementos que podem confundir o geocodificador (focamos no Ponto exato)
  clean = clean.replace(/,\s*(\d+)\s*(casa|fundo|frente|ap|bloco|sala|loja).*/i, ', $1')
    
  return clean
}

export async function transformRows(rows: InputRow[]): Promise<TransformResult> {
  // 0. Pré-processamento de CEPs
  const uniqueCeps = Array.from(new Set(rows.map(r => String(r['Zipcode/Postal code'] ?? '').replace(/\D/g, '')).filter(c => c.length === 8)))
  const cepMap = new Map<string, { logradouro: string; bairro: string; localidade: string; uf: string }>()
  
  await Promise.all(uniqueCeps.map(async (cep) => {
    const info = await fetchCepInfo(cep)
    if (info) cepMap.set(cep, info)
  }))

  /**
   * Tenta corrigir o endereço usando os dados do CEP e extraindo o número original
   */
  const getCorrectedAddr = (r: InputRow) => {
    const cep = String(r['Zipcode/Postal code'] ?? '').replace(/\D/g, '')
    const info = cepMap.get(cep)
    const originalAddr = String(r['Destination Address'] ?? '').trim()
    
    // Primeiro, vamos tentar achar o número no endereço original
    // Procuramos por: ", 123", " nº 123", " n: 123" ou apenas um número no final
    const numMatch = originalAddr.match(/(?:,|\s+n[º°:]?\s*|#\s*)(\d+[a-z]?)\b/i) || 
                     originalAddr.match(/\b(\d+[a-z]?)$/i) ||
                     originalAddr.match(/(\d+)/)
    const num = numMatch ? numMatch[1] : ''

    if (info && info.logradouro) {
      // Se temos o logradouro oficial do CEP, usamos ele como base absoluta
      return `${info.logradouro}${num ? ', ' + num : ''}`
    }

    // Fallback: se o CEP não retornar rua (CEP único de cidade/bairro), 
    // usamos o endereço original padronizado
    return standardizeAddress(originalAddr)
  }

  // Função auxiliar para construir o endereço completo para o Google
  const getFullQuery = (r: InputRow) => {
    const addrClean = getCorrectedAddr(r)
    const cep = String(r['Zipcode/Postal code'] ?? '').replace(/\D/g, '')
    const info = cepMap.get(cep)
    
    const city = info?.localidade || String(r['City'] ?? '').trim()
    const state = info?.uf || r['State'] || ''
    
    // Omitimos o Bairro propositalmente para evitar conflitos de nomenclatura entre ViaCEP e Google
    const parts = [addrClean, city, state, 'Brazil'].filter(p => p && p !== 'null' && p !== 'undefined')
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
  // Usamos a primeira linha encontrada para cada query como âncora de coordenada
  const coordsMap = new Map<string, { lat: number; lng: number; formatted_address?: string; location_type?: string }>()
  await Promise.all(uniqueQueries.map(async (query) => {
    const city = queryToCity.get(query)
    const associatedRows = rows.filter(r => getFullQuery(r) === query)
    const firstRow = associatedRows[0]

    // Identificamos se qualquer linha associada a esta query tem coordenada compartilhada
    const hasGenericSource = associatedRows.some(r => {
      const coordKey = `${r['Latitude']}_${r['Longitude']}`
      return (coordsFrequency.get(coordKey) || 0) > 1 // Mais de 1 rua na mesma coord = genérico
    })

    const lat = Number(firstRow?.['Latitude'] || 0)
    const lng = Number(firstRow?.['Longitude'] || 0)

    const coords = await fetchCoords(query, city, hasGenericSource, lat !== 0 ? lat : undefined, lng !== 0 ? lng : undefined)
    if (coords) coordsMap.set(query, coords)
  }))

  // 3. Atualizar as linhas com as coordenadas obtidas + Âncora de Coordenada
  // 3. Atualizar as linhas com as coordenadas obtidas + Âncora de Coordenada
  let enrichedRows = rows.map(r => {
    const originalAddr = String(r['Destination Address'] ?? '').trim()
    const cep = String(r['Zipcode/Postal code'] ?? '').replace(/\D/g, '')
    const info = cepMap.get(cep)
    
    const standardAddr = getCorrectedAddr(r)
    
    // Endereço base atualizado (Logradouro oficial + Número)
    let updatedRow = { 
      ...r, 
      'Destination Address': standardAddr,
      'Bairro': info?.bairro || r['Bairro'],
      'City': info?.localidade || r['City']
    } as InputRow
    
    const query = getFullQuery(r)
    const newCoords = coordsMap.get(query)
    
    if (newCoords) {
      const oldLat = Number(r['Latitude'] || 0)
      const oldLng = Number(r['Longitude'] || 0)
      
      const coordKey = `${oldLat}_${oldLng}`
      const freq = coordsFrequency.get(coordKey) || 0
      
      // Coordenada é genérica se for 0,0 ou se for compartilhada por vários endereços (ponto central)
      const isGeneric = (oldLat === 0 && oldLng === 0) || freq > 1
      
      const newLat = newCoords.lat
      const newLng = newCoords.lng
      const dist = getDistance(oldLat, oldLng, newLat, newLng)
      const isRooftop = newCoords.location_type === 'ROOFTOP'
      const googleAddr = (newCoords.formatted_address || '').toLowerCase()
      const searchStreetBody = normalizeStreetBody(originalAddr)

      // HIERARQUIA DE CONFIANÇA (Cuidado Cirúrgico):

      // CASO A: Coordenada Genérica na Planilha (Placeholder / Centro da Cidade / Bairro)
      if (isGeneric) {
        // No caso genérico, confiamos no ponto do Google se o nome da rua bater minimamente
        if (googleAddr.includes(searchStreetBody)) {
          updatedRow.Latitude = newLat
          updatedRow.Longitude = newLng
        } else {
          console.warn(`Genérico rejeitado: Nome da rua não coincide. (${searchStreetBody} vs ${googleAddr})`)
        }
      } 
      // CASO B: Coordenada Específica na Planilha (Âncora Real)
      else {
        // 1. Confiança Total: ROOFTOP + Nome Bate + Distância até 500m
        if (isRooftop && googleAddr.includes(searchStreetBody)) {
          if (dist <= 0.5) {
            updatedRow.Latitude = newLat
            updatedRow.Longitude = newLng
          } else {
            console.warn(`ROOFTOP ignorado: Ponto a ${dist.toFixed(2)}km de distância em coordenada específica.`)
          }
        }
        // 2. Confiança Média: Nome Bate + Distância até 2km
        else if (googleAddr.includes(searchStreetBody) && dist <= 2.0) {
          updatedRow.Latitude = newLat
          updatedRow.Longitude = newLng
        }
      }
    }
    return updatedRow
  })

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

