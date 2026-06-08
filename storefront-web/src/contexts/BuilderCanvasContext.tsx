import { createContext, useContext, type ReactNode } from 'react'

export interface BuilderCanvasContextValue {
  isEditorCanvas: boolean
  activeBlockId: string | null
  /** Last-focused field — used for inline edit & toolbar readout. */
  activeTextField: string | null
  /** All selected fields (Shift/Ctrl/⌘+click). Empty when none. */
  activeTextFields: string[]
  onTextFieldActivate?: (blockId: string, fieldKey: string, opts?: { additive?: boolean }) => void
  onTextFieldCommit?: (blockId: string, fieldKey: string, value: string) => void
  onTextFieldStylePatch?: (blockId: string, fieldKey: string, patch: Record<string, unknown>) => void
  /** Apply per-field patches in one undo step. Keys = field keys, values = style patches. */
  onTextFieldBatchStylePatch?: (
    blockId: string,
    patchesByField: Record<string, Record<string, unknown>>,
  ) => void
}

const BuilderCanvasContext = createContext<BuilderCanvasContextValue | null>(null)

export function BuilderCanvasContextProvider({
  value,
  children,
}: {
  value: BuilderCanvasContextValue
  children: ReactNode
}) {
  return (
    <BuilderCanvasContext.Provider value={value}>
      {children}
    </BuilderCanvasContext.Provider>
  )
}

export function useBuilderCanvas() {
  return useContext(BuilderCanvasContext)
}
