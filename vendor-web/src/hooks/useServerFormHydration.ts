import { useLayoutEffect, useRef, useCallback, type DependencyList } from 'react'

export type ServerFormHydrationOptions = {
  /** When false, hydration is skipped. */
  enabled?: boolean
  /** Return true while save is in flight — skips hydration. */
  isSaving?: () => boolean
  /**
   * When this key changes (e.g. vendor id, store id), re-hydrate even if the user
   * had unsaved edits for the previous scope.
   */
  scopeKey?: string | null
}

/**
 * Sync local form state from server/vendor without clobbering in-progress edits when
 * the vendor or store object gets a new reference (background refresh, zustand updates).
 */
export function useServerFormHydration(
  hydrate: () => void,
  deps: DependencyList,
  options: ServerFormHydrationOptions = {},
) {
  const dirtyRef = useRef(false)
  const loadedScopeRef = useRef<string | null>(null)

  const markDirty = useCallback(() => {
    dirtyRef.current = true
  }, [])

  const clearDirty = useCallback(() => {
    dirtyRef.current = false
  }, [])

  const { enabled = true, isSaving, scopeKey = 'default' } = options

  useLayoutEffect(() => {
    if (!enabled) return
    if (scopeKey == null) {
      loadedScopeRef.current = null
      return
    }
    if (isSaving?.()) return
    const scopeChanged = loadedScopeRef.current !== scopeKey
    if (dirtyRef.current && !scopeChanged) return
    hydrate()
    loadedScopeRef.current = scopeKey
    if (scopeChanged) dirtyRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns hydrate deps
  }, [scopeKey, enabled, ...deps])

  return { markDirty, clearDirty, dirtyRef }
}
