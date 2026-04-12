const PREFIX_MAP: [RegExp, string][] = [
  [/^Srv\b/i, 'Servidão'],
  [/^Av\b/i, 'Avenida'],
  [/^R\b/i, 'Rua'],
  [/^Rod\b/i, 'Rodovia'],
  [/^Est\b/i, 'Estrada'],
  [/^Trav\b/i, 'Travessa'],
  [/^Al\b/i, 'Alameda'],
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
  for (const [pat, rep] of PREFIX_MAP) {
    if (pat.test(expanded)) { expanded = expanded.replace(pat, rep); break }
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
 * Removido o uso de coordenadas para evitar separação indevida de paradas no mesmo local.
 */
function getGroupingKey(r: InputRow): string {
  const addr = String(r['Destination Address'] ?? '')

  // 1. Normalização de texto (remove acentos e converte para minúsculo)
  let clean = addr.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  // 2. Expansão total de abreviações para garantir correspondência
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
    [/\bsta[.\s]+/g, 'santa '],
    [/\bsto[.\s]+/g, 'santo '],
  ]
  expansions.forEach(([re, rep]) => { clean = clean.replace(re, rep) })

  // 3. Extração estrutural de Rua + Número
  const parts = clean.split(',')
  let street = ''
  let num = ''

  if (parts.length >= 2) {
    // Formato padrão: Rua Nome, Número
    street = parts[0].replace(/[^a-z0-9]/g, '')
    num = parts[1].match(/\d+/)?.[0] || ''
  } else {
    // Formato sem vírgula: Rua Nome 123
    const match = clean.match(/(.+?)\s+(\d+)\b/)
    if (match) {
      street = match[1].replace(/[^a-z0-9]/g, '')
      num = match[2]
    } else {
      // Fallback: remove tudo que não é alfanumérico para comparação direta
      return clean.replace(/[^a-z0-9]/g, '')
    }
  }

  // A chave final é a combinação pura da rua e número
  return street + num
}

export function transformRows(rows: InputRow[]): TransformResult {
  const sequenced = rows.filter(
    (r) => r['Sequence'] !== '-' && r['Sequence'] != null && r['Stop'] !== '-'
  )
  const unsequenced = rows.filter(
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
