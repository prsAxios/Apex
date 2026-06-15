import { parseLine } from './index'
import type { ParsedRow } from './index'

const VALID_CONFIDENCE = new Set(['high', 'medium', 'low'])

// ─── Schema types ─────────────────────────────────────────────────────────────

export interface GeminiItem {
  raw_description: string
  brand: string
  product_name: string
  confidence: 'high' | 'medium' | 'low'
  source?: string
  [key: string]: unknown
}

export interface GeminiOutput {
  supplier?: string
  items: GeminiItem[]
}

export type GeminiParseResult =
  | { ok: true;  data: GeminiOutput }
  | { ok: false; error: string }

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseGeminiJson(raw: string): GeminiParseResult {
  // Strip optional ```json … ``` fences
  let src = raw.trim()
  const fence = src.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fence) src = fence[1].trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(src)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Root value must be a JSON object' }
  }
  const obj = parsed as Record<string, unknown>

  if (!Array.isArray(obj.items) || obj.items.length === 0) {
    return { ok: false, error: '"items" must be a non-empty array' }
  }

  // Items are validated leniently — missing/blank fields produce flagged rows
  // in the table rather than a hard error, so partial Gemini output still works.
  for (let i = 0; i < obj.items.length; i++) {
    if (typeof obj.items[i] !== 'object' || obj.items[i] === null)
      return { ok: false, error: `items[${i}] is not an object` }
  }

  return { ok: true, data: obj as unknown as GeminiOutput }
}

// ─── Converter ────────────────────────────────────────────────────────────────
// Brand and product_name come from the JSON (Gemini's research).
// Package Size and Item Description are computed by our deterministic parser
// from raw_description — we never trust pack math to an LLM.
// Groups are sorted alphabetically by brand so rowspan merging is stable.

export interface GeminiRowGroup {
  brand: string
  items: ParsedRow[]
}

const UNKNOWN_BRAND = '(Unknown Brand)'

export function geminiToRowGroups(data: GeminiOutput): GeminiRowGroup[] {
  // Normalise each raw item, filling blanks with safe fallbacks
  const normalised = data.items.map((raw, i) => {
    const it = raw as Record<string, unknown>
    const brand       = (typeof it.brand        === 'string' && it.brand.trim())        ? it.brand.trim()        : ''
    const productName = (typeof it.product_name === 'string' && it.product_name.trim()) ? it.product_name.trim() : ''
    const rawDesc     = (typeof it.raw_description === 'string' && it.raw_description.trim()) ? it.raw_description.trim() : ''
    const conf        = VALID_CONFIDENCE.has(it.confidence as string)
                          ? it.confidence as 'high' | 'medium' | 'low'
                          : 'low'
    const source      = typeof it.source === 'string' ? it.source : undefined

    return { brand, productName, rawDesc, conf, source, originalIndex: i }
  })

  // Sort by brand (blanks go to the end)
  const sorted = [...normalised].sort((a, b) => {
    if (!a.brand && !b.brand) return 0
    if (!a.brand) return 1
    if (!b.brand) return -1
    return a.brand.toLowerCase().localeCompare(b.brand.toLowerCase())
  })

  // Group by brand key
  const groupMap = new Map<string, typeof sorted>()
  for (const item of sorted) {
    const key = item.brand.toLowerCase() || '__unknown__'
    const g = groupMap.get(key)
    if (g) g.push(item)
    else groupMap.set(key, [item])
  }

  return [...groupMap.values()].map(items => {
    const brand = items[0].brand || UNKNOWN_BRAND

    const rows: ParsedRow[] = items.map(item => {
      // Always run our deterministic parser for pack/description —
      // fall back gracefully when raw_description is blank
      const parsed = item.rawDesc
        ? parseLine(item.rawDesc, brand)
        : { brand, productName: '', itemDescription: '', packageSize: '', flagLevel: 'red' as const, flagReason: 'No raw_description in JSON' }

      // Missing brand or product name → red flag so the cell is highlighted
      const missingFields = [
        !item.brand        && 'brand',
        !item.productName  && 'product name',
        !item.rawDesc      && 'raw_description',
      ].filter(Boolean)

      return {
        ...parsed,
        brand,
        productName: item.productName || '(missing)',
        flagLevel:   missingFields.length > 0 ? 'red' as const : parsed.flagLevel,
        flagReason:  missingFields.length > 0
          ? `Missing from JSON: ${missingFields.join(', ')}`
          : parsed.flagReason,
        confidence: item.conf,
        source:     item.source,
      }
    })

    return { brand, items: rows }
  })
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

export function buildGeminiPrompt(supplier: string, rawLinesByBrand: { brand: string; lines: string }[]): string {
  const itemList = rawLinesByBrand
    .flatMap(({ brand, lines }) =>
      lines.split('\n').map(l => l.trim()).filter(Boolean).map(l => `${brand}: ${l}`),
    )
    .join('\n')

  return `Please research the following beverage items for the supplier "${supplier || '[Supplier Name]'}".

For each item return a JSON object matching this exact schema — no extra commentary, just the JSON:

{
  "supplier": "${supplier || '[Supplier Name]'}",
  "items": [
    {
      "raw_description": "<original line, unchanged>",
      "brand": "<canonical brand name>",
      "product_name": "<specific product name, without the brand>",
      "confidence": "<high | medium | low>",
      "source": "<URL or reference, optional>"
    }
  ]
}

Confidence guide:
- high   → verified from official brand/distributor records
- medium → found a likely match online; include source URL
- low    → uncertain — flag it

Items to research:
${itemList || '(no items yet — add items in Smart Builder first)'}`
}
