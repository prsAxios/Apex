import type { BrandBlock, RequestMode } from '../parser'
import { computeSpans } from './spans'

export interface TableData {
  supplier: string
  brands: BrandBlock[]
  mode?: RequestMode
}

// Per-mode shape of the "Required" section
export const MODE_CONFIG: Record<RequestMode, {
  title: string
  columns: string[]
  emailNoun: string
}> = {
  'brand-product-package': {
    title: 'Required - Brands, Products & Package Information',
    columns: ['Brand', 'Product Name', 'Item Description', 'Package Size'],
    emailNoun: 'brands, products and packages',
  },
  'product-package': {
    title: 'Required - Products & Package Information',
    columns: ['Brand', 'Brand ID', 'Product Name', 'Item Description', 'Package Size'],
    emailNoun: 'products and packages',
  },
  'package-only': {
    title: 'Required - Package Information',
    columns: ['Brand', 'Brand ID', 'Product Name', 'Product ID', 'Item Description', 'Package Size'],
    emailNoun: 'packages',
  },
}

const CELL_BASE = `
  font-family: Calibri, sans-serif;
  font-size: 11pt;
  border: 1px solid #000000;
  padding: 6px 10px;
  vertical-align: top;
  white-space: pre-wrap;
`

const HEADER_EXTRA = `font-weight: bold; background-color: #f2f2f2;`

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildTableHtml(data: TableData): string {
  const { supplier, brands } = data
  const mode = data.mode ?? 'brand-product-package'
  const config = MODE_CONFIG[mode]
  const withBrandId = mode !== 'brand-product-package'
  const withProductId = mode === 'package-only'
  const spanned = computeSpans(brands)
  const totalRows = spanned.length
  const supplierCell = `<td rowspan="${totalRows}" style="${CELL_BASE} min-width:120px;">${escapeHtml(supplier)}</td>`

  let rows = ''
  spanned.forEach((row, idx) => {
    const brandCell = row.renderBrand
      ? `<td rowspan="${row.brandRowSpan}" style="${CELL_BASE} min-width:120px;">${escapeHtml(row.brandName)}</td>`
      : ''
    const brandIdCell = withBrandId && row.renderBrand
      ? `<td rowspan="${row.brandRowSpan}" style="${CELL_BASE} min-width:80px;">${escapeHtml(row.brandCatalogId)}</td>`
      : ''
    const productCell = row.renderProduct
      ? `<td${row.productRowSpan > 1 ? ` rowspan="${row.productRowSpan}"` : ''} style="${CELL_BASE} min-width:140px;">${escapeHtml(row.item.productName)}</td>`
      : ''
    const productIdCell = withProductId && row.renderProduct
      ? `<td${row.productRowSpan > 1 ? ` rowspan="${row.productRowSpan}"` : ''} style="${CELL_BASE} min-width:80px;">${escapeHtml(row.productId)}</td>`
      : ''
    const descCell = row.renderDesc
      ? `<td${row.descRowSpan > 1 ? ` rowspan="${row.descRowSpan}"` : ''} style="${CELL_BASE} min-width:180px;">${escapeHtml(row.item.itemDescription)}</td>`
      : ''

    rows += `<tr>
      ${idx === 0 ? supplierCell : ''}
      ${brandCell}
      ${brandIdCell}
      ${productCell}
      ${productIdCell}
      ${descCell}
      <td style="${CELL_BASE} min-width:120px;">${escapeHtml(row.item.packageSize)}</td>
    </tr>`
  })

  const headerCells = config.columns
    .map(c => `<th style="${CELL_BASE}${HEADER_EXTRA}">${escapeHtml(c)}</th>`)
    .join('\n      ')

  return `<table style="border-collapse: collapse; font-family: Calibri, sans-serif; font-size: 11pt;">
  <thead>
    <tr>
      <th colspan="1" style="${CELL_BASE}${HEADER_EXTRA}">Supplier Information</th>
      <th colspan="${config.columns.length}" style="${CELL_BASE}${HEADER_EXTRA}">${escapeHtml(config.title)}</th>
    </tr>
    <tr>
      <th style="${CELL_BASE}${HEADER_EXTRA}">Name</th>
      ${headerCells}
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>`
}

export function buildTsv(data: TableData): string {
  const mode = data.mode ?? 'brand-product-package'
  const config = MODE_CONFIG[mode]
  const withBrandId = mode !== 'brand-product-package'
  const withProductId = mode === 'package-only'

  const lines: string[] = [
    `Supplier Information\t${config.title}${'\t'.repeat(config.columns.length - 1)}`,
    `Name\t${config.columns.join('\t')}`,
  ]
  for (const row of computeSpans(data.brands)) {
    const cells = [data.supplier, row.brandName]
    if (withBrandId) cells.push(row.brandCatalogId)
    cells.push(row.item.productName)
    if (withProductId) cells.push(row.productId)
    cells.push(row.item.itemDescription, row.item.packageSize)
    lines.push(cells.join('\t'))
  }
  return lines.join('\n')
}

export function buildFullEmail(
  data: TableData,
  distributorName: string,
  distributorId: string
): string {
  const tableHtml = buildTableHtml(data)
  const noun = MODE_CONFIG[data.mode ?? 'brand-product-package'].emailNoun
  const distStr = distributorId
    ? `${distributorName} (${distributorId})`
    : distributorName

  return `<p>Hi Team,</p>
<p>Could you please add the following ${noun} to the Item Catalog under the mentioned SRS supplier, for X-Ref matching purposes, for the distributor, ${escapeHtml(distStr)}.</p>
<p>Required ${noun} :</p>
${tableHtml}
<p>Please let me know if you have any questions or need any additional information.</p>`
}

export async function copyTableToClipboard(data: TableData): Promise<boolean> {
  const html = buildTableHtml(data)
  const tsv = buildTsv(data)
  return writeToClipboard(html, tsv)
}

export async function copyEmailToClipboard(
  data: TableData,
  distributorName: string,
  distributorId: string
): Promise<boolean> {
  const html = buildFullEmail(data, distributorName, distributorId)
  const noun = MODE_CONFIG[data.mode ?? 'brand-product-package'].emailNoun
  const text = `Hi Team,\n\nCould you please add the following ${noun} to the Item Catalog under the mentioned SRS supplier, for X-Ref matching purposes, for the distributor, ${distributorName}${distributorId ? ` (${distributorId})` : ''}.\n\nRequired ${noun} :\n\n${buildTsv(data)}\n\nPlease let me know if you have any questions or need any additional information.`
  return writeToClipboard(html, text)
}

async function writeToClipboard(html: string, text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })
      await navigator.clipboard.write([item])
      return true
    }
  } catch {
    // fall through to execCommand
  }

  // Fallback: hidden contentEditable
  try {
    const el = document.createElement('div')
    el.contentEditable = 'true'
    el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0'
    el.innerHTML = html
    document.body.appendChild(el)
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    const ok = document.execCommand('copy')
    sel?.removeAllRanges()
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
