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
  /**
   * Serialized server payload for the current scope. When unchanged (e.g. background
   * refetch returns a new object with the same values), hydration is skipped.
   */
  snapshotKey?: string | null
}

/** Build a stable key from primitive server field values (avoid whole-object deps). */
export function serverFormSnapshotKey(parts: Array<string | number | boolean | null | undefined>): string {
  return parts.map(p => (p == null ? '' : String(p))).join('\u001f')
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
  const loadedSnapshotRef = useRef<string | null>(null)

  const markDirty = useCallback(() => {
    dirtyRef.current = true
  }, [])

  const clearDirty = useCallback(() => {
    dirtyRef.current = false
  }, [])

  const { enabled = true, isSaving, scopeKey = 'default', snapshotKey = null } = options

  useLayoutEffect(() => {
    if (!enabled) return
    if (scopeKey == null) {
      loadedScopeRef.current = null
      loadedSnapshotRef.current = null
      return
    }
    if (isSaving?.()) return
    const scopeChanged = loadedScopeRef.current !== scopeKey
    const snapshot = snapshotKey ?? null
    if (
      !scopeChanged
      && !dirtyRef.current
      && snapshot != null
      && snapshot === loadedSnapshotRef.current
    ) {
      return
    }
    if (dirtyRef.current && !scopeChanged) return
    hydrate()
    loadedScopeRef.current = scopeKey
    loadedSnapshotRef.current = snapshot
    if (scopeChanged) dirtyRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns hydrate deps
  }, [scopeKey, snapshotKey, enabled, ...deps])

  return { markDirty, clearDirty, dirtyRef }
}
