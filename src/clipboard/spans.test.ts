import { describe, it, expect } from 'vitest'
import { computeSpans } from './spans'
import type { BrandBlock, ParsedRow } from '../parser'

function row(productName: string, itemDescription: string, packageSize: string): ParsedRow {
  return { brand: '', productName, itemDescription, packageSize, flagLevel: 'none' }
}

describe('computeSpans', () => {
  it('merges consecutive rows with same product name', () => {
    const brands: BrandBlock[] = [{
      brand: 'B',
      items: [
        row('Irish Whiskey', 'Desc A', '6/750 ML BTL'),
        row('Irish Whiskey', 'Desc B', '12/750 ML BTL'),
        row('Other', 'Desc C', '6/750 ML BTL'),
      ],
    }]
    const spanned = computeSpans(brands)
    expect(spanned[0].renderProduct).toBe(true)
    expect(spanned[0].productRowSpan).toBe(2)
    expect(spanned[1].renderProduct).toBe(false)
    expect(spanned[2].renderProduct).toBe(true)
    expect(spanned[2].productRowSpan).toBe(1)
  })

  it('merges identical item descriptions under one product (multi package size)', () => {
    const brands: BrandBlock[] = [{
      brand: 'B',
      items: [
        row('Whiskey', 'Same Desc', '6/750 ML BTL'),
        row('Whiskey', 'Same Desc', '12/375 ML BTL'),
      ],
    }]
    const spanned = computeSpans(brands)
    expect(spanned[0].renderDesc).toBe(true)
    expect(spanned[0].descRowSpan).toBe(2)
    expect(spanned[1].renderDesc).toBe(false)
    // package size always rendered per row
    expect(spanned[0].item.packageSize).toBe('6/750 ML BTL')
    expect(spanned[1].item.packageSize).toBe('12/375 ML BTL')
  })

  it('merges non-consecutive rows with same product name into one group', () => {
    const brands: BrandBlock[] = [{
      brand: 'B',
      items: [
        row('Blanc de Blancs', 'Desc A', '12/750 ML BTL'),
        row('Other', 'Desc C', '6/750 ML BTL'),
        row('Blanc de Blancs', 'Desc B', '6/750 ML BTL'),
      ],
    }]
    const spanned = computeSpans(brands)
    // Blanc de Blancs rows are pulled together at first occurrence
    expect(spanned[0].item.itemDescription).toBe('Desc A')
    expect(spanned[1].item.itemDescription).toBe('Desc B')
    expect(spanned[2].item.itemDescription).toBe('Desc C')
    expect(spanned[0].renderProduct).toBe(true)
    expect(spanned[0].productRowSpan).toBe(2)
    expect(spanned[1].renderProduct).toBe(false)
    expect(spanned[2].renderProduct).toBe(true)
    // original indices preserved for store edits
    expect(spanned[1].rowIndexInBrand).toBe(2)
    expect(spanned[2].rowIndexInBrand).toBe(1)
  })

  it('does not merge across different products', () => {
    const brands: BrandBlock[] = [{
      brand: 'B',
      items: [
        row('P1', 'Same', '6/750 ML BTL'),
        row('P2', 'Same', '6/750 ML BTL'),
      ],
    }]
    const spanned = computeSpans(brands)
    expect(spanned[0].descRowSpan).toBe(1)
    expect(spanned[1].renderDesc).toBe(true)
  })

  it('does not merge empty product names', () => {
    const brands: BrandBlock[] = [{
      brand: 'B',
      items: [
        row('', 'D1', ''),
        row('', 'D2', ''),
      ],
    }]
    const spanned = computeSpans(brands)
    expect(spanned[0].productRowSpan).toBe(1)
    expect(spanned[1].renderProduct).toBe(true)
  })

  it('brand cell spans all rows of brand', () => {
    const brands: BrandBlock[] = [
      { brand: 'A', items: [row('P', 'D', 'S'), row('P', 'D', 'S2')] },
      { brand: 'B', items: [row('Q', 'E', 'T')] },
    ]
    const spanned = computeSpans(brands)
    expect(spanned[0].renderBrand).toBe(true)
    expect(spanned[0].brandRowSpan).toBe(2)
    expect(spanned[1].renderBrand).toBe(false)
    expect(spanned[2].renderBrand).toBe(true)
    expect(spanned[2].brandName).toBe('B')
  })
})
