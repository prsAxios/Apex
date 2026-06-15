import { describe, it, expect } from 'vitest'
import { parseGeminiJson, geminiToRowGroups, type GeminiOutput } from './gemini'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_JSON = JSON.stringify({
  supplier: 'MHW Ltd.',
  items: [
    {
      raw_description: 'stella artois lager 1/24C/12oz',
      brand: 'Stella Artois',
      product_name: 'Lager',
      confidence: 'high',
    },
    {
      raw_description: 'jacquart blanc de blancs 1/12B/750mL',
      brand: 'Champagne Jacquart',
      product_name: 'Blanc de Blancs',
      confidence: 'medium',
      source: 'https://jacquart.com/blanc-de-blancs',
    },
    {
      raw_description: 'mystery spirit 1/6B/750mL',
      brand: 'Mystery Brand',
      product_name: 'Mystery Spirit',
      confidence: 'low',
    },
  ],
})

const FENCED_JSON = `\`\`\`json
${VALID_JSON}
\`\`\``

const OUT_OF_ORDER_JSON = JSON.stringify({
  supplier: 'Test Supplier',
  items: [
    { raw_description: 'a lager 1/12C/12oz',  brand: 'Brand B', product_name: 'Lager',  confidence: 'high' },
    { raw_description: 'a stout 1/12B/500mL',  brand: 'Brand A', product_name: 'Stout',  confidence: 'high' },
    { raw_description: 'a pale ale 1/6B/330mL', brand: 'Brand B', product_name: 'Pale Ale', confidence: 'medium' },
    { raw_description: 'a whiskey 1/6B/750mL',  brand: 'Brand A', product_name: 'Whiskey', confidence: 'low' },
  ],
})

// ─── parseGeminiJson ──────────────────────────────────────────────────────────

describe('parseGeminiJson', () => {
  it('parses valid JSON', () => {
    const result = parseGeminiJson(VALID_JSON)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.supplier).toBe('MHW Ltd.')
    expect(result.data.items).toHaveLength(3)
  })

  it('strips markdown fences before parsing', () => {
    const result = parseGeminiJson(FENCED_JSON)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.items).toHaveLength(3)
  })

  it('returns error for invalid JSON syntax', () => {
    const result = parseGeminiJson('{ bad json }')
    expect(result.ok).toBe(false)
  })

  it('parses successfully when supplier is omitted', () => {
    const result = parseGeminiJson(JSON.stringify({
      items: [{ raw_description: 'x 1/6B/750mL', brand: 'X', product_name: 'X', confidence: 'high' }],
    }))
    expect(result.ok).toBe(true)
  })

  it('returns error when items is empty', () => {
    const result = parseGeminiJson(JSON.stringify({ supplier: 'X', items: [] }))
    expect(result.ok).toBe(false)
  })

  it('accepts invalid confidence and defaults it to low in the converter', () => {
    const result = parseGeminiJson(JSON.stringify({
      items: [{ raw_description: 'x 1/6B/750mL', brand: 'X', product_name: 'X', confidence: 'maybe' }],
    }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const groups = geminiToRowGroups(result.data)
    expect(groups[0].items[0].confidence).toBe('low')
  })

  it('accepts extra fields on items without error', () => {
    const result = parseGeminiJson(JSON.stringify({
      supplier: 'X',
      items: [{ raw_description: 'x 1/6B/750mL', brand: 'X', product_name: 'X', confidence: 'high', extra_field: 'ignored' }],
    }))
    expect(result.ok).toBe(true)
  })
})

// ─── geminiToRowGroups ────────────────────────────────────────────────────────

describe('geminiToRowGroups', () => {
  it('groups by brand and sorts alphabetically', () => {
    const result = parseGeminiJson(OUT_OF_ORDER_JSON)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const groups = geminiToRowGroups(result.data)
    // Brand A should come before Brand B alphabetically
    expect(groups[0].brand).toBe('Brand A')
    expect(groups[1].brand).toBe('Brand B')
  })

  it('keeps all items within a brand group', () => {
    const result = parseGeminiJson(OUT_OF_ORDER_JSON)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const groups = geminiToRowGroups(result.data)
    const brandA = groups.find(g => g.brand === 'Brand A')!
    const brandB = groups.find(g => g.brand === 'Brand B')!
    expect(brandA.items).toHaveLength(2)
    expect(brandB.items).toHaveLength(2)
  })

  it('preserves confidence and source on rows', () => {
    const result = parseGeminiJson(VALID_JSON)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const groups = geminiToRowGroups(result.data)
    const jacquart = groups.find(g => g.brand === 'Champagne Jacquart')!
    expect(jacquart.items[0].confidence).toBe('medium')
    expect(jacquart.items[0].source).toBe('https://jacquart.com/blanc-de-blancs')
    const mystery = groups.find(g => g.brand === 'Mystery Brand')!
    expect(mystery.items[0].confidence).toBe('low')
  })

  it('uses JSON product_name, not the parser product name', () => {
    const result = parseGeminiJson(VALID_JSON)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const groups = geminiToRowGroups(result.data)
    const stella = groups.find(g => g.brand === 'Stella Artois')!
    // JSON says "Lager"; parser on its own might produce something longer
    expect(stella.items[0].productName).toBe('Lager')
  })

  it('computes pack size from raw_description, not from JSON', () => {
    const result = parseGeminiJson(VALID_JSON)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const groups = geminiToRowGroups(result.data)
    const stella = groups.find(g => g.brand === 'Stella Artois')!
    // raw_description "stella artois lager 1/24C/12oz" → 24/12 OZ CN
    expect(stella.items[0].packageSize).toBe('24/12 OZ CN')
  })

  it('mixed confidences render correct counts', () => {
    const result = parseGeminiJson(VALID_JSON)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const groups = geminiToRowGroups(result.data)
    const allItems = groups.flatMap(g => g.items)
    const high   = allItems.filter(i => i.confidence === 'high').length
    const medium = allItems.filter(i => i.confidence === 'medium').length
    const low    = allItems.filter(i => i.confidence === 'low').length
    expect(high).toBe(1)
    expect(medium).toBe(1)
    expect(low).toBe(1)
  })
})
