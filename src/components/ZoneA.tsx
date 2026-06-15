import { useStore } from '../store'
import type { RequestMode } from '../parser'
import { AutocompleteInput } from './AutocompleteInput'

const MODE_OPTIONS: Array<{ value: RequestMode; label: string; hint: string }> = [
  { value: 'brand-product-package', label: 'Brand + Product + Package', hint: 'New brand — everything gets added' },
  { value: 'product-package', label: 'Product + Package', hint: 'Brand exists — provide its Brand ID' },
  { value: 'package-only', label: 'Package only', hint: 'Brand & product exist — provide Brand ID and Product ID' },
]

export function ZoneA() {
  const requestMode = useStore(s => s.requestMode)
  const setRequestMode = useStore(s => s.setRequestMode)
  const supplierName = useStore(s => s.supplierName)
  const distributorName = useStore(s => s.distributorName)
  const distributorId = useStore(s => s.distributorId)
  const savedSuppliers = useStore(s => s.savedSuppliers)
  const savedDistributors = useStore(s => s.savedDistributors)
  const setSupplierName = useStore(s => s.setSupplierName)
  const setDistributorName = useStore(s => s.setDistributorName)
  const setDistributorId = useStore(s => s.setDistributorId)
  const saveSupplier = useStore(s => s.saveSupplier)
  const saveDistributor = useStore(s => s.saveDistributor)

  // Build combined distributor suggestions
  const distSuggestions = savedDistributors.map(d => {
    const m = d.match(/^(.+?)\s*\((\d+)\)$/)
    return m ? { name: m[1].trim(), id: m[2] } : { name: d, id: '' }
  })

  const combinedDist = distributorId
    ? `${distributorName} (${distributorId})`
    : distributorName

  const distStrings = savedDistributors

  function handleDistSelect(val: string) {
    const m = val.match(/^(.+?)\s*\((\d+)\)$/)
    if (m) {
      setDistributorName(m[1].trim())
      setDistributorId(m[2])
    } else {
      setDistributorName(val)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="zone-label" style={{ marginBottom: -8 }}>Request Setup</div>

      <div>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Request Type
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {MODE_OPTIONS.map(opt => {
            const active = requestMode === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setRequestMode(opt.value)}
                title={opt.hint}
                style={{
                  textAlign: 'left',
                  background: active ? 'var(--surface3)' : 'var(--surface2)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--hairline2)'}`,
                  borderRadius: 4,
                  color: active ? 'var(--text)' : 'var(--text-dim)',
                  padding: '7px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 }}>
          {MODE_OPTIONS.find(o => o.value === requestMode)?.hint}
        </div>
      </div>

      <AutocompleteInput
        label="Supplier Name"
        value={supplierName}
        onChange={setSupplierName}
        suggestions={savedSuppliers}
        placeholder="e.g. MHW Ltd. (MHW)"
        onBlur={saveSupplier}
      />

      <div>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Distributor
        </label>
        <AutocompleteInput
          value={distributorName}
          onChange={val => {
            const m = val.match(/^(.+?)\s*\((\d+)\)$/)
            if (m) {
              setDistributorName(m[1].trim())
              setDistributorId(m[2])
            } else {
              setDistributorName(val)
            }
          }}
          suggestions={distStrings}
          placeholder="Name"
          onBlur={saveDistributor}
        />
        <input
          type="text"
          value={distributorId}
          onChange={e => setDistributorId(e.target.value)}
          onBlur={saveDistributor}
          placeholder="ID (optional)"
          style={{
            width: '100%',
            marginTop: 6,
            background: 'var(--surface2)',
            border: '1px solid var(--hairline2)',
            borderRadius: 4,
            color: 'var(--text)',
            padding: '7px 10px',
            fontSize: 13,
            outline: 'none',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--hairline2)')}
        />
      </div>

      {savedSuppliers.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Suppliers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {savedSuppliers.slice(-5).reverse().map(s => (
              <button
                key={s}
                onClick={() => setSupplierName(s)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                  padding: '3px 0',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
