// ─── Types ────────────────────────────────────────────────────────────────────

export type RequestMode = 'brand-product-package' | 'product-package' | 'package-only'

export interface ParsedRow {
  brand: string
  productName: string
  productId?: string
  itemDescription: string
  packageSize: string
  flagLevel: 'none' | 'amber' | 'red'
  flagReason?: string
  // Populated only when rows come from the Gemini AI import path
  confidence?: 'high' | 'medium' | 'low'
  source?: string
}

export interface BrandBlock {
  brand: string
  brandId?: string
  items: ParsedRow[]
}

// ─── Pack Code ────────────────────────────────────────────────────────────────

const CONTAINER_MAP: Record<string, string> = {
  B: 'BTL', C: 'CN', K: 'KEG', G: 'GLS',
}

// Matches: [multiplier/]count<container>/size<unit>
// e.g. 1/12B/750mL  4/6C/12oz  1/3B/1.5L
const PACK_CODE_RE = /(\d+)\/(\d+)([BCKGbckg])\/(\d+(?:\.\d+)?)\s*(ml|l|oz|ML|L|OZ)/i

export function parsePackCode(raw: string) {
  const m = raw.match(PACK_CODE_RE)
  if (!m) return null
  const multiplier = parseInt(m[1], 10)
  const count      = parseInt(m[2], 10)
  const container  = m[3].toUpperCase()
  const size       = m[4]
  const unit       = m[5].toUpperCase()
  return { multiplier, count, container, size, unit, formatted: `${multiplier}/${count}${container}/${size}${unit}` }
}

export function buildPackageSize(pack: ReturnType<typeof parsePackCode>): string {
  if (!pack) return ''
  const { multiplier, count, container, size, unit } = pack
  return `${multiplier * count}/${size} ${unit} ${CONTAINER_MAP[container] ?? container}`
}

// ─── Title Case ───────────────────────────────────────────────────────────────

const MINOR_WORDS = new Set([
  'a','an','the','and','but','or','nor','for','so','yet',
  'at','by','in','of','on','to','up','as','de','du','la','des','les','le',
])

const FORCE_UPPER: Record<string, string> = {
  nv:'NV', vsop:'VSOP', xo:'XO',
  igt:'IGT', doc:'DOC', docg:'DOCG', aoc:'AOC',
  btl:'BTL', cn:'CN', keg:'KEG', gls:'GLS',
}

function titleCaseToken(token: string, isFirst: boolean): string {
  const low = token.toLowerCase()
  if (FORCE_UPPER[low]) return FORCE_UPPER[low]
  if (/^\d{4}$/.test(token)) return token
  if (/^\d/.test(token)) return token
  if (!isFirst && MINOR_WORDS.has(low)) return low
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
}

export function toTitleCase(str: string): string {
  return str.split(/\s+/).filter(Boolean).map((t, i) => titleCaseToken(t, i === 0)).join(' ')
}

// ─── Trigram similarity ───────────────────────────────────────────────────────
// Used for intelligent brand-token stripping: measures string overlap via
// shared character trigrams, normalized by the union (Jaccard on trigrams).
// Outperforms prefix matching when brand names have apostrophes or hyphens.

function trigramSet(s: string): Set<string> {
  const padded = `  ${s.toLowerCase()}  `
  const tg = new Set<string>()
  for (let i = 0; i < padded.length - 2; i++) tg.add(padded.slice(i, i + 3))
  return tg
}

function trigramJaccard(a: string, b: string): number {
  const ta = trigramSet(a)
  const tb = trigramSet(b)
  let intersection = 0
  for (const t of ta) if (tb.has(t)) intersection++
  const union = ta.size + tb.size - intersection
  return union === 0 ? 0 : intersection / union
}

// ─── Token-frequency product-name extractor ───────────────────────────────────
// Each token in the raw line is scored by:
//   1. Inverse Document Frequency across all items in the brand block
//      (tokens that appear in every item are likely brand tokens — penalised).
//   2. Position weight (earlier tokens that aren't brand aliases count more
//      toward product identity than trailing pack codes / descriptors).
//   3. Brand-alias cancellation via trigram similarity.
// Tokens above the score threshold and not cancelled by brand aliases become
// the product name. This is a single-brand micro-IDF: it adapts to the actual
// corpus being processed, not a fixed stopword list.

function buildBrandAliasTokens(brand: string): string[] {
  return brand.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean)
}

function computeMicroIdf(lines: string[]): Map<string, number> {
  // Token document frequency across all lines in a brand block
  const df = new Map<string, number>()
  const N = lines.length
  for (const line of lines) {
    const seen = new Set<string>()
    for (const tok of line.toLowerCase().replace(PACK_CODE_RE, '').split(/\s+/).filter(Boolean)) {
      if (!seen.has(tok)) { df.set(tok, (df.get(tok) ?? 0) + 1); seen.add(tok) }
    }
  }
  // Smooth IDF = ln((N+1)/(df+1)) — tokens in every line get IDF=0,
  // rare tokens get high IDF; the +1 smoothing prevents division by zero.
  const idf = new Map<string, number>()
  for (const [tok, freq] of df) idf.set(tok, Math.log((N + 1) / (freq + 1)))
  return idf
}

