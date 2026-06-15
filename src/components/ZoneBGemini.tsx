import { useState } from 'react'
import { useStore } from '../store'
import { parseGeminiJson, geminiToRowGroups, buildGeminiPrompt } from '../parser/gemini'
import { teachDictionary } from '../dictionary'

export function ZoneBGemini({ onGenerate }: { onGenerate: () => void }) {
  const geminiRawJson  = useStore(s => s.geminiRawJson)
  const setGeminiRawJson = useStore(s => s.setGeminiRawJson)
  const supplier       = useStore(s => s.supplierName)
  const setSupplier    = useStore(s => s.setSupplierName)
  const brands         = useStore(s => s.brands)
  const setBrands      = useStore(s => s.setBrands)
  const showToast      = useStore(s => s.showToast)
  const dictionary     = useStore(s => s.dictionary)
  const setDictionary  = useStore(s => s.setDictionary)

  const [parseError, setParseError] = useState<string | null>(null)
  // supplier extracted from JSON that differs from current store supplier
  const [jsonSupplier, setJsonSupplier] = useState<string | null>(null)

  function handleChange(v: string) {
    setGeminiRawJson(v)
    setParseError(null)
    setJsonSupplier(null)
  }

  function handleGenerate() {
    if (!geminiRawJson.trim()) {
      setParseError('Paste Gemini JSON output above first.')
      return
    }
    const result = parseGeminiJson(geminiRawJson)
    if (!result.ok) {
      setParseError(result.error)
      return
    }
    setParseError(null)

    const { data } = result

    // Supplier: only act if JSON includes one
    const jsonSup = data.supplier?.trim()
    if (jsonSup) {
      if (!supplier.trim()) {
        setSupplier(jsonSup)
        setJsonSupplier(null)
      } else if (supplier.trim().toLowerCase() !== jsonSup.toLowerCase()) {
        setJsonSupplier(jsonSup)
      } else {
        setJsonSupplier(null)
      }
    }

    const groups = geminiToRowGroups(data)

    // Teach brand dictionary: first token of raw_description → brand
    let dict = dictionary
    for (const group of groups) {
      for (let i = 0; i < group.items.length; i++) {
        const rawDesc = data.items.find(it =>
          it.brand.trim().toLowerCase() === group.brand.toLowerCase() &&
          it.product_name.trim() === group.items[i].productName,
        )?.raw_description ?? ''
        const firstToken = rawDesc.trim().split(/\s+/)[0]?.toLowerCase()
        if (firstToken && firstToken !== group.brand.toLowerCase()) {
          dict = teachDictionary(firstToken, group.brand, dict)
        }
      }
    }
    setDictionary(dict)

    const newBrands = groups.map(g => ({
      id: crypto.randomUUID(),
      brand: g.brand,
      brandId: '',
      rawLines: data.items
        .filter(it => it.brand.trim().toLowerCase() === g.brand.toLowerCase())
        .map(it => it.raw_description)
        .join('\n'),
      items: g.items,
    }))
    setBrands(newBrands)
    onGenerate()
    showToast(`Imported ${newBrands.reduce((s, b) => s + b.items.length, 0)} items from Gemini JSON`)
  }

  async function handleCopyPrompt() {
    const rawLinesByBrand = brands.map(b => ({ brand: b.brand, lines: b.rawLines }))
    const prompt = buildGeminiPrompt(supplier, rawLinesByBrand)
    try {
      await navigator.clipboard.writeText(prompt)
      showToast('Gemini prompt copied — paste it into Gemini and bring the JSON back here', 'info')
    } catch {
      showToast('Copy failed', 'error')
    }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    resize: 'none',
    fontFamily: 'JetBrains Mono, Menlo, monospace',
    fontSize: 12,
    lineHeight: 1.65,
    background: 'var(--surface2)',
    border: `1px solid ${parseError ? 'var(--red-flag)' : 'var(--hairline2)'}`,
    borderRadius: 6,
    color: 'var(--text)',
    padding: '10px 12px',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>

      {/* JSON supplier chip */}
      {jsonSupplier && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 11px', borderRadius: 6,
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
          fontSize: 12.5,
        }}>
          <span style={{ color: 'var(--text-dim)', flex: 1 }}>
            JSON supplier: <strong style={{ color: 'var(--text)' }}>{jsonSupplier}</strong>
          </span>
          <button
            onClick={() => { setSupplier(jsonSupplier); setJsonSupplier(null) }}
            style={{
              background: 'var(--accent)', color: 'var(--accent-contrast)',
              border: 'none', borderRadius: 4, padding: '3px 10px',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Use this
          </button>
          <button
            onClick={() => setJsonSupplier(null)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 14, padding: '0 2px',
            }}
          >×</button>
        </div>
      )}

      {/* Textarea */}
      <textarea
        value={geminiRawJson}
        onChange={e => handleChange(e.target.value)}
        placeholder={'Paste Gemini JSON output here…\n\nAccepts raw JSON or ```json fences.\n\nExpected shape:\n{\n  "supplier": "...",\n  "items": [{\n    "raw_description": "...",\n    "brand": "...",\n    "product_name": "...",\n    "confidence": "high|medium|low",\n    "source": "..." // optional\n  }]\n}'}
        style={inputStyle}
        onFocus={e => {
          if (!parseError) {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)'
          }
        }}
        onBlur={e => {
          if (!parseError) {
            e.currentTarget.style.borderColor = 'var(--hairline2)'
            e.currentTarget.style.boxShadow = 'none'
          }
        }}
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            handleGenerate()
          }
        }}
        spellCheck={false}
      />

      {/* Parse error */}
      {parseError && (
        <div style={{
          fontSize: 12.5, lineHeight: 1.55,
          color: 'var(--red-flag)',
          background: 'color-mix(in srgb, var(--red-flag) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--red-flag) 22%, transparent)',
          borderRadius: 5, padding: '8px 12px',
        }}>
          <strong>Parse error:</strong> {parseError}
        </div>
      )}

      {/* Copy prompt */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={handleCopyPrompt}
          style={{
            background: 'none',
            border: '1px solid var(--hairline2)',
            color: 'var(--text-dim)',
            borderRadius: 5, padding: '7px 13px',
            fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hairline2)'; e.currentTarget.style.color = 'var(--text-dim)' }}
          title="Copies a ready-to-paste research request for Gemini, built from the items in Smart Builder"
        >
          Copy Gemini Prompt
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
          Paste into Gemini, bring JSON back here
        </span>
      </div>

      {/* Generate */}
      <button
        onClick={handleGenerate}
        style={{
          background: 'var(--accent)', color: 'var(--accent-contrast)',
          border: 'none', borderRadius: 5, padding: '11px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit', letterSpacing: '0.03em', flexShrink: 0,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        title="Generate table from JSON (Ctrl+Enter)"
      >
        Generate Table ⌘↵
      </button>
    </div>
  )
}
