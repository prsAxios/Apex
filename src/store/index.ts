import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ParsedRow, RequestMode } from '../parser'
import { loadDictionary, teachDictionary, deleteDictionaryEntry, type BrandDictionary } from '../dictionary'

export interface BrandEntry {
  id: string
  brand: string
  brandId: string
  rawLines: string
  items: ParsedRow[]
}

export interface SignatureData {
  name: string
  title: string
  email: string
}

export interface AppState {
  theme: 'dark' | 'light'
  authenticated: boolean

  // Zone A
  requestMode: RequestMode
  supplierName: string
  distributorName: string
  distributorId: string
  savedSuppliers: string[]
  savedDistributors: string[]

  // Zone B
  brands: BrandEntry[]

  // Email customisation
  emailOpening: string      // "Hi Team,"
  emailBodyText: string     // middle paragraph
  emailClosing: string      // "Please let me know..."
  signature: SignatureData
  emailPanelOpen: boolean

  // Dictionary
  dictionary: BrandDictionary

  // Zone B mode
  zoneBMode: 'smart' | 'gemini' | 'grounding'
  geminiRawJson: string

  // Gemini API and token tracking
  geminiApiKey: string
  lastTokenUsage: { prompt: number; candidates: number; total: number } | null
  lifetimeTokensUsed: number
  dailyTokenUsage: number
  lastUsageResetDate: string

  // Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null

  // Settings drawer
  settingsOpen: boolean

  // Actions
  login: (username: string, password: string) => boolean
  logout: () => void
  toggleTheme: () => void
  setRequestMode: (m: RequestMode) => void
  setSupplierName: (v: string) => void
  setDistributorName: (v: string) => void
  setDistributorId: (v: string) => void
  saveSupplier: () => void
  saveDistributor: () => void

  setEmailOpening: (v: string) => void
  setEmailBodyText: (v: string) => void
  setEmailClosing: (v: string) => void
  setSignature: (s: Partial<SignatureData>) => void
  setEmailPanelOpen: (v: boolean) => void

  addBrand: () => void
  removeBrand: (id: string) => void
  updateBrandName: (id: string, name: string) => void
  updateBrandId: (id: string, brandId: string) => void
  updateBrandRawLines: (id: string, raw: string) => void
  setBrandItems: (id: string, items: ParsedRow[]) => void
  moveBrandUp: (id: string) => void
  moveBrandDown: (id: string) => void
  setBrands: (brands: BrandEntry[]) => void

  updateItemCell: (brandId: string, rowIndex: number, field: keyof ParsedRow, value: string) => void
  deleteRow: (brandId: string, rowIndex: number) => void
  duplicateRow: (brandId: string, rowIndex: number) => void
  moveRowUp: (brandId: string, rowIndex: number) => void
  moveRowDown: (brandId: string, rowIndex: number) => void

  setZoneBMode: (m: 'smart' | 'gemini' | 'grounding') => void
  setGeminiRawJson: (v: string) => void

  setGeminiApiKey: (key: string) => void
  addTokenUsage: (prompt: number, candidates: number) => void
  clearTokenUsage: () => void

  teachWord: (alias: string, canonical: string) => void
  deleteDictEntry: (alias: string) => void
  setDictionary: (d: BrandDictionary) => void

  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  clearToast: () => void
  setSettingsOpen: (v: boolean) => void
  clearAll: () => void
}

const CREDENTIALS = { username: 'pradeep', password: 'pradeep' }

const DEFAULT_BODY_TEXT = (distName: string, distId: string, noun: string) =>
  `Could you please add the following ${noun} to the Item Catalog under the mentioned SRS supplier, for X-Ref matching purposes, for the distributor, ${distName}${distId ? ` (${distId})` : ''}.`

