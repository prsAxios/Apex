import { Fragment, useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import type { ParsedRow } from '../parser'
import { computeSpans } from '../clipboard/spans'
import { MODE_CONFIG } from '../clipboard'

interface EditingCell {
  brandId: string
  rowIndex: number
  field: keyof ParsedRow | 'brandId' | 'productId'
}

// ─── Content-driven column widths ─────────────────────────────────────────────
// Instead of fixed percentages, columns get minimum character-width hints and
// the browser's auto table layout resolves the rest. We only clamp the widest
// prose column (Item Description) to avoid runaway table expansion.
const COL_STYLE: Record<string, React.CSSProperties> = {
  supplier:    { minWidth: 110, maxWidth: 180 },
  brand:       { minWidth: 100, maxWidth: 160 },
  brandId:     { minWidth: 72,  maxWidth: 110 },
  productName: { minWidth: 110, maxWidth: 200 },
  productId:   { minWidth: 72,  maxWidth: 110 },
  itemDesc:    { minWidth: 160, maxWidth: 340, wordBreak: 'break-word', whiteSpace: 'pre-wrap' },
  packageSize: { minWidth: 96,  maxWidth: 140, fontVariantNumeric: 'tabular-nums' as const },
}

export function OutputTable({ generated }: { generated: boolean }) {
  const brands        = useStore(s => s.brands)
  const requestMode   = useStore(s => s.requestMode)
  const supplier      = useStore(s => s.supplierName)
  const updateItemCell = useStore(s => s.updateItemCell)
  const updateBrandId  = useStore(s => s.updateBrandId)
  const deleteRow      = useStore(s => s.deleteRow)
  const duplicateRow   = useStore(s => s.duplicateRow)
  const moveRowUp      = useStore(s => s.moveRowUp)
  const moveRowDown    = useStore(s => s.moveRowDown)

  const withBrandId   = requestMode !== 'brand-product-package'
  const withProductId = requestMode === 'package-only'
  const modeConfig    = MODE_CONFIG[requestMode]

  const [editing, setEditing]     = useState<EditingCell | null>(null)
  const [editValue, setEditValue] = useState('')
  const [hoveredRow, setHoveredRow] = useState<{ brandId: string; rowIndex: number } | null>(null)
  const editRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const totalRows = brands.reduce((sum, b) => sum + b.items.length, 0)
  const flatRows  = computeSpans(
    brands.map(b => ({ brand: b.brand, brandId: b.brandId, items: b.items })),
    brands.map(b => b.id),
  )

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus()
      if (editRef.current instanceof HTMLInputElement) editRef.current.select()
    }
  }, [editing])

  function startEdit(brandId: string, rowIndex: number, field: EditingCell['field'], value: string) {
    setEditing({ brandId, rowIndex, field })
    setEditValue(String(value ?? ''))
  }

  function commitEdit() {
    if (!editing) return
    if (editing.field === 'brandId') {
      updateBrandId(editing.brandId, editValue)
    } else if (editing.field === 'productId') {
      updateItemCell(editing.brandId, editing.rowIndex, 'productId' as keyof ParsedRow, editValue)
    } else {
      updateItemCell(editing.brandId, editing.rowIndex, editing.field as keyof ParsedRow, editValue)
    }
    setEditing(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') setEditing(null)
    if (e.key === 'Tab') {
      e.preventDefault()
      commitEdit()
      if (editing) {
        const editableFields: Array<keyof ParsedRow> = ['productName', 'itemDescription', 'packageSize']
        const fieldIdx = editableFields.indexOf(editing.field as keyof ParsedRow)
        if (!e.shiftKey && fieldIdx < editableFields.length - 1) {
          const nextField = editableFields[fieldIdx + 1]
          const row = brands.find(b => b.id === editing.brandId)?.items[editing.rowIndex]
          if (row) setTimeout(() => startEdit(editing.brandId, editing.rowIndex, nextField, String(row[nextField] ?? '')), 0)
        }
      }
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const cell = (flag?: ParsedRow['flagLevel'], extra?: React.CSSProperties): React.CSSProperties => ({
    border: '1px solid var(--grid-line)',
    padding: '9px 13px',
    verticalAlign: 'top',
    fontSize: 12.5,
    lineHeight: 1.55,
    color: 'var(--text)',
    cursor: 'text',
    borderLeft: flag === 'red'   ? '3px solid var(--red-flag)'
               : flag === 'amber' ? '3px solid var(--amber-flag)'
               : '1px solid var(--grid-line)',
    transition: 'background 0.12s ease-out',
    ...extra,
  })

  const headerCell: React.CSSProperties = {
    border: '1px solid var(--grid-line)',
    padding: '9px 13px',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-dim)',
    background: 'var(--surface2)',
    whiteSpace: 'nowrap',
    transition: 'background 0.22s ease-out',
  }

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!generated || totalRows === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 12,
        color: 'var(--text-dim)',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.2, color: 'var(--text)' }}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
        <span style={{ fontSize: 13, letterSpacing: '0.01em', fontWeight: 500 }}>
          Add brands and items, then hit Generate.
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⌘↵ to generate</span>
      </div>
    )
  }

  // ── Table ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      flex: 1,
      overflowX: 'auto',
      overflowY: 'auto',
      minHeight: 0,
      // Container sits flush left so the table can grow rightward naturally
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    }}>
      {/* The table uses auto layout: each column is as wide as its widest
          cell (capped by COL_STYLE.maxWidth), and the whole table shrinks
          or grows with the data — no fixed widths imposed from outside. */}
      <table
        className="xref-table"
        style={{
          borderCollapse: 'collapse',
          tableLayout: 'auto',
          width: 'auto',
          maxWidth: '100%',
          fontSize: 12.5,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <thead>
          <tr>
            <th style={headerCell}>Supplier Information</th>
            <th style={headerCell} colSpan={modeConfig.columns.length}>
              {modeConfig.title}
            </th>
          </tr>
          <tr>
            <th style={{ ...headerCell, ...COL_STYLE.supplier }}>Name</th>
            {modeConfig.columns.map(col => {
              const colKey =
                col === 'Brand'         ? 'brand'
              : col === 'Brand ID'      ? 'brandId'
              : col === 'Product Name'  ? 'productName'
              : col === 'Product ID'    ? 'productId'
              : col === 'Item Description' ? 'itemDesc'
              : 'packageSize'
              return (
                <th key={col} style={{ ...headerCell, ...COL_STYLE[colKey] }}>
                  {col}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          <AnimatePresence initial={false}>
            {flatRows.map((row, fi) => {
              const brandId  = row.brandId!
              const rowIndex = row.rowIndexInBrand
              const isHovered = hoveredRow?.brandId === brandId && hoveredRow?.rowIndex === rowIndex

              return (
                <motion.tr
                  key={`${brandId}-${rowIndex}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.14, delay: Math.min(fi * 0.025, 0.3) }}
                  onMouseEnter={() => setHoveredRow({ brandId, rowIndex })}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ background: isHovered ? 'var(--row-hover)' : 'transparent' }}
                >
                  {/* ── Supplier (first row only) ── */}
                  {fi === 0 && (
                    <td
                      rowSpan={totalRows}
                      style={{ ...cell(), ...COL_STYLE.supplier, verticalAlign: 'top', fontWeight: 500 }}
                    >
                      {supplier || <em style={{ color: 'var(--text-muted)', fontStyle: 'normal' }}>Supplier</em>}
                    </td>
                  )}

                  {/* ── Brand name ── */}
                  {row.renderBrand && (
                    <td
                      rowSpan={row.brandRowSpan}
                      style={{ ...cell(), ...COL_STYLE.brand, verticalAlign: 'top', fontWeight: 500 }}
                    >
                      {row.brandName || <em style={{ color: 'var(--text-muted)', fontStyle: 'normal' }}>Brand</em>}
                    </td>
                  )}

                  {/* ── Brand ID (product-package and package-only modes) ── */}
                  {withBrandId && row.renderBrand && (() => {
                    const isEdit = editing?.brandId === brandId && editing.field === 'brandId'
                    return (
                      <td
                        rowSpan={row.brandRowSpan}
                        style={{ ...cell(row.brandCatalogId ? 'none' : 'amber'), ...COL_STYLE.brandId, verticalAlign: 'top' }}
                        title={row.brandCatalogId ? undefined : 'Brand ID required for this request type'}
                        onClick={() => !isEdit && startEdit(brandId, rowIndex, 'brandId', row.brandCatalogId)}
                      >
                        <EditableCell
                          isEditing={isEdit}
                          value={row.brandCatalogId}
                          editValue={editValue}
                          setEditValue={setEditValue}
                          editRef={editRef as React.RefObject<HTMLInputElement>}
                          onBlur={commitEdit}
                          onKeyDown={handleKeyDown}
                          placeholder="ID"
                        />
                      </td>
                    )
                  })()}

                  {/* ── Product Name + optional Product ID ── */}
                  {row.renderProduct && (() => {
                    const conf = row.item.confidence
                    const src  = row.item.source
                    return (
                      <td
                        rowSpan={row.productRowSpan > 1 ? row.productRowSpan : undefined}
                        style={{ ...cell(), ...COL_STYLE.productName, verticalAlign: 'top' }}
                        data-low-confidence={conf === 'low' ? 'true' : undefined}
                        onClick={() => {
                          const isEdit = editing?.brandId === brandId && editing.rowIndex === rowIndex && editing.field === 'productName'
                          if (!isEdit) startEdit(brandId, rowIndex, 'productName', row.item.productName)
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                          <EditableCell
                            isEditing={editing?.brandId === brandId && editing.rowIndex === rowIndex && editing.field === 'productName'}
                            value={row.item.productName}
                            editValue={editValue}
                            setEditValue={setEditValue}
                            editRef={editRef as React.RefObject<HTMLInputElement>}
                            onBlur={commitEdit}
                            onKeyDown={handleKeyDown}
                            placeholder="—"
                          />
                          {conf === 'medium' && (
                            src
                              ? <a href={src} target="_blank" rel="noopener noreferrer"
                                  title={`Medium confidence — source: ${src}`}
                                  onClick={e => e.stopPropagation()}
                                  style={{ flexShrink: 0, marginTop: 3, textDecoration: 'none' }}>
                                  <ConfDot color="var(--amber-flag)" />
                                </a>
                              : <span title="Medium confidence" style={{ flexShrink: 0, marginTop: 3 }}>
                                  <ConfDot color="var(--amber-flag)" />
                                </span>
                          )}
                          {conf === 'low' && (
                            <span title="Unverified — check before sending" style={{ flexShrink: 0, marginTop: 3 }}>
                              <ConfDot color="var(--red-flag)" />
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  })()}

                  {/* ── Product ID (package-only mode) ── */}
                  {withProductId && row.renderProduct && (() => {
                    const isEdit = editing?.brandId === brandId && editing.rowIndex === row.productLeaderIndex && editing.field === 'productId'
                    return (
                      <td
                        rowSpan={row.productRowSpan > 1 ? row.productRowSpan : undefined}
                        style={{ ...cell(row.productId ? 'none' : 'amber'), ...COL_STYLE.productId, verticalAlign: 'top' }}
                        title={row.productId ? undefined : 'Product ID required for this request type'}
                        onClick={() => !isEdit && startEdit(brandId, row.productLeaderIndex, 'productId', row.productId)}
                      >
                        <EditableCell
                          isEditing={isEdit}
                          value={row.productId}
                          editValue={editValue}
                          setEditValue={setEditValue}
                          editRef={editRef as React.RefObject<HTMLInputElement>}
                          onBlur={commitEdit}
                          onKeyDown={handleKeyDown}
                          placeholder="ID"
                        />
                      </td>
                    )
                  })()}

                  {/* ── Item Description (may merge identical descs) ── */}
                  {row.renderDesc && (
                    <td
                      rowSpan={row.descRowSpan > 1 ? row.descRowSpan : undefined}
                      style={{ ...cell(row.item.flagLevel), ...COL_STYLE.itemDesc }}
                      title={row.item.flagLevel !== 'none' ? row.item.flagReason : undefined}
                      onClick={() => {
                        const isEdit = editing?.brandId === brandId && editing.rowIndex === rowIndex && editing.field === 'itemDescription'
                        if (!isEdit) startEdit(brandId, rowIndex, 'itemDescription', row.item.itemDescription)
                      }}
                    >
                      <EditableCell
                        isEditing={editing?.brandId === brandId && editing.rowIndex === rowIndex && editing.field === 'itemDescription'}
                        value={row.item.itemDescription}
                        editValue={editValue}
                        setEditValue={setEditValue}
                        editRef={editRef as React.RefObject<HTMLTextAreaElement>}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        placeholder="—"
                        multiline
                      />
                    </td>
                  )}

                  {/* ── Package Size ── */}
                  <td
                    style={{ ...cell(row.item.flagLevel === 'red' ? 'red' : 'none'), ...COL_STYLE.packageSize }}
                    onClick={() => {
                      const isEdit = editing?.brandId === brandId && editing.rowIndex === rowIndex && editing.field === 'packageSize'
                      if (!isEdit) startEdit(brandId, rowIndex, 'packageSize', row.item.packageSize)
                    }}
                  >
                    <EditableCell
                      isEditing={editing?.brandId === brandId && editing.rowIndex === rowIndex && editing.field === 'packageSize'}
                      value={row.item.packageSize}
                      editValue={editValue}
                      setEditValue={setEditValue}
                      editRef={editRef as React.RefObject<HTMLInputElement>}
                      onBlur={commitEdit}
                      onKeyDown={handleKeyDown}
                      placeholder="—"
                    />
                  </td>

                  {/* ── Row actions ── */}
                  {isHovered && (
                    <td style={{ padding: 0, border: 'none', position: 'relative', width: 0, overflow: 'visible' }}>
                      <div style={{
                        position: 'absolute',
                        left: 6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        gap: 2,
                        background: 'var(--surface2)',
                        border: '1px solid var(--hairline2)',
                        borderRadius: 4,
                        padding: '3px 4px',
                        zIndex: 10,
                        whiteSpace: 'nowrap',
                      }}>
                        <RowBtn title="Move up"    onClick={() => moveRowUp(brandId, rowIndex)}>↑</RowBtn>
                        <RowBtn title="Move down"  onClick={() => moveRowDown(brandId, rowIndex)}>↓</RowBtn>
                        <RowBtn title="Duplicate"  onClick={() => duplicateRow(brandId, rowIndex)}>⎘</RowBtn>
                        <RowBtn title="Delete row" onClick={() => deleteRow(brandId, rowIndex)} danger>✕</RowBtn>
                      </div>
                    </td>
                  )}
                </motion.tr>
              )
            })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  )
}

// ─── Shared inline editor ─────────────────────────────────────────────────────

function EditableCell({
  isEditing, value, editValue, setEditValue, editRef, onBlur, onKeyDown, placeholder, multiline,
}: {
  isEditing?: boolean
  value: string | undefined
  editValue: string
  setEditValue: (v: string) => void
  editRef: React.RefObject<HTMLInputElement> | React.RefObject<HTMLTextAreaElement>
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  placeholder?: string
  multiline?: boolean
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--cell-edit-bg, transparent)',
    border: 'none',
    outline: '2px solid var(--accent)',
    outlineOffset: 1,
    borderRadius: 2,
    color: 'var(--text)',
    fontSize: 12.5,
    lineHeight: 1.55,
    fontFamily: 'Inter, sans-serif',
    padding: '1px 3px',
    resize: multiline ? 'vertical' : 'none',
    minHeight: multiline ? 52 : undefined,
  }

  if (isEditing) {
    return multiline ? (
      <textarea
        ref={editRef as React.RefObject<HTMLTextAreaElement>}
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        style={inputStyle}
      />
    ) : (
      <input
        ref={editRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        style={inputStyle}
      />
    )
  }

  return (
    <span style={{ display: 'block', minHeight: 18, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>
      {value || <em style={{ color: 'var(--text-muted)', fontStyle: 'normal' }}>{placeholder}</em>}
    </span>
  )
}

// ─── Confidence indicator dot ─────────────────────────────────────────────────

function ConfDot({ color }: { color: string }) {
  return (
    <svg width="7" height="7" viewBox="0 0 7 7" style={{ display: 'block' }}>
      <circle cx="3.5" cy="3.5" r="3.5" fill={color} />
    </svg>
  )
}

// ─── Row action button ────────────────────────────────────────────────────────

function RowBtn({ onClick, children, danger, title }: {
  onClick: () => void; children: React.ReactNode; danger?: boolean; title?: string
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      title={title}
      style={{
        background: 'none',
        border: 'none',
        color: danger ? 'var(--red-flag)' : 'var(--text-dim)',
        cursor: 'pointer',
        padding: '2px 5px',
        fontSize: 11,
        borderRadius: 2,
        lineHeight: 1,
        transition: 'color 0.12s',
      }}
    >
      {children}
    </button>
  )
}
