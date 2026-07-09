import { useCallback, useState } from 'react'

type PatchMutation = {
  mutateAsync: (args: { id: string; data: Record<string, unknown> }) => Promise<unknown>
}

/** Shared saving state + field patch helper for Excel-style inline table edits. */
export function useInlineFieldPatch(updateMutation: PatchMutation) {
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null)

  const cellKey = useCallback((entityId: string, field: string) => `${entityId}:${field}`, [])

  const isSaving = useCallback(
    (entityId: string, field: string) => savingCellKey === cellKey(entityId, field),
    [cellKey, savingCellKey],
  )

  const patchField = useCallback(async (entityId: string, field: string, value: unknown) => {
    const key = cellKey(entityId, field)
    setSavingCellKey(key)
    try {
      await updateMutation.mutateAsync({ id: entityId, data: { [field]: value } })
    } finally {
      setSavingCellKey(null)
    }
  }, [cellKey, updateMutation])

  return { savingCellKey, setSavingCellKey, cellKey, isSaving, patchField }
}

export const INLINE_EDIT_HINT = 'Double-click any cell to edit. Calculated fields show a message when edited. Press Enter to save, Esc to cancel.'
