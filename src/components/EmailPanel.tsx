import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'
import { buildTableHtml, buildTsv, MODE_CONFIG } from '../clipboard'

type Tab = 'body' | 'signature'

export function EmailPanel() {
  const open    = useStore(s => s.emailPanelOpen)
  const setOpen = useStore(s => s.setEmailPanelOpen)
  const showToast = useStore(s => s.showToast)

  const brands      = useStore(s => s.brands)
  const supplier    = useStore(s => s.supplierName)
  const requestMode = useStore(s => s.requestMode)

  const storedDistName = useStore(s => s.distributorName)
  const storedDistId   = useStore(s => s.distributorId)
  const storedOpening  = useStore(s => s.emailOpening)
  const storedClosing  = useStore(s => s.emailClosing)
  const storedSig      = useStore(s => s.signature)

  const setEmailOpening = useStore(s => s.setEmailOpening)
  const setEmailClosing = useStore(s => s.setEmailClosing)
  const setSignature    = useStore(s => s.setSignature)
  const setDistName     = useStore(s => s.setDistributorName)
  const setDistId       = useStore(s => s.setDistributorId)

  const noun = MODE_CONFIG[requestMode].emailNoun

  // Tab state
  const [tab, setTab] = useState<Tab>('body')

  // Mail body local state
  const [opening,   setOpening]  = useState(storedOpening)
  const [closing,   setClosing]  = useState(storedClosing)
  const [distName,  setDistName2] = useState(storedDistName)
  const [distId,    setDistId2]   = useState(storedDistId)
  const [copying,   setCopying]  = useState(false)

  // Reset mail body locals when panel opens
  useEffect(() => {
    if (!open) return
    setOpening(storedOpening)
    setClosing(storedClosing)
    setDistName2(storedDistName)
    setDistId2(storedDistId)
    setTab('body')
  }, [open])

  const distStr = distId ? `${distName} (${distId})` : distName
  const bodyText = `Could you please add the following ${noun} to the Item Catalog under the mentioned SRS supplier, for X-Ref matching purposes, for the distributor, ${distStr || '[Distributor Name]'}.`

  function handleClose() { setOpen(false) }

  async function handleCopy() {
    const tableHtml = buildTableHtml({ supplier, brands, mode: requestMode })
    const tableTsv  = buildTsv({ supplier, brands, mode: requestMode })
    const sig = storedSig
    const sigBlock = [sig.name, sig.title, sig.email].filter(Boolean).join('\n')

    function esc(s: string) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }

    const html = [
      `<p>${esc(opening)}</p>`,
      `<p>${esc(bodyText)}</p>`,
      `<p>Required ${esc(noun)} :</p>`,
      tableHtml,
      `<p>${esc(closing)}</p>`,
      sigBlock ? `<p style="margin-top:16px;white-space:pre-line;">${esc(sigBlock)}</p>` : '',
    ].filter(Boolean).join('\n')

    const text = [
      opening, '', bodyText, '', `Required ${noun} :`, '', tableTsv, '', closing,
      ...(sigBlock ? ['', sigBlock] : []),
    ].join('\n')

    setCopying(true)
    try {
      let ok = false
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html':  new Blob([html],  { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        })])
        ok = true
      } else {
        const el = document.createElement('div')
        el.contentEditable = 'true'
        el.style.cssText = 'position:fixed;left:-9999px;opacity:0'
        el.innerHTML = html
        document.body.appendChild(el)
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges(); sel?.addRange(range)
        ok = document.execCommand('copy')
        sel?.removeAllRanges()
        document.body.removeChild(el)
      }
      // Persist mail body fields on copy
      setEmailOpening(opening)
      setEmailClosing(closing)
      setDistName(distName)
      setDistId(distId)
      if (ok) {
        showToast('Email copied — paste into Zendesk or Gmail')
        setOpen(false)
      } else {
        showToast('Copy failed', 'error')
      }
    } finally {
      setCopying(false)
    }
  }

  const hasRows = brands.some(b => b.items.length > 0)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="email-panel-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
        >
          <motion.div
            className="email-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px 0', flexShrink: 0,
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                Compose Email
              </div>
              <button
                onClick={handleClose}
                style={{
                  background: 'none', border: '1px solid var(--hairline2)',
                  color: 'var(--text-muted)', borderRadius: 8, width: 32, height: 32,
                  cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-dim)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--hairline2)'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >×</button>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', gap: 0, padding: '12px 24px 0', borderBottom: '1px solid var(--hairline)',
              flexShrink: 0,
            }}>
              {(['body', 'signature'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '8px 16px', fontSize: 13, fontWeight: 500,
                    color: tab === t ? 'var(--text)' : 'var(--text-muted)',
                    borderBottom: tab === t ? '2px solid var(--text)' : '2px solid transparent',
                    marginBottom: -1,
                    transition: 'color 0.15s',
                    letterSpacing: '0.01em',
                  }}
                >
                  {t === 'body' ? 'Mail Body' : 'Signature'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {tab === 'body' ? (
                <MailBodyTab
                  opening={opening} setOpening={setOpening}
                  closing={closing}  setClosing={setClosing}
                  distName={distName} setDistName={setDistName2}
                  distId={distId}    setDistId={setDistId2}
                  noun={noun}
                />
              ) : (
                <SignatureTab />
              )}
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end',
              padding: '14px 24px 20px', borderTop: '1px solid var(--hairline)', flexShrink: 0,
            }}>
              <button className="btn-ghost" onClick={handleClose}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleCopy}
                disabled={copying || !hasRows}
              >
                {copying ? 'Copying…' : 'Copy Email'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ── Mail Body Tab ────────────────────────────────────────────────────────── */
function MailBodyTab({
  opening, setOpening,
  closing,  setClosing,
  distName, setDistName,
  distId,   setDistId,
  noun,
}: {
  opening: string;  setOpening: (v: string) => void
  closing: string;  setClosing: (v: string) => void
  distName: string; setDistName: (v: string) => void
  distId: string;   setDistId: (v: string) => void
  noun: string
}) {
  const inp: React.CSSProperties = {
    background: 'var(--canvas2)', border: '1px solid var(--hairline2)',
    borderRadius: 8, color: 'var(--text)', padding: '9px 13px',
    fontSize: 13, outline: 'none', width: '100%',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }
  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'var(--hairline2)'
    e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--text) 8%, transparent)'
  }
  const blur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'var(--hairline2)'
    e.currentTarget.style.boxShadow = 'none'
  }

  const blockStyle: React.CSSProperties = {
    background: 'var(--surface2)', borderRadius: 10,
    padding: '14px 16px', marginBottom: 12,
    fontSize: 13.5, color: 'var(--text)', lineHeight: 1.7,
  }
  const label: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6, display: 'block',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Greeting */}
      <div>
        <span style={label}>Greeting</span>
        <input style={inp} value={opening} onChange={e => setOpening(e.target.value)}
          onFocus={focus} onBlur={blur} />
      </div>

      {/* Live body preview */}
      <div>
        <span style={label}>Body — enter distributor details below</span>
        <div style={{ ...blockStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Distributor inputs embedded in context */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Distributor Name</div>
              <input
                style={inp}
                value={distName}
                onChange={e => setDistName(e.target.value)}
                placeholder="e.g. Imperial Beverage Co"
                onFocus={focus} onBlur={blur}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Distributor ID</div>
              <input
                style={inp}
                value={distId}
                onChange={e => setDistId(e.target.value)}
                placeholder="e.g. 10010793"
                onFocus={focus} onBlur={blur}
              />
            </div>
          </div>
          {/* Live sentence */}
          <div style={{
            fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.75,
            padding: '10px 14px', background: 'var(--canvas2)',
            borderRadius: 8, border: '1px solid var(--hairline)',
          }}>
            Could you please add the following{' '}
            <strong style={{ color: 'var(--text)' }}>{noun}</strong>
            {' '}to the Item Catalog under the mentioned SRS supplier, for X-Ref matching purposes, for the distributor,{' '}
            <strong style={{ color: 'var(--text)' }}>
              {distName || <em style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Distributor Name</em>}
              {distId ? ` (${distId})` : ''}
            </strong>.
          </div>
        </div>
      </div>

      {/* Table placeholder */}
      <div style={{
        border: '1px dashed var(--hairline2)', borderRadius: 8, padding: '12px 16px',
        fontSize: 12, color: 'var(--text-muted)', textAlign: 'center',
      }}>
        [ Table from output will be inserted here ]
      </div>

      {/* Closing */}
      <div>
        <span style={label}>Closing</span>
        <input style={inp} value={closing} onChange={e => setClosing(e.target.value)}
          onFocus={focus} onBlur={blur} />
      </div>

      {/* Signature preview (read-only, edit in Signature tab) */}
      <SignaturePreviewBanner />
    </div>
  )
}

