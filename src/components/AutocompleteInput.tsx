import { useState, useRef, useEffect } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder?: string
  label?: string
  onBlur?: () => void
}

export function AutocompleteInput({ value, onChange, suggestions, placeholder, label, onBlur }: Props) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = suggestions.filter(s =>
    s.toLowerCase().includes(value.toLowerCase()) && s !== value
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && (
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {label}
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => { setFocused(true); setOpen(true) }}
        onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 150); onBlur?.() }}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: 'var(--surface2)',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--hairline2)'}`,
          borderRadius: 4,
          color: 'var(--text)',
          padding: '7px 10px',
          fontSize: 13,
          outline: 'none',
          transition: 'border-color 0.15s',
        }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--surface3)',
          border: '1px solid var(--hairline2)',
          borderRadius: 4,
          zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          {filtered.slice(0, 8).map(s => (
            <div
              key={s}
              onMouseDown={() => { onChange(s); setOpen(false) }}
              style={{
                padding: '7px 10px',
                fontSize: 13,
                cursor: 'pointer',
                color: 'var(--text)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--hairline2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
