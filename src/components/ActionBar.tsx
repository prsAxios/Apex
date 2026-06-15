import { motion } from 'framer-motion'
import { useStore } from '../store'
import { copyTableToClipboard } from '../clipboard'

export function ActionBar({ onClear }: { onClear: () => void }) {
  const brands = useStore(s => s.brands)
  const requestMode = useStore(s => s.requestMode)
  const supplier = useStore(s => s.supplierName)
  const clearAll = useStore(s => s.clearAll)
  const showToast = useStore(s => s.showToast)
  const setEmailPanelOpen = useStore(s => s.setEmailPanelOpen)

  const hasRows = brands.some(b => b.items.length > 0)
  const lowCount = brands.flatMap(b => b.items).filter(i => i.confidence === 'low').length

  function handleReviewFlagged() {
    const el = document.querySelector<HTMLElement>('[data-low-confidence="true"]')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.style.outline = '2px solid var(--red-flag)'
      el.style.outlineOffset = '-1px'
      setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = '' }, 1800)
    }
  }

  async function handleCopyTable() {
    if (!hasRows) return
    const ok = await copyTableToClipboard({ supplier, brands, mode: requestMode })
    if (ok) showToast('Copied — paste straight into Sheets or your ticket')
    else showToast('Copy failed — try selecting the table manually', 'error')
  }

  function handleCopyEmail() {
    if (!hasRows) return
    setEmailPanelOpen(true)
  }

  function handleClear() {
    clearAll()
    onClear()
  }

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      padding: '10px 0 0',
      borderTop: '1px solid var(--hairline)',
      flexShrink: 0,
    }}>
      <PrimaryBtn onClick={handleCopyTable} disabled={!hasRows} title="Copy table (Ctrl+Shift+C)">
        Copy Table
      </PrimaryBtn>
      <PrimaryBtn onClick={handleCopyEmail} disabled={!hasRows} title="Copy full email">
        Copy Full Email
      </PrimaryBtn>
      {lowCount > 0 && (
        <motion.button
          onClick={handleReviewFlagged}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'color-mix(in srgb, var(--red-flag) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--red-flag) 35%, transparent)',
            color: 'var(--red-flag)',
            borderRadius: 4, padding: '5px 11px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
          title="Jump to first unverified item"
        >
          <svg width="6" height="6" viewBox="0 0 6 6" style={{ flexShrink: 0 }}>
            <circle cx="3" cy="3" r="3" fill="currentColor" />
          </svg>
          Review {lowCount} flagged {lowCount === 1 ? 'item' : 'items'}
        </motion.button>
      )}
      <div style={{ flex: 1 }} />
      <button
        onClick={handleClear}
        style={{
          background: 'none',
          border: '1px solid var(--hairline2)',
          color: 'var(--text-muted)',
          borderRadius: 4,
          padding: '7px 14px',
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red-flag)'; e.currentTarget.style.color = 'var(--red-flag)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hairline2)'; e.currentTarget.style.color = 'var(--text-muted)' }}
      >
        Clear All
      </button>
    </div>
  )
}

function PrimaryBtn({ onClick, disabled, children, title }: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  title?: string
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.98 }}
      title={title}
      style={{
        background: disabled ? 'var(--surface3)' : 'var(--accent)',
        color: disabled ? 'var(--text-muted)' : 'var(--accent-contrast)',
        border: 'none',
        borderRadius: 4,
        padding: '7px 16px',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        letterSpacing: '0.02em',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </motion.button>
  )
}
