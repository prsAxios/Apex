const STORAGE_KEY = 'xref_brand_dictionary'

export type BrandDictionary = Record<string, string> // alias → canonical

const SEEDS: BrandDictionary = {
  jacquart: "Champagne Jacquart",
  odriscolls: "O'Driscolls",
  "o'driscolls": "O'Driscolls",
}

export function loadDictionary(): BrandDictionary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as BrandDictionary
      return { ...SEEDS, ...stored }
    }
  } catch {}
  return { ...SEEDS }
}

export function saveDictionary(dict: BrandDictionary): void {
  try {
    // Only store user-added entries (not seeds), to keep seeds updatable
    const userEntries: BrandDictionary = {}
    for (const [k, v] of Object.entries(dict)) {
      if (SEEDS[k] !== v || !(k in SEEDS)) {
        userEntries[k] = v
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userEntries))
  } catch {}
}

export function resolveAlias(input: string, dict: BrandDictionary): string {
  const key = input.toLowerCase().replace(/[^a-z0-9]/g, '')
  return dict[key] ?? dict[input.toLowerCase()] ?? input
}

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Damerau-Levenshtein distance (optimal string alignment): insertions,
// deletions, substitutions, and adjacent transpositions all cost 1. Catches
// the typo classes that actually occur when typing brand names by hand.
export function damerauLevenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prevPrev = new Array<number>(n + 1).fill(0)
  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,        // deletion
        curr[j - 1] + 1,    // insertion
        prev[j - 1] + cost  // substitution
      )
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        curr[j] = Math.min(curr[j], prevPrev[j - 2] + 1) // transposition
      }
    }
    ;[prevPrev, prev, curr] = [prev, curr, prevPrev]
  }
  return prev[n]
}

export interface FuzzyMatch {
  canonical: string
  alias: string
  distance: number
  exact: boolean
}

// Resolves an alias against the dictionary, tolerating typos. Exact
// (normalized) hits win outright; otherwise the closest alias within an
// adaptive edit-distance budget (1 for short keys, 2 for longer ones) is
// accepted. Ties break toward the shorter distance, then the longer alias
// (more specific match). Returns null when nothing is close enough — the
// resolver never guesses wildly.
export function fuzzyResolveAlias(input: string, dict: BrandDictionary): FuzzyMatch | null {
  const key = normalizeKey(input)
  if (!key) return null

  if (dict[key]) return { canonical: dict[key], alias: key, distance: 0, exact: true }
  const lowered = input.toLowerCase()
  if (dict[lowered]) return { canonical: dict[lowered], alias: lowered, distance: 0, exact: true }

  const budget = key.length >= 6 ? 2 : key.length >= 4 ? 1 : 0
  if (budget === 0) return null

  let best: FuzzyMatch | null = null
  for (const [alias, canonical] of Object.entries(dict)) {
    const aliasKey = normalizeKey(alias)
    // Cheap length prefilter before computing the full distance matrix
    if (Math.abs(aliasKey.length - key.length) > budget) continue
    const distance = damerauLevenshtein(key, aliasKey)
    if (distance > budget) continue
    if (
      !best ||
      distance < best.distance ||
      (distance === best.distance && aliasKey.length > best.alias.length)
    ) {
      best = { canonical, alias: aliasKey, distance, exact: false }
    }
  }
  return best
}

export function teachDictionary(
  alias: string,
  canonical: string,
  dict: BrandDictionary
): BrandDictionary {
  const key = alias.toLowerCase().replace(/[^a-z0-9]/g, '')
  const next = { ...dict, [key]: canonical, [alias.toLowerCase()]: canonical }
  saveDictionary(next)
  return next
}

export function deleteDictionaryEntry(alias: string, dict: BrandDictionary): BrandDictionary {
  const next = { ...dict }
  delete next[alias]
  saveDictionary(next)
  return next
}

export function exportDictionary(dict: BrandDictionary): void {
  const blob = new Blob([JSON.stringify(dict, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'brand-dictionary.json'
  a.click()
  URL.revokeObjectURL(url)
}

export function importDictionary(
  json: string,
  current: BrandDictionary
): BrandDictionary {
  const incoming = JSON.parse(json) as BrandDictionary
  const merged = { ...current, ...incoming }
  saveDictionary(merged)
  return merged
}