let toastTimeout: ReturnType<typeof setTimeout>

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark' as const,
      authenticated: false,

      requestMode: 'brand-product-package' as RequestMode,
      supplierName: '',
      distributorName: '',
      distributorId: '',
      savedSuppliers: [],
      savedDistributors: [],
      brands: [],

      zoneBMode: 'smart' as const,
      geminiRawJson: '',

      geminiApiKey: '',
      lastTokenUsage: null,
      lifetimeTokensUsed: 0,
      dailyTokenUsage: 0,
      lastUsageResetDate: new Date().toDateString(),

      emailOpening: 'Hi Team,',
      emailBodyText: '',
      emailClosing: 'Please let me know if you have any questions or need any additional information.',
      signature: { name: '', title: '', email: '' },
      emailPanelOpen: false,

      dictionary: loadDictionary(),
      toast: null,
      settingsOpen: false,

      login: (username, password) => {
        const ok = username.trim().toLowerCase() === CREDENTIALS.username &&
                   password === CREDENTIALS.password
        if (ok) set({ authenticated: true })
        return ok
      },
      logout: () => set({ authenticated: false }),

      toggleTheme: () => set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setRequestMode: (m) => set({ requestMode: m }),
      setSupplierName: (v) => set({ supplierName: v }),
      setDistributorName: (v) => set({ distributorName: v }),
      setDistributorId: (v) => set({ distributorId: v }),

      saveSupplier: () => {
        const { supplierName, savedSuppliers } = get()
        if (supplierName && !savedSuppliers.includes(supplierName))
          set({ savedSuppliers: [...savedSuppliers, supplierName] })
      },
      saveDistributor: () => {
        const { distributorName, distributorId, savedDistributors } = get()
        const combined = distributorId ? `${distributorName} (${distributorId})` : distributorName
        if (combined && !savedDistributors.includes(combined))
          set({ savedDistributors: [...savedDistributors, combined] })
      },

      setEmailOpening: (v) => set({ emailOpening: v }),
      setEmailBodyText: (v) => set({ emailBodyText: v }),
      setEmailClosing: (v) => set({ emailClosing: v }),
      setSignature: (s) => set(st => ({ signature: { ...st.signature, ...s } })),
      setEmailPanelOpen: (v) => set({ emailPanelOpen: v }),

      addBrand: () => {
        const id = crypto.randomUUID()
        set(s => ({ brands: [...s.brands, { id, brand: '', brandId: '', rawLines: '', items: [] }] }))
      },
      removeBrand: (id) => set(s => ({ brands: s.brands.filter(b => b.id !== id) })),
      updateBrandName: (id, name) =>
        set(s => ({ brands: s.brands.map(b => b.id === id ? { ...b, brand: name } : b) })),
      updateBrandId: (id, brandId) =>
        set(s => ({ brands: s.brands.map(b => b.id === id ? { ...b, brandId } : b) })),
      updateBrandRawLines: (id, raw) =>
        set(s => ({ brands: s.brands.map(b => b.id === id ? { ...b, rawLines: raw } : b) })),
      setBrandItems: (id, items) =>
        set(s => ({ brands: s.brands.map(b => b.id === id ? { ...b, items } : b) })),

      moveBrandUp: (id) => set(s => {
        const idx = s.brands.findIndex(b => b.id === id)
        if (idx <= 0) return s
        const brands = [...s.brands];
        [brands[idx - 1], brands[idx]] = [brands[idx], brands[idx - 1]]
        return { brands }
      }),
      moveBrandDown: (id) => set(s => {
        const idx = s.brands.findIndex(b => b.id === id)
        if (idx < 0 || idx >= s.brands.length - 1) return s
        const brands = [...s.brands];
        [brands[idx], brands[idx + 1]] = [brands[idx + 1], brands[idx]]
        return { brands }
      }),
      setBrands: (brands) => set({ brands }),

      updateItemCell: (brandId, rowIndex, field, value) =>
        set(s => ({
          brands: s.brands.map(b => {
            if (b.id !== brandId) return b
            const items = [...b.items]
            items[rowIndex] = { ...items[rowIndex], [field]: value }
            if (field === 'packageSize' || field === 'itemDescription') {
              items[rowIndex].flagLevel = 'none'
              items[rowIndex].flagReason = undefined
            }
            return { ...b, items }
          }),
        })),

      deleteRow: (brandId, rowIndex) =>
        set(s => ({ brands: s.brands.map(b => b.id !== brandId ? b : { ...b, items: b.items.filter((_, i) => i !== rowIndex) }) })),
      duplicateRow: (brandId, rowIndex) =>
        set(s => ({ brands: s.brands.map(b => {
          if (b.id !== brandId) return b
          const items = [...b.items]
          items.splice(rowIndex + 1, 0, { ...items[rowIndex] })
          return { ...b, items }
        })})),
      moveRowUp: (brandId, rowIndex) =>
        set(s => ({ brands: s.brands.map(b => {
          if (b.id !== brandId || rowIndex <= 0) return b
          const items = [...b.items];
          [items[rowIndex - 1], items[rowIndex]] = [items[rowIndex], items[rowIndex - 1]]
          return { ...b, items }
        })})),
      moveRowDown: (brandId, rowIndex) =>
        set(s => ({ brands: s.brands.map(b => {
          if (b.id !== brandId || rowIndex >= b.items.length - 1) return b
          const items = [...b.items];
          [items[rowIndex], items[rowIndex + 1]] = [items[rowIndex + 1], items[rowIndex]]
          return { ...b, items }
        })})),

      setZoneBMode: (m) => set({ zoneBMode: m }),
      setGeminiRawJson: (v) => set({ geminiRawJson: v }),

      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      addTokenUsage: (prompt, candidates) => {
        const todayStr = new Date().toDateString()
        const currentResetDate = get().lastUsageResetDate
        let dailyUsage = get().dailyTokenUsage
        
        if (currentResetDate !== todayStr) {
          dailyUsage = 0
        }
        
        const added = prompt + candidates
        set({
          lastTokenUsage: { prompt, candidates, total: added },
          lifetimeTokensUsed: get().lifetimeTokensUsed + added,
          dailyTokenUsage: dailyUsage + added,
          lastUsageResetDate: todayStr
        })
      },
      clearTokenUsage: () => set({ lastTokenUsage: null }),

      teachWord: (alias, canonical) => {
        const next = teachDictionary(alias, canonical, get().dictionary)
        set({ dictionary: next })
        get().showToast(`Learned: ${alias} → ${canonical}`, 'info')
      },
      deleteDictEntry: (alias) => {
        const next = deleteDictionaryEntry(alias, get().dictionary)
        set({ dictionary: next })
      },
      setDictionary: (d) => set({ dictionary: d }),

      showToast: (message, type = 'success') => {
        clearTimeout(toastTimeout)
        set({ toast: { message, type } })
        toastTimeout = setTimeout(() => set({ toast: null }), 3500)
      },
      clearToast: () => set({ toast: null }),
      setSettingsOpen: (v) => set({ settingsOpen: v }),
      clearAll: () => set({ supplierName: '', distributorName: '', distributorId: '', brands: [] }),
    }),
    {
      name: 'apex-catalog-v1',
      partialize: (s) => ({
        authenticated: s.authenticated,
        theme: s.theme,
        zoneBMode: s.zoneBMode,
        geminiRawJson: s.geminiRawJson,
        requestMode: s.requestMode,
        supplierName: s.supplierName,
        distributorName: s.distributorName,
        distributorId: s.distributorId,
        savedSuppliers: s.savedSuppliers,
        savedDistributors: s.savedDistributors,
        brands: s.brands,
        dictionary: s.dictionary,
        emailOpening: s.emailOpening,
        emailBodyText: s.emailBodyText,
        emailClosing: s.emailClosing,
        signature: s.signature,
        geminiApiKey: s.geminiApiKey,
        lastTokenUsage: s.lastTokenUsage,
        lifetimeTokensUsed: s.lifetimeTokensUsed,
        dailyTokenUsage: s.dailyTokenUsage,
        lastUsageResetDate: s.lastUsageResetDate,
      }),
    }
  )
)
