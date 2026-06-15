import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store'

export function LoginScreen() {
  const login = useStore(s => s.login)
  const theme = useStore(s => s.theme)
  const toggleTheme = useStore(s => s.toggleTheme)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { usernameRef.current?.focus() }, [])

  // Apply theme on login screen too
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') root.setAttribute('data-theme', 'light')
    else root.removeAttribute('data-theme')
    requestAnimationFrame(() => {
      const canvas = getComputedStyle(root).getPropertyValue('--canvas').trim()
      root.style.background = canvas
      document.body.style.background = canvas
    })
  }, [theme])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) { setError('Please enter your credentials.'); return }
    setLoading(true)
    setError('')
    // Simulate brief network delay for realism
    await new Promise(r => setTimeout(r, 420))
    const ok = login(username, password)
    if (!ok) {
      setError('Invalid username or password.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--canvas)',
      padding: 24,
      transition: 'background 0.2s',
    }}>

      {/* Theme toggle — top right */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        style={{
          position: 'fixed', top: 20, right: 24,
          background: 'none', border: '1px solid var(--hairline2)',
          color: 'var(--text-dim)', borderRadius: 8, padding: '6px 12px',
          fontSize: 13, cursor: 'pointer',
          transition: 'border-color 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-dim)'; e.currentTarget.style.color = 'var(--text)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hairline2)'; e.currentTarget.style.color = 'var(--text-dim)' }}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        className="login-card"
      >
        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="wordmark" style={{ color: 'var(--text)', marginBottom: 6 }}>
            Apex
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Item Catalog Support
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.04em' }}>
              USERNAME
            </label>
            <input
              ref={usernameRef}
              className="field-input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              placeholder="Enter username"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.04em' }}>
              PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <input
                className="field-input"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Enter password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', fontSize: 12, padding: 4,
                  transition: 'color 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              style={{
                fontSize: 12.5, color: 'var(--red-flag)',
                background: 'color-mix(in srgb, var(--red-flag) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--red-flag) 25%, transparent)',
                borderRadius: 6, padding: '8px 12px',
              }}
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ marginTop: 4, width: '100%', padding: '11px', fontSize: 14 }}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Spinner /> Signing in…
              </span>
            ) : 'Sign in'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none"
      style={{ animation: 'spin 0.7s linear infinite' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
