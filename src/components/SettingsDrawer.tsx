import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import { exportDictionary, importDictionary } from '../dictionary'

export function SettingsDrawer() {
  const open = useStore(s => s.settingsOpen)
  const setOpen = useStore(s => s.setSettingsOpen)
  const dictionary = useStore(s => s.dictionary)
  const deleteDictEntry = useStore(s => s.deleteDictEntry)
  const setDictionary = useStore(s => s.setDictionary)
  const showToast = useStore(s => s.showToast)
  const geminiApiKey = useStore(s => s.geminiApiKey)
  const setGeminiApiKey = useStore(s => s.setGeminiApiKey)
  const fileRef = useRef<HTMLInputElement>(null)

  const entries = Object.entries(dictionary).sort((a, b) => a[0].localeCompare(b[0]))

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const next = importDictionary(ev.target?.result as string, dictionary)
        setDictionary(next)
        showToast(`Imported ${Object.keys(next).length} entries`, 'success')
      } catch {
        showToast('Invalid JSON file', 'error')
      }
    }
    reader.readAsText(file)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              zIndex: 200,
            }}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              right: 0, top: 0, bottom: 0,
              width: 380,
              background: 'var(--surface)',
              borderLeft: '1px solid var(--hairline)',
              zIndex: 201,
              display: 'flex',
              flexDirection: 'column',
              padding: '24px 20px',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="zone-label">Settings</div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 18, cursor: 'pointer', padding: 0 }}
              >×</button>
            </div>

            {/* Gemini API Key Configuration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--hairline)', paddingBottom: 16 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Gemini API Configuration
              </label>
              <input
                type="password"
                placeholder="AIzaSy... (Gemini API Key)"
                value={geminiApiKey}
                onChange={e => setGeminiApiKey(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--surface2)',
                  border: '1px solid var(--hairline2)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  padding: '8px 12px',
                  fontSize: 13,
                  outline: 'none',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--hairline2)')}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Used client-side for active Google Search grounding features. Get keys from Google AI Studio.
              </div>
            </div>

            {/* Brand Dictionary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Brand Dictionary
              </label>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 4 }}>
                Aliases that auto-resolve to canonical brand names. Every manual brand edit teaches this dictionary.
              </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {entries.map(([alias, canonical]) => (
                <div
                  key={alias}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    background: 'var(--surface2)',
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-dim)', flexShrink: 0, minWidth: 100 }}>{alias}</span>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <span style={{ flex: 1, color: 'var(--text)' }}>{canonical}</span>
                  <button
                    onClick={() => deleteDictEntry(alias)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '0 4px' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--red-flag)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >✕</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => exportDictionary(dictionary)}
                style={{
                  flex: 1,
                  background: 'none',
                  border: '1px solid var(--hairline2)',
                  color: 'var(--text-dim)',
                  borderRadius: 4,
                  padding: '7px',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Export JSON
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  flex: 1,
                  background: 'none',
                  border: '1px solid var(--hairline2)',
                  color: 'var(--text-dim)',
                  borderRadius: 4,
                  padding: '7px',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Import JSON
              </button>
              <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            </div>
          </div>
        </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