function SignaturePreviewBanner() {
  const sig = useStore(s => s.signature)
  const lines = [sig.name, sig.title, sig.email].filter(Boolean)
  if (!lines.length) return (
    <div style={{
      fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic',
      borderTop: '1px solid var(--hairline)', paddingTop: 10, marginTop: 4,
    }}>
      No signature set — go to the Signature tab to add one.
    </div>
  )
  return (
    <div style={{
      borderTop: '1px solid var(--hairline)', paddingTop: 10, marginTop: 4,
      fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.8,
    }}>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  )
}

/* ── Signature Tab ────────────────────────────────────────────────────────── */
function SignatureTab() {
  const sig         = useStore(s => s.signature)
  const setSignature = useStore(s => s.setSignature)

  const inp: React.CSSProperties = {
    background: 'var(--canvas2)', border: '1px solid var(--hairline2)',
    borderRadius: 8, color: 'var(--text)', padding: '9px 13px',
    fontSize: 13, outline: 'none', width: '100%',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }
  const focus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--text) 8%, transparent)'
  }
  const blur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.boxShadow = 'none'
  }
  const label: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6, display: 'block',
  }

  const fields = [
    { key: 'name'  as const, label: 'Full Name', placeholder: 'Pradeep Suthar' },
    { key: 'title' as const, label: 'Title',     placeholder: 'Item Catalog Support' },
    { key: 'email' as const, label: 'Email',     placeholder: 'pradeep.suthar@vtinfo.com' },
  ]

  const preview = [sig.name, sig.title, sig.email].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Your signature is saved automatically and applied to every email you copy.
      </div>

      {fields.map(f => (
        <div key={f.key}>
          <span style={label}>{f.label}</span>
          <input
            style={inp}
            value={sig[f.key]}
            onChange={e => setSignature({ [f.key]: e.target.value })}
            placeholder={f.placeholder}
            onFocus={focus}
            onBlur={blur}
          />
        </div>
      ))}

      {preview.length > 0 && (
        <div style={{
          marginTop: 8, padding: '14px 16px',
          background: 'var(--surface2)', borderRadius: 10,
          borderLeft: '3px solid var(--hairline2)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Preview
          </div>
          {preview.map((l, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.8 }}>{l}</div>
          ))}
        </div>
      )}
    </div>
  )
}
