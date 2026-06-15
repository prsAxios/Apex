import type { BrandBlock, ParsedRow } from '../parser'

export interface SpannedRow {
  item: ParsedRow
  brandId?: string
  rowIndexInBrand: number
  // Brand cell
  renderBrand: boolean
  brandRowSpan: number
  brandName: string
  brandCatalogId: string
  // Product cell
  renderProduct: boolean
  productRowSpan: number
  // Product ID comes from the group leader so the merged cell and TSV agree
  productId: string
  productLeaderIndex: number
  // Item description cell
  renderDesc: boolean
  descRowSpan: number
}

// Computes merge spans. Within a brand, every row sharing the same Product Name
// is grouped together (in first-occurrence order, even if entered non-adjacently)
// and shares one merged Product Name cell. Within a product group, identical
// item descriptions share one Item Description cell (multiple package sizes
// under one description). rowIndexInBrand always refers to the item's original
// index in the brand block so inline edits map back to the store.
export function computeSpans(brands: BrandBlock[], ids?: string[]): SpannedRow[] {
  const rows: SpannedRow[] = []

  brands.forEach((block, bIdx) => {
    const items = block.items

    // Group original indices by product name (first-occurrence order).
    // Empty product names never merge — each stays its own group.
    const groups: number[][] = []
    const byProduct = new Map<string, number[]>()
    items.forEach((item, idx) => {
      const key = item.productName.trim().toLowerCase()
      if (key === '') {
        groups.push([idx])
        return
      }
      const existing = byProduct.get(key)
      if (existing) {
        existing.push(idx)
      } else {
        const group = [idx]
        byProduct.set(key, group)
        groups.push(group)
      }
    })

    let firstRowOfBrand = true
    for (const group of groups) {
      const productSpan = group.length
      const leaderIndex = group[0]
      const leaderProductId = items[leaderIndex].productId ?? ''

      // Sub-group identical item descriptions within the product group
      // (first-occurrence order; empty descriptions never merge).
      const descGroups: number[][] = []
      const byDesc = new Map<string, number[]>()
      for (const idx of group) {
        const key = items[idx].itemDescription.trim().toLowerCase()
        if (key === '') {
          descGroups.push([idx])
          continue
        }
        const existing = byDesc.get(key)
        if (existing) {
          existing.push(idx)
        } else {
          const dg = [idx]
          byDesc.set(key, dg)
          descGroups.push(dg)
        }
      }

      let firstRowOfProduct = true
      for (const descGroup of descGroups) {
        let firstRowOfDesc = true
        for (const idx of descGroup) {
          rows.push({
            item: items[idx],
            brandId: ids?.[bIdx],
            rowIndexInBrand: idx,
            renderBrand: firstRowOfBrand,
            brandRowSpan: items.length,
            brandName: block.brand,
            brandCatalogId: block.brandId ?? '',
            renderProduct: firstRowOfProduct,
            productRowSpan: productSpan,
            productId: leaderProductId,
            productLeaderIndex: leaderIndex,
            renderDesc: firstRowOfDesc,
            descRowSpan: descGroup.length,
          })
          firstRowOfBrand = false
          firstRowOfProduct = false
          firstRowOfDesc = false
        }
      }
    }
  })

  return rows
}
