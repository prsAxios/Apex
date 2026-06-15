import { describe, it, expect } from 'vitest'
import { buildTableHtml, buildTsv } from './index'
import type { BrandBlock } from '../parser'

const sampleBrands: BrandBlock[] = [
  {
    brand: "O'Driscolls",
    items: [{
      brand: "O'Driscolls",
      productName: 'Irish Whiskey',
      itemDescription: "ODriscolls Irish Whiskey 1/6B/750ML",
      packageSize: '6/750 ML BTL',
      flagLevel: 'none',
    }],
  },
  {
    brand: 'Champagne Jacquart',
    items: [
      {
        brand: 'Champagne Jacquart',
        productName: 'Blanc de Blancs',
        itemDescription: 'Jacquart Blanc De Blancs 1/12B/750ML',
        packageSize: '12/750 ML BTL',
        flagLevel: 'none',
      },
      {
        brand: 'Champagne Jacquart',
        productName: 'Mosaique Brut NV',
        itemDescription: 'Jacquart Mosaique Brut NV 1/12B/750ML',
        packageSize: '12/750 ML BTL',
        flagLevel: 'none',
      },
    ],
  },
]

describe('buildTableHtml', () => {
  it('includes supplier rowspan equal to total rows', () => {
    const html = buildTableHtml({ supplier: 'MHW Ltd. (MHW)', brands: sampleBrands })
    expect(html).toContain('rowspan="3"') // 3 total data rows
    expect(html).toContain('MHW Ltd. (MHW)')
  })

  it('includes brand rowspan for multi-row brand', () => {
    const html = buildTableHtml({ supplier: 'MHW', brands: sampleBrands })
    expect(html).toContain('rowspan="2"') // Jacquart has 2 items
  })

  it('contains all required header text', () => {
    const html = buildTableHtml({ supplier: 'S', brands: sampleBrands })
    expect(html).toContain('Supplier Information')
    expect(html).toContain('Required - Brands, Products')
    expect(html).toContain('Package Size')
  })

  it('uses inline styles with Calibri', () => {
    const html = buildTableHtml({ supplier: 'S', brands: sampleBrands })
    expect(html).toContain('Calibri')
    expect(html).toContain('border-collapse: collapse')
  })
})

describe('request modes', () => {
  const brandsWithIds: BrandBlock[] = [
    {
      brand: 'Hennessy',
      brandId: '10042',
      items: [
        {
          brand: 'Hennessy',
          productName: 'XO Cognac',
          productId: '88871',
          itemDescription: 'Hennessy XO Cognac 1/6B/750ML',
          packageSize: '6/750 ML BTL',
          flagLevel: 'none',
        },
        {
          brand: 'Hennessy',
          productName: 'XO Cognac',
          productId: '88871',
          itemDescription: 'Hennessy XO Cognac 1/12B/375ML',
          packageSize: '12/375 ML BTL',
          flagLevel: 'none',
        },
      ],
    },
  ]

  it('product-package mode adds Brand ID column and adjusted title', () => {
    const html = buildTableHtml({ supplier: 'S', brands: brandsWithIds, mode: 'product-package' })
    expect(html).toContain('Required - Products &amp; Package Information')
    expect(html).toContain('colspan="5"')
    expect(html).toContain('Brand ID')
    expect(html).toContain('10042')
    expect(html).not.toContain('Product ID')
  })

  it('package-only mode adds Brand ID and Product ID columns', () => {
    const html = buildTableHtml({ supplier: 'S', brands: brandsWithIds, mode: 'package-only' })
    expect(html).toContain('Required - Package Information')
    expect(html).toContain('colspan="6"')
    expect(html).toContain('Brand ID')
    expect(html).toContain('Product ID')
    expect(html).toContain('88871')
  })

  it('product ID cell merges across the product group', () => {
    const html = buildTableHtml({ supplier: 'S', brands: brandsWithIds, mode: 'package-only' })
    // brand, brand id, product name, product id all rowspan=2 (one per merged cell)
    expect(html.match(/rowspan="2"/g)?.length).toBe(5) // supplier + brand + brand id + product + product id
  })

  it('TSV gains ID columns per mode', () => {
    const tsv = buildTsv({ supplier: 'S', brands: brandsWithIds, mode: 'package-only' })
    const lines = tsv.split('\n')
    expect(lines[1]).toBe('Name\tBrand\tBrand ID\tProduct Name\tProduct ID\tItem Description\tPackage Size')
    for (const line of lines.slice(2)) {
      expect(line.split('\t').length).toBe(7)
      expect(line).toContain('10042')
      expect(line).toContain('88871')
    }
  })

  it('default mode is unchanged', () => {
    const html = buildTableHtml({ supplier: 'S', brands: sampleBrands })
    expect(html).toContain('colspan="4"')
    expect(html).not.toContain('Brand ID')
  })
})

describe('buildTsv', () => {
  it('repeats supplier on every row', () => {
    const tsv = buildTsv({ supplier: 'MHW', brands: sampleBrands })
    const dataLines = tsv.split('\n').slice(2) // skip headers
    for (const line of dataLines) {
      expect(line.startsWith('MHW')).toBe(true)
    }
  })

  it('has correct column count', () => {
    const tsv = buildTsv({ supplier: 'S', brands: sampleBrands })
    const lines = tsv.split('\n')
    for (const line of lines) {
      if (line) expect(line.split('\t').length).toBe(5)
    }
  })
})
