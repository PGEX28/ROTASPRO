const PREFIX_MAP: [RegExp, string][] = [
  [/^Srv\b/i, 'Servidão'],
  [/^Av\b/i, 'Avenida'],
  [/^R\b/i, 'Rua'],
  [/^Rod\b/i, 'Rodovia'],
  [/^Est\b/i, 'Estrada'],
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

function expandAddress(name: string): string {
  if (ADDR_CORR[name]) return ADDR_CORR[name]
  for (const [pat, rep] of PREFIX_MAP) {
    if (pat.test(name)) { name = name.replace(pat, rep); break }
  }
  for (const [abbr, full] of Object.entries(MIDDLE_EXP)) {
    if (name.includes(abbr)) name = name.split(abbr).join(full)
  }
  return name
}

function splitAddr(addr: string): [string, string | null] {
  const parts = (addr || '').trim().split(', ')
  return [
    parts.slice(0, 2).join(', '),
    parts.length > 2 ? parts.slice(2).join(', ') : null,
  ]
}

function normalizeKey(addr: string): string {
  return addr
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // strip accents
    .toLowerCase()
    .replace(/\s+/g, ' ')                               // collapse whitespace
    .replace(/[.,;:]+/g, '')                             // strip punctuation
    .trim()
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

  // 1) Group sequenced rows by normalized base address
  type Group = { rows: InputRow[]; unseqLabels: string[]; first: InputRow; stop: number; base: string }
  const groups = new Map<string, Group>()
  const order: string[] = []

  for (const r of sequenced) {
    const [base] = splitAddr(String(r['Destination Address'] ?? ''))
    const key = normalizeKey(base)
    if (!groups.has(key)) {
      groups.set(key, { rows: [], unseqLabels: [], first: r, stop: Number(r['Stop']), base })
      order.push(key)
    } else {
      groups.get(key)!.stop = Math.min(groups.get(key)!.stop, Number(r['Stop']))
    }
    groups.get(key)!.rows.push(r)
  }

  // 2) Process unsequenced: merge into existing groups or create new unsequenced-only groups
  type UnseqGroup = { first: InputRow; base: string; labels: string[] }
  const unseqGroups = new Map<string, UnseqGroup>()
  const unseqOrder: string[] = []

  unsequenced.forEach((r, i) => {
    const [base] = splitAddr(String(r['Destination Address'] ?? ''))
    const key = normalizeKey(base)
    const pseudoSeq = `${maxSeq + i + 1} (+${i + 1})`

    if (groups.has(key)) {
      // Same address as a sequenced group → merge
      groups.get(key)!.unseqLabels.push(pseudoSeq)
    } else {
      // Group unsequenced among themselves by address
      if (!unseqGroups.has(key)) {
        unseqGroups.set(key, { first: r, base, labels: [] })
        unseqOrder.push(key)
      }
      unseqGroups.get(key)!.labels.push(pseudoSeq)
    }
  })

  const out: OutputRow[] = []

  // 3) Output unsequenced-only groups (addresses with NO sequenced match)
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

  // 4) Output sequenced groups (with merged unsequenced appended)
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
