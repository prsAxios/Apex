import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import { AutocompleteInput } from './AutocompleteInput'
import { ZoneBGemini } from './ZoneBGemini'
import { ZoneBGrounding } from './ZoneBGrounding'
import { parseLines, parseBulkPaste } from '../parser'
import { fuzzyResolveAlias } from '../dictionary'

export function ZoneB({ onGenerate }: { onGenerate: () => void }) {
  const zoneBMode    = useStore(s => s.zoneBMode)
  const setZoneBMode = useStore(s => s.setZoneBMode)
  const brands = useStore(s => s.brands)
  const requestMode = useStore(s => s.requestMode)
  const updateBrandId = useStore(s => s.updateBrandId)
  const dictionary = useStore(s => s.dictionary)
  const addBrand = useStore(s => s.addBrand)
  const removeBrand = useStore(s => s.removeBrand)
  const updateBrandName = useStore(s => s.updateBrandName)
  const updateBrandRawLines = useStore(s => s.updateBrandRawLines)
  const setBrandItems = useStore(s => s.setBrandItems)
  const moveBrandUp = useStore(s => s.moveBrandUp)
  const moveBrandDown = useStore(s => s.moveBrandDown)
  const setBrands = useStore(s => s.setBrands)
  const showToast = useStore(s => s.showToast)

  const [bulkMode, setBulkMode] = useState(false)
  const [bulkText, setBulkText] = useState('')

  const brandSuggestions = Object.values(dictionary).filter(Boolean)

  // Canonicalize a typed brand via the dictionary's fuzzy resolver. Exact
  // alias hits and close typos (within edit-distance budget) both map to the
  // canonical name; anything else passes through untouched.
  function canonicalize(brand: string): string {
    const match = fuzzyResolveAlias(brand, dictionary)
    if (match && match.canonical !== brand) {
      showToast(`Recognized: ${brand} → ${match.canonical}`, 'info')
      return match.canonical
    }
    return brand
  }

  function handleGenerate() {
    if (bulkMode) {
      const parsed = parseBulkPaste(bulkText)
      if (parsed.length === 0) {
        showToast('No brands found. Use "Brand: Name" lines to separate brands.', 'error')
        return
      }
      const newBrands = parsed.map(p => {
        const brand = canonicalize(p.brand)
        return {
          id: crypto.randomUUID(),
          brand,
          brandId: p.brandId,
          rawLines: p.rawLines,
          items: parseLines(p.rawLines, brand),
        }
      })
      setBrands(newBrands)
      setBulkMode(false)
    } else {
      for (const b of brands) {
        const brand = canonicalize(b.brand)
        if (brand !== b.brand) updateBrandName(b.id, brand)
        const items = parseLines(b.rawLines, brand)
        setBrandItems(b.id, items)
      }
    }
    onGenerate()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>

      {/* ── Mode switcher ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="zone-label">Items Input</div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr',
          background: 'var(--surface2)',
          border: '1px solid var(--hairline2)',
          borderRadius: 8, padding: 3, gap: 3,
        }}>
          {(['smart', 'gemini', 'grounding'] as const).map(m => (
            <button
              key={m}
              onClick={() => setZoneBMode(m)}
              style={{
                background: zoneBMode === m ? 'var(--accent)' : 'none',
                color: zoneBMode === m ? 'var(--accent-contrast)' : 'var(--text-dim)',
                border: 'none', borderRadius: 5,
                padding: '6px 8px', fontSize: 11.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.15s, color 0.15s',
                letterSpacing: '0.01em',
              }}
            >
              {m === 'smart' ? 'Smart' : m === 'gemini' ? 'JSON' : 'Live Search'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Gemini mode ────────────────────────────────────────────────── */}
      {zoneBMode === 'gemini' && (
        <ZoneBGemini onGenerate={onGenerate} />
      )}

      {/* ── Grounding mode ─────────────────────────────────────────────── */}
      {zoneBMode === 'grounding' && (
        <ZoneBGrounding onGenerate={onGenerate} />
      )}

      {/* ── Smart Builder mode ─────────────────────────────────────────── */}
      {zoneBMode === 'smart' && (<>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setBulkMode(!bulkMode)}
          style={{
            background: 'none',
            border: '1px solid var(--hairline2)',
            color: 'var(--text-dim)',
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 3,
            cursor: 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '0.04em',
          }}
        >
          {bulkMode ? 'Brand Blocks' : 'Bulk Paste'}
        </button>
      </div>

      {bulkMode ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Format: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-dim)' }}>Brand: Name{requestMode !== 'brand-product-package' ? ' (BrandID)' : ''}</span> then items, one per line.
          </div>
          <textarea
            className="mono"
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder={`Brand: Champagne Jacquart\njacquart blanc de blancs 1/12B/750mL\njacquart mosaique brut nv 1/12B/750mL\n\nBrand: O'Driscolls\nodriscolls irish whiskey 1/6B/750mL`}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                handleGenerate()
              }
            }}
            style={{
              flex: 1,
              minHeight: 240,
              resize: 'vertical',
              background: 'var(--surface2)',
              border: '1px solid var(--hairline2)',
              borderRadius: 6,
              color: 'var(--text)',
              padding: '10px',
              outline: 'none',
              lineHeight: 1.6,
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--accent)'
              e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--hairline2)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <AnimatePresence initial={false}>
            {brands.map((b, idx) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--hairline2)',
                  borderRadius: 6,
                  padding: '12px 12px 10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <AutocompleteInput
                    value={b.brand}
                    onChange={v => updateBrandName(b.id, v)}
                    suggestions={brandSuggestions}
                    placeholder="Brand name"
                  />
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <IconBtn title="Move up (Alt+↑)" onClick={() => moveBrandUp(b.id)} disabled={idx === 0}>↑</IconBtn>
                    <IconBtn title="Move down (Alt+↓)" onClick={() => moveBrandDown(b.id)} disabled={idx === brands.length - 1}>↓</IconBtn>
                    <IconBtn title="Remove brand" onClick={() => removeBrand(b.id)} danger>×</IconBtn>
                  </div>
                </div>
                {requestMode !== 'brand-product-package' && (
                  <input
                    type="text"
                    value={b.brandId ?? ''}
                    onChange={e => updateBrandId(b.id, e.target.value)}
                    placeholder="Brand ID (catalog)"
                    style={{
                      width: '100%',
                      marginBottom: 8,
                      background: 'var(--surface)',
                      border: '1px solid var(--hairline2)',
                      borderRadius: 6,
                      color: 'var(--text)',
                      padding: '8px 12px',
                      fontSize: 13,
                      outline: 'none',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'var(--hairline2)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                )}
                <textarea
                  className="mono"
                  value={b.rawLines}
                  onChange={e => updateBrandRawLines(b.id, e.target.value)}
                  placeholder="Paste item descriptions, one per line&#10;e.g. jacquart blanc de blancs 1/12B/750mL"
                  onKeyDown={e => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault()
                      handleGenerate()
                    }
                  }}
                  rows={4}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    background: 'var(--surface)',
                    border: '1px solid var(--hairline2)',
                    borderRadius: 6,
                    color: 'var(--text)',
                    padding: '10px',
                    outline: 'none',
                    lineHeight: 1.6,
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                    e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = 'var(--hairline2)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          <button
            onClick={addBrand}
            style={{
              background: 'none',
              border: '1px dashed var(--hairline2)',
              borderRadius: 4,
              color: 'var(--text-dim)',
              padding: '10px',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
              width: '100%',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent)'
              e.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--hairline2)'
              e.currentTarget.style.color = 'var(--text-dim)'
            }}
          >
            + Add brand
          </button>
        </div>
      )}

      <motion.button
        onClick={handleGenerate}
        whileTap={{ scale: 0.98 }}
        style={{
          background: 'var(--accent)',
          color: 'var(--accent-contrast)',
          border: 'none',
          borderRadius: 5,
          padding: '11px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          letterSpacing: '0.03em',
          flexShrink: 0,
        }}
        title="Generate table (Ctrl+Enter)"
      >
        Generate Table ⌘↵
      </motion.button>
      </>)}
    </div>
  )
}

function IconBtn({ onClick, children, disabled, danger, title }: {
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  danger?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: 'none',
        border: '1px solid var(--hairline2)',
        borderRadius: 3,
        color: disabled ? 'var(--text-muted)' : danger ? 'var(--red-flag)' : 'var(--text-dim)',
        cursor: disabled ? 'default' : 'pointer',
        width: 24,
        height: 24,
        fontSize: 14,
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'inherit',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}
