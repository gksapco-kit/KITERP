export type SortDir = 'asc' | 'desc'

function parseSortValue(v: unknown): string | number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (v instanceof Date) return v.getTime()
  const s = String(v ?? '').trim()
  const n = parseFloat(s)
  if (s !== '' && !Number.isNaN(n) && /^-?\d/.test(s)) return n
  return s.toLowerCase()
}

export function compareSort(a: unknown, b: unknown, dir: SortDir): number {
  const va = parseSortValue(a)
  const vb = parseSortValue(b)
  let cmp = 0
  if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
  else cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
  return dir === 'asc' ? cmp : -cmp
}

export function sortRows<T>(rows: T[], getValue: (row: T) => unknown, dir: SortDir): T[] {
  return [...rows].sort((a, b) => compareSort(getValue(a), getValue(b), dir))
}

export function filterRowsBySearch<T>(rows: T[], query: string, getSearchable: (row: T) => string[]): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => getSearchable(row).some((s) => String(s).toLowerCase().includes(q)))
}

export function processRows<T>(
  rows: T[] | undefined,
  query: string,
  getSearchable: (row: T) => string[],
  sortKey: string,
  sortDir: SortDir,
  accessors: Record<string, (row: T) => unknown>,
): T[] {
  let list = rows ?? []
  list = filterRowsBySearch(list, query, getSearchable)
  const acc = accessors[sortKey] ?? accessors[Object.keys(accessors)[0]]
  if (!acc) return list
  return sortRows(list, (r) => acc(r), sortDir)
}
