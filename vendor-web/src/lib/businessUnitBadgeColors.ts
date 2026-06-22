/** Distinct pill colors per business unit — stable for the same store id or code. */
const BU_BADGE_PALETTES = [
  { border: 'border-violet-200', bg: 'bg-violet-50', text: 'text-violet-800' },
  { border: 'border-sky-200', bg: 'bg-sky-50', text: 'text-sky-800' },
  { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-900' },
  { border: 'border-rose-200', bg: 'bg-rose-50', text: 'text-rose-800' },
  { border: 'border-teal-200', bg: 'bg-teal-50', text: 'text-teal-800' },
  { border: 'border-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-800' },
  { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-900' },
  { border: 'border-cyan-200', bg: 'bg-cyan-50', text: 'text-cyan-900' },
  { border: 'border-fuchsia-200', bg: 'bg-fuchsia-50', text: 'text-fuchsia-800' },
  { border: 'border-lime-200', bg: 'bg-lime-50', text: 'text-lime-900' },
  { border: 'border-pink-200', bg: 'bg-pink-50', text: 'text-pink-800' },
  { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800' },
] as const

function hashBusinessUnitKey(key: string): number {
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return hash
}

export function resolveBusinessUnitBadgeClassName(
  storeId?: string | null,
  storeCode?: string | null,
): string {
  const key = (storeId?.trim() || storeCode?.trim() || '').toLowerCase()
  if (!key) {
    return 'border-violet-200 bg-violet-50 text-violet-800'
  }
  const palette = BU_BADGE_PALETTES[hashBusinessUnitKey(key) % BU_BADGE_PALETTES.length]
  return `${palette.border} ${palette.bg} ${palette.text}`
}
