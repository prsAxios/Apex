import { useState } from 'react'
import { useStore } from '../store'
import { parseLines } from '../parser'
import { fuzzyResolveAlias } from '../dictionary'

export function ZoneBGrounding({ onGenerate }: { onGenerate: () => void }) {
  const geminiApiKey = useStore(s => s.geminiApiKey)
  const setGeminiApiKey = useStore(s => s.setGeminiApiKey)
  
  const lastTokenUsage = useStore(s => s.lastTokenUsage)
  const lifetimeTokensUsed = useStore(s => s.lifetimeTokensUsed)
  const dailyTokenUsage = useStore(s => s.dailyTokenUsage)
  const dailyRequestsCount = useStore(s => s.dailyRequestsCount)
  const addTokenUsage = useStore(s => s.addTokenUsage)

  const requestMode = useStore(s => s.requestMode)
  const setBrands = useStore(s => s.setBrands)
  const updateBrandName = useStore(s => s.updateBrandName)
  const showToast = useStore(s => s.showToast)
  const dictionary = useStore(s => s.dictionary)

  const [rawText, setRawText] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [errorText, setErrorText] = useState<string | null>(null)
  
  const DAILY_REQUEST_LIMIT = 1500
  const TPM_LIMIT = 1000000
  
  const dailyRequestsRemaining = Math.max(0, DAILY_REQUEST_LIMIT - dailyRequestsCount)

  function canonicalize(brand: string): string {
    const match = fuzzyResolveAlias(brand, dictionary)
    if (match && match.canonical !== brand) {
      showToast(`Recognized: ${brand} → ${match.canonical}`, 'info')
      return match.canonical
    }
    return brand
  }

  async function handleSearchAndParse() {
    if (!geminiApiKey.trim()) {
      setErrorText('Please enter your Gemini API Key first.')
      return
    }
    if (!rawText.trim()) {
      setErrorText('Please paste raw descriptions first.')
      return
    }

    setLoading(true)
    setErrorText(null)
    setStatusText('Initiating connection...')

    try {
      setStatusText('Searching Google & grounding details...')
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey.trim()}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Ground and extract structured data from these descriptions. Perform search for verification:\n\n${rawText}`
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          },
          tools: [
            {
              googleSearch: {}
            }
          ],
          systemInstruction: {
            parts: [
              {
                text: "You are a precise catalog parser for beverage/alcohol catalog support. Your task is to take raw item descriptions, perform a Google Search to ground and verify their details, and extract canonical brand name, clean product name, computed package size, confidence level, and search source URL. Return JSON conforming to: { \"items\": [ { \"raw_description\": string, \"brand\": string, \"product_name\": string, \"package_size\": string, \"confidence\": \"high\" | \"medium\" | \"low\", \"source\": string } ] }"
              }
            ]
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `HTTP ${response.status} Error`)
      }

      setStatusText('Processing search response...')
      const resJson = await response.json()
      
      const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text
      if (!responseText) {
        throw new Error('Empty response received from Gemini API.')
      }

      // Record tokens used
      const prompt = resJson.usageMetadata?.promptTokenCount || 0
      const candidates = resJson.usageMetadata?.candidatesTokenCount || 0
      addTokenUsage(prompt, candidates)

      // Parse JSON
      let data: { items: Array<{ raw_description: string, brand: string, product_name: string, package_size: string, confidence: 'high' | 'medium' | 'low', source?: string }> }
      try {
        data = JSON.parse(responseText.trim())
      } catch {
        throw new Error('Failed to parse Gemini output as JSON.')
      }

      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('Invalid JSON structure returned by Gemini.')
      }

      setStatusText('Populating table...')

      // Group items by canonicalized brand
      const grouped: Record<string, { brand: string, items: any[], rawLines: string[] }> = {}
      
      for (const item of data.items) {
        const canonicalBrand = canonicalize(item.brand || 'Unknown')
        if (!grouped[canonicalBrand]) {
          grouped[canonicalBrand] = {
            brand: canonicalBrand,
            items: [],
            rawLines: []
          }
        }
        
        // Parse row representation
        grouped[canonicalBrand].rawLines.push(item.raw_description)
        
        // Form final item row structure
        const parsedRows = parseLines(item.raw_description, canonicalBrand)
        const parsedRow = parsedRows[0] || {
          brandName: canonicalBrand,
          productName: item.product_name,
          itemDescription: item.raw_description,
          packageSize: item.package_size,
          flagLevel: 'none',
        }

        // Apply Gemini details
        if (item.product_name) parsedRow.productName = item.product_name
        if (item.package_size) parsedRow.packageSize = item.package_size
        if (item.confidence) parsedRow.confidence = item.confidence
        if (item.source) parsedRow.source = item.source

        grouped[canonicalBrand].items.push(parsedRow)
      }

      // Convert grouping back to brands list
      const newBrands = Object.values(grouped).map(g => ({
        id: crypto.randomUUID(),
        brand: g.brand,
        brandId: '',
        rawLines: g.rawLines.join('\n'),
        items: g.items
      }))

      setBrands(newBrands)
      onGenerate()
      showToast(`Successfully grounded & parsed ${data.items.length} items.`)

    } catch (e: any) {
      setErrorText(e.message || 'An unexpected error occurred during API fetch.')
    } finally {
      setLoading(false)
      setStatusText('')
    }
  }

  const tokenProgressPercent = Math.min(100, (dailyTokenUsage / DAILY_BUDGET) * 100)

  if (requestMode !== 'brand-product-package') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 20px',
        textAlign: 'center',
        height: '100%',
        color: 'var(--text-dim)',
        gap: 12,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--amber-flag)' }}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" x2="12" y1="9" y2="13" />
          <line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          Live Grounding Unavailable
        </span>
        <span style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.8 }}>
          This feature is only supported for the <strong>Brand + Product + Package</strong> request type. Update your setting in Zone A to enable it.
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      
      {/* API Key Box */}
      {!geminiApiKey ? (
        <div style={{
          background: 'var(--surface2)',
          border: '1px solid var(--hairline2)',
          borderRadius: 8,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Gemini API Key Required
          </label>
          <input
            type="password"
            placeholder="AIzaSy..."
            onChange={e => setGeminiApiKey(e.target.value)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--hairline2)',
              borderRadius: 6,
              color: 'var(--text)',
              padding: '8px 12px',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Get a free key from the{' '}
            <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-dim)', textDecoration: 'underline' }}>
              Google AI Studio
            </a>.
          </span>
        </div>
      ) : null}

      {/* Main input area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Paste raw item lines (e.g. <code>corona extra 12oz cans</code>). We will ground and verify catalog detail sizes.
        </div>
        <textarea
          className="mono"
          value={rawText}
          onChange={e => { setRawText(e.target.value); setErrorText(null) }}
          placeholder="heineken lager 4/6B/12oz&#10;whispering angel rose 750ml"
          disabled={loading}
          style={{
            flex: 1,
            minHeight: 180,
            background: 'var(--surface2)',
            border: `1px solid ${errorText ? 'var(--red-flag)' : 'var(--hairline2)'}`,
            borderRadius: 6,
            color: 'var(--text)',
            padding: '12px',
            outline: 'none',
            lineHeight: 1.6,
            resize: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => {
            if (!errorText) {
              e.currentTarget.style.borderColor = 'var(--accent)'
              e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent)'
            }
          }}
          onBlur={e => {
            if (!errorText) {
              e.currentTarget.style.borderColor = 'var(--hairline2)'
              e.currentTarget.style.boxShadow = 'none'
            }
          }}
        />
      </div>

      {/* Status & Error */}
      {statusText && (
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="spinner" style={{
            width: 12, height: 12, border: '2px solid var(--text-muted)',
            borderTopColor: 'var(--text)', borderRadius: '50%',
            animation: 'spin 0.6s linear infinite'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          {statusText}
        </div>
      )}

      {errorText && (
        <div style={{
          fontSize: 12, color: 'var(--red-flag)',
          background: 'color-mix(in srgb, var(--red-flag) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--red-flag) 25%, transparent)',
          borderRadius: 6, padding: '8px 12px',
          lineHeight: 1.5,
        }}>
          {errorText}
        </div>
      )}      {/* Gemini API Limits Tracker */}
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--hairline2)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Gemini API Limits (Free Tier)
          </span>
        </div>

        {/* 1. Daily Requests Tracker (1,500 limit) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
            <span style={{ color: 'var(--text-dim)' }}>Daily Requests (1,500 RPD limit)</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>
              {dailyRequestsCount.toLocaleString()} / {DAILY_REQUEST_LIMIT.toLocaleString()}
            </span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (dailyRequestsCount / DAILY_REQUEST_LIMIT) * 100)}%`,
              height: '100%',
              background: 'var(--text)',
              borderRadius: 3,
              transition: 'width 0.3s ease-out',
            }} />
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textAlign: 'right' }}>
            {dailyRequestsRemaining.toLocaleString()} requests remaining today
          </div>
        </div>

        {/* 2. Tokens Per Minute Tracker (1,000,000 limit) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
            <span style={{ color: 'var(--text-dim)' }}>Tokens Per Minute (1M TPM limit)</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>
              {(lastTokenUsage?.total || 0).toLocaleString()} / {TPM_LIMIT.toLocaleString()}
            </span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'var(--surface3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, ((lastTokenUsage?.total || 0) / TPM_LIMIT) * 100)}%`,
              height: '100%',
              background: 'var(--text)',
              borderRadius: 3,
              transition: 'width 0.3s ease-out',
            }} />
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textAlign: 'right' }}>
            Last call used {((lastTokenUsage?.total || 0) / TPM_LIMIT * 100).toFixed(3)}% of minute capacity
          </div>
        </div>

        {lastTokenUsage ? (
          <div style={{
            borderTop: '1px solid var(--hairline)',
            paddingTop: 8,
            marginTop: 2,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--text-dim)'
          }}>
            <span>Last Request Details:</span>
            <span style={{ color: 'var(--text-muted)' }}>
              {lastTokenUsage.prompt} prompt / {lastTokenUsage.candidates} response
            </span>
          </div>
        ) : null}

        <div style={{
          borderTop: '1px solid var(--hairline)',
          paddingTop: 8,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--text-muted)'
        }}>
          <span>Lifetime Token consumption:</span>
          <strong style={{ color: 'var(--text-dim)' }}>{lifetimeTokensUsed.toLocaleString()} tokens</strong>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleSearchAndParse}
        disabled={loading || !geminiApiKey}
        style={{
          background: loading || !geminiApiKey ? 'var(--surface2)' : 'var(--accent)',
          color: loading || !geminiApiKey ? 'var(--text-muted)' : 'var(--accent-contrast)',
          border: 'none',
          borderRadius: 6,
          padding: '11px',
          fontSize: 13,
          fontWeight: 600,
          cursor: loading || !geminiApiKey ? 'default' : 'pointer',
          fontFamily: 'inherit',
          letterSpacing: '0.03em',
          flexShrink: 0,
          transition: 'opacity 0.15s, background-color 0.15s',
        }}
        onMouseEnter={e => {
          if (!loading && geminiApiKey) e.currentTarget.style.opacity = '0.9'
        }}
        onMouseLeave={e => {
          if (!loading && geminiApiKey) e.currentTarget.style.opacity = '1'
        }}
        title="Search with Google and parse (Ctrl+Enter)"
      >
        {loading ? 'Searching & Grounding...' : 'Search & Extract ⌘↵'}
      </button>
    </div>
  )
}