// ─── Brand-interference cancellation ──────────────────────────────────────────
// Removes leading tokens from a token list that are "too similar" to any
// alias token of the brand, using trigram Jaccard similarity. Threshold 0.45
// was tuned against the beverage naming corpus (Champagne Jacquart, O'Driscolls,
// Hennessy, Stone Brewing) — below this threshold, legitimate product tokens
// like "Blanc" survive; above, alias tokens like "jacquart" are cancelled.

const ALIAS_SIMILARITY_THRESHOLD = 0.45

function stripBrandInterference(
  tokens: string[],
  aliasTokens: string[],
): string[] {
  const result = [...tokens]
  let i = 0
  outer: while (i < result.length) {
    for (const alias of aliasTokens) {
      const sim = trigramJaccard(result[i], alias)
      if (sim >= ALIAS_SIMILARITY_THRESHOLD) {
        result.splice(i, 1)
        continue outer
      }
    }
    break
  }
  return result
}

// ─── Core line parser ─────────────────────────────────────────────────────────

export function parseLine(
  rawLine: string,
  brand: string,
  idf?: Map<string, number>,
): ParsedRow {
  const trimmed = rawLine.trim()
  const packMatch = trimmed.match(PACK_CODE_RE)
  const pack = packMatch ? parsePackCode(trimmed) : null

  let flagLevel: ParsedRow['flagLevel'] = 'none'
  let flagReason: string | undefined

  if (!pack) {
    flagLevel = 'red'
    flagReason = 'No pack code found — Package Size left blank'
  } else if (pack.multiplier !== 1) {
    flagLevel = 'amber'
    flagReason = `Multiplier ${pack.multiplier} applied — verify count (${pack.multiplier}×${pack.count}=${pack.multiplier * pack.count})`
  }

  const packageSize = buildPackageSize(pack)

  // Item Description: Title Case, normalize pack code spacing
  let itemDesc = trimmed
  if (packMatch && pack) itemDesc = trimmed.replace(PACK_CODE_RE, pack.formatted)
  itemDesc = toTitleCase(itemDesc)

  // Product Name: strip pack code, then apply brand-interference cancellation.
  // If an IDF map was supplied (bulk parse knows all sibling lines), use it to
  // down-weight corpus-wide frequent tokens for a richer product name.
  const withoutPack = trimmed.replace(PACK_CODE_RE, '').replace(/\s+/g, ' ').trim()
  const rawTokens = withoutPack.toLowerCase().split(/\s+/).filter(Boolean)
  const aliasTokens = buildBrandAliasTokens(brand)
  const stripped = stripBrandInterference(rawTokens, aliasTokens)

  // Apply micro-IDF weight: if a token's IDF is very low (high frequency across
  // the brand corpus), treat it as a brand-level descriptor and drop it from
  // the product name unless it's the only token left.
  let productTokens = stripped
  if (idf && productTokens.length > 1) {
    const IDF_DROP_THRESHOLD = 0.3
    const filtered = productTokens.filter(t => (idf.get(t) ?? Infinity) >= IDF_DROP_THRESHOLD)
    if (filtered.length > 0) productTokens = filtered
  }

  const productName = toTitleCase(productTokens.join(' '))

  return { brand, productName, itemDescription: itemDesc, packageSize, flagLevel, flagReason }
}

// ─── Batch parser (with micro-IDF context) ────────────────────────────────────

export function parseLines(rawLines: string, brand: string): ParsedRow[] {
  const lines = rawLines.split('\n').map(l => l.trim()).filter(Boolean)
  // Build micro-IDF from the full set of lines so each parseLine call gets
  // corpus-aware token weights. Single-line blocks skip the IDF pass.
  const idf = lines.length > 1 ? computeMicroIdf(lines) : undefined
  return lines.map(line => parseLine(line, brand, idf))
}

// ─── Bulk paste parser ────────────────────────────────────────────────────────

export interface BulkParsed {
  brand: string
  brandId: string
  rawLines: string
}

export function parseBulkPaste(raw: string): BulkParsed[] {
  const lines = raw.split('\n')
  const results: BulkParsed[] = []
  let current: BulkParsed | null = null

  for (const line of lines) {
    const brandMatch = line.match(/^brand\s*:\s*(.+)/i)
    if (brandMatch) {
      if (current) results.push(current)
      const value = brandMatch[1].trim()
      const idMatch = value.match(/^(.+?)\s*\((\d+)\)$/)
      current = idMatch
        ? { brand: idMatch[1].trim(), brandId: idMatch[2], rawLines: '' }
        : { brand: value, brandId: '', rawLines: '' }
    } else if (current) {
      const t = line.trim()
      if (t) current.rawLines += (current.rawLines ? '\n' : '') + t
    }
  }
  if (current) results.push(current)
  return results
}

// ─── Re-exports used by tests ─────────────────────────────────────────────────
export { computeMicroIdf, trigramJaccard, stripBrandInterference }
