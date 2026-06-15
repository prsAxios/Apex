import { describe, it, expect } from 'vitest'
import { damerauLevenshtein, fuzzyResolveAlias, type BrandDictionary } from './index'

describe('damerauLevenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(damerauLevenshtein('jacquart', 'jacquart')).toBe(0)
  })

  it('counts substitutions, insertions, deletions', () => {
    expect(damerauLevenshtein('hennessy', 'hennessey')).toBe(1) // insertion
    expect(damerauLevenshtein('hennessy', 'hennesy')).toBe(1)   // deletion
    expect(damerauLevenshtein('hennessy', 'hennessi')).toBe(1)  // substitution
  })

  it('counts adjacent transposition as one edit', () => {
    expect(damerauLevenshtein('jacquart', 'jacqaurt')).toBe(1)
    expect(damerauLevenshtein('ab', 'ba')).toBe(1)
  })

  it('handles empty strings', () => {
    expect(damerauLevenshtein('', 'abc')).toBe(3)
    expect(damerauLevenshtein('abc', '')).toBe(3)
  })
})

describe('fuzzyResolveAlias', () => {
  const dict: BrandDictionary = {
    jacquart: 'Champagne Jacquart',
    odriscolls: "O'Driscolls",
    hennessy: 'Hennessy',
  }

  it('exact normalized hit wins with distance 0', () => {
    const m = fuzzyResolveAlias("O'Driscolls", dict)
    expect(m).toMatchObject({ canonical: "O'Driscolls", exact: true, distance: 0 })
  })

  it('resolves a transposition typo', () => {
    const m = fuzzyResolveAlias('jacqaurt', dict)
    expect(m?.canonical).toBe('Champagne Jacquart')
    expect(m?.exact).toBe(false)
  })

  it('resolves a missing-letter typo within budget', () => {
    expect(fuzzyResolveAlias('hennesy', dict)?.canonical).toBe('Hennessy')
  })

  it('rejects strings too far from any alias', () => {
    expect(fuzzyResolveAlias('glenfiddich', dict)).toBeNull()
  })

  it('never fuzzy-matches very short inputs', () => {
    expect(fuzzyResolveAlias('jaq', dict)).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(fuzzyResolveAlias('  ', dict)).toBeNull()
  })
})
