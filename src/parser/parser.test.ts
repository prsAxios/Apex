import { describe, it, expect } from 'vitest'
import {
  parsePackCode, buildPackageSize, toTitleCase, parseLine, parseLines,
  computeMicroIdf, trigramJaccard, stripBrandInterference,
} from './index'

describe('parsePackCode', () => {
  it('parses 1/12B/750mL', () => {
    const p = parsePackCode('1/12B/750mL')!
    expect(p.multiplier).toBe(1)
    expect(p.count).toBe(12)
    expect(p.container).toBe('B')
    expect(p.unit).toBe('ML')
  })
  it('handles space before unit: 1/12B/750 ML', () => {
    const p = parsePackCode('jacquart signature 5yr 1/12B/750 ML')!
    expect(buildPackageSize(p)).toBe('12/750 ML BTL')
  })
  it('1/6B/1.5L → 6/1.5 L BTL', () => {
    expect(buildPackageSize(parsePackCode('1/6B/1.5L')!)).toBe('6/1.5 L BTL')
  })
  it('4/6C/12oz → 24/12 OZ CN + amber flag', () => {
    const row = parseLine('stone ipa 4/6C/12oz', 'Stone Brewing')
    expect(row.packageSize).toBe('24/12 OZ CN')
    expect(row.flagLevel).toBe('amber')
  })
  it('no pack code → red flag, empty packageSize', () => {
    const row = parseLine('random description without code', 'Brand')
    expect(row.flagLevel).toBe('red')
    expect(row.packageSize).toBe('')
  })
})

describe('toTitleCase', () => {
  it('lowercases minor words, uppercases acronyms', () => {
    expect(toTitleCase('blanc de blancs nv')).toBe('Blanc de Blancs NV')
    expect(toTitleCase('mosaique brut nv')).toBe('Mosaique Brut NV')
    expect(toTitleCase('xo cognac vsop')).toBe('XO Cognac VSOP')
    expect(toTitleCase('bolgheri doc 2021')).toBe('Bolgheri DOC 2021')
  })
})

describe('trigramJaccard', () => {
  it('returns 1 for identical strings', () => {
    expect(trigramJaccard('jacquart', 'jacquart')).toBe(1)
  })
  it('returns a higher value for near-duplicates than for unrelated strings', () => {
    const nearDup = trigramJaccard('jacquart', 'jacqaurt')
    const unrelated = trigramJaccard('jacquart', 'hennessy')
    expect(nearDup).toBeGreaterThan(0.35)
    expect(nearDup).toBeGreaterThan(unrelated)
  })
  it('returns a low value for unrelated strings', () => {
    expect(trigramJaccard('jacquart', 'hennessy')).toBeLessThan(0.2)
  })
  it('returns 0 for very short / empty strings', () => {
    expect(trigramJaccard('', 'ab')).toBe(0)
  })
})

describe('computeMicroIdf', () => {
  it('assigns low IDF to tokens appearing in every line', () => {
    const lines = [
      'jacquart blanc de blancs 1/12B/750mL',
      'jacquart mosaique brut nv 1/12B/750mL',
      'jacquart signature 5yr 1/6B/750mL',
    ]
    const idf = computeMicroIdf(lines)
    // jacquart appears in all 3 lines: smooth IDF = ln(4/4) = 0
    expect(idf.get('jacquart')!).toBeLessThan(0.1)
    // blanc appears in 1 of 3 lines: IDF = ln(4/2) ≈ 0.693
    expect(idf.get('blanc')!).toBeGreaterThan(idf.get('jacquart')!)
  })
})

describe('stripBrandInterference', () => {
  it('removes leading tokens matching brand aliases by trigram similarity', () => {
    const tokens = ['jacquart', 'blanc', 'de', 'blancs']
    const result = stripBrandInterference(tokens, ['champagne', 'jacquart'])
    expect(result[0]).toBe('blanc')
  })
  it('does not strip unrelated leading tokens', () => {
    const tokens = ['blanc', 'de', 'blancs']
    const result = stripBrandInterference(tokens, ['champagne', 'jacquart'])
    expect(result[0]).toBe('blanc')
  })
})

describe('parseLines (micro-IDF integration)', () => {
  it('strips brand prefix and produces coherent product names', () => {
    const rows = parseLines(
      'jacquart blanc de blancs 1/12B/750mL\njacquart mosaique brut nv 1/12B/750mL',
      'Champagne Jacquart',
    )
    expect(rows[0].productName).toBe('Blanc de Blancs')
    expect(rows[1].productName).toBe('Mosaique Brut NV')
    expect(rows[0].packageSize).toBe('12/750 ML BTL')
  })
})
