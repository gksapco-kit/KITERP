import { useCallback, useState } from 'react'

const STORAGE_PREFIX = 'kiterp.tablePageSize.'
const MAX_PAGE_SIZE = 1000

function readStoredSize(storageKey: string, fallback: number): number {
  try {
    const raw = Math.floor(Number(window.localStorage.getItem(storageKey)))
    if (Number.isFinite(raw) && raw >= 1 && raw <= MAX_PAGE_SIZE) return raw
  } catch {
    /* storage unavailable (private mode, quota) */
  }
  return fallback
}

/**
 * Rows-per-page state that survives reloads and navigation, keyed per table.
 * The value stays until the user picks a different size for that table.
 */
export function usePersistedPageSize(tableKey: string, defaultSize = 10) {
  const storageKey = STORAGE_PREFIX + tableKey
  const [pageSize, setPageSizeState] = useState(() => readStoredSize(storageKey, defaultSize))

  const setPageSize = useCallback(
    (size: number) => {
      const next = Math.floor(size)
      if (!Number.isFinite(next) || next < 1 || next > MAX_PAGE_SIZE) return
      setPageSizeState(next)
      try {
        window.localStorage.setItem(storageKey, String(next))
      } catch {
        /* storage unavailable */
      }
    },
    [storageKey],
  )

  return [pageSize, setPageSize] as const
}
