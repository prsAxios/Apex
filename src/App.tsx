import { useState, useEffect } from 'react'
import { ZoneA } from './components/ZoneA'
import { ZoneB } from './components/ZoneB'
import { OutputTable } from './components/OutputTable'
import { ActionBar } from './components/ActionBar'
import { Toast } from './components/Toast'
import { SettingsDrawer } from './components/SettingsDrawer'
import { LoginScreen } from './components/LoginScreen'
import { EmailPanel } from './components/EmailPanel'
import { useStore } from './store'
import { copyTableToClipboard } from './clipboard'

export default function App() {
  const authenticated = useStore(s => s.authenticated)
  if (!authenticated) return <LoginScreen />
  return <MainApp />
}

function MainApp() {
  const [generated, setGenerated] = useState(false)
  const theme      = useStore(s => s.theme)
  const toggleTheme = useStore(s => s.toggleTheme)
  const setSettingsOpen = useStore(s => s.setSettingsOpen)
  const brands     = useStore(s => s.brands)
  const supplier   = useStore(s => s.supplierName)
  const requestMode = useStore(s => s.requestMode)
  const showToast  = useStore(s => s.showToast)
  const logout     = useStore(s => s.logout)

  // Apply theme. We set both the attribute (so CSS vars cascade) and
  // directly write background on html+body so the rule wins regardless
  // of layer order with Tailwind preflight.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light')
    } else {
      root.removeAttribute('data-theme')
    }
    // Resolve the current --canvas value after the attribute flip
    requestAnimationFrame(() => {
      const canvas = getComputedStyle(root).getPropertyValue('--canvas').trim()
      root.style.background = canvas
      document.body.style.background = canvas
    })
  }, [theme])

  // Restore generated state on mount
  useEffect(() => {
    if (brands.some(b => b.items.length > 0)) setGenerated(true)
  }, [])

  // Global shortcut: Ctrl+Shift+C → copy table
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        if (brands.some(b => b.items.length > 0)) {
          copyTableToClipboard({ supplier, brands, mode: requestMode }).then(ok => {
            if (ok) showToast('Copied — paste straight into Sheets or your ticket')
          })
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [brands, supplier, requestMode])

  const surfaceStyle = {
    background: 'var(--surface)',
    transition: 'background 0.22s ease-out',
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--canvas)',
      overflow: 'hidden',
      transition: 'background 0.22s ease-out',
    }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        height: 54,
        borderBottom: '1px solid var(--hairline)',
        flexShrink: 0,
        ...surfaceStyle,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="wordmark" style={{ color: 'var(--text)' }}>
            Apex
          </span>
          <span style={{ width: 1, height: 16, background: 'var(--hairline2)', display: 'inline-block' }} />
          <span style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}>
            Catalog Support
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HeaderBtn
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            {theme === 'dark' ? '○' : '●'}
          </HeaderBtn>
          <HeaderBtn onClick={() => setSettingsOpen(true)} title="Brand Dictionary">
            Brand Dictionary
          </HeaderBtn>
          <HeaderBtn onClick={logout} title="Sign out">
            Sign out
          </HeaderBtn>
        </div>
      </header>

      {/* ── Three-zone body ──────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '248px 292px 1fr',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}>

        {/* Zone A — Request Setup */}
        <aside style={{
          borderRight: '1px solid var(--hairline)',
          padding: '22px 20px',
          overflowY: 'auto',
          ...surfaceStyle,
        }}>
          <ZoneA />
        </aside>

        {/* Zone B — Items Input */}
        <aside style={{
          borderRight: '1px solid var(--hairline)',
          padding: '22px 18px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--canvas2)',
          transition: 'background 0.22s ease-out',
        }}>
          <ZoneB onGenerate={() => setGenerated(true)} />
        </aside>

        {/* Zone C — Output Table */}
        <main style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '22px 28px 18px',
          minWidth: 0,
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div className="zone-label" style={{ marginBottom: 14, flexShrink: 0 }}>
            Output Table
          </div>
          <OutputTable generated={generated} />
          <ActionBar onClear={() => setGenerated(false)} />
        </main>
      </div>

      <Toast />
      <SettingsDrawer />
      <EmailPanel />
    </div>
  )
}

function HeaderBtn({
  onClick, title, children,
}: { onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none',
        border: '1px solid var(--hairline2)',
        color: 'var(--text-dim)',
        borderRadius: 4,
        padding: '5px 12px',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        letterSpacing: '0.02em',
        transition: 'border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--text-dim)'
        e.currentTarget.style.color = 'var(--text)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--hairline2)'
        e.currentTarget.style.color = 'var(--text-dim)'
      }}
    >
      {children}
    </button>
  )
}
