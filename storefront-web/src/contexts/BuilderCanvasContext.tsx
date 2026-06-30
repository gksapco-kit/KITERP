import { createContext, useContext, type ReactNode } from 'react'
import type { ActiveCanvasImageTarget } from '@/lib/canvasImageTarget'

export interface BuilderCanvasContextValue {
  isEditorCanvas: boolean
  /** Draft browser preview (`/preview/draft`) — show chrome like live site but keep cookie banner visible. */
  isDraftPreview?: boolean
  activeBlockId: string | null
  /** Last-focused field — used for inline edit & toolbar readout. */
  activeTextField: string | null
  /** All selected fields (Shift/Ctrl/⌘+click). Empty when none. */
  activeTextFields: string[]
  /** Selected section / card photos on the active block (Shift/Ctrl+click for multi). */
  activeCanvasImageTarget?: ActiveCanvasImageTarget | null
  /** Block props for the active block — used to read image fit / focal while rendering. */
  blockPropsForImage?: Record<string, unknown> | null
  /** Builder canvas CSS scale (fit × zoom) — pointer deltas must be divided by this. */
  canvasScale?: number
  onSectionImageActivate?: (
    blockId: string,
    field: string,
    opts?: { arrayKey?: string; index?: number; itemField?: string; additive?: boolean },
  ) => void
  onTextFieldActivate?: (
    blockId: string,
    fieldKey: string,
    opts?: { additive?: boolean; clientX?: number; clientY?: number },
  ) => void
  onTextFieldCommit?: (blockId: string, fieldKey: string, value: string) => void
  onTextFieldStylePatch?: (blockId: string, fieldKey: string, patch: Record<string, unknown>) => void
  /** Apply per-field patches in one undo step. Keys = field keys, values = style patches. */
  onTextFieldBatchStylePatch?: (
    blockId: string,
    patchesByField: Record<string, Record<string, unknown>>,
  ) => void
  /** Intercept header / storefront links in the builder canvas. */
  onNavigate?: (url: string) => void
  /** Builder canvas: which website page is shown (nav active highlight). */
  activePageSlug?: string | null
  activePageIsHomepage?: boolean
  /** Builder canvas device preview — drives responsive section spacing in the editor. */
  previewBreakpoint?: 'desktop' | 'tablet' | 'mobile'
  /** Open the link editor for a block prop (e.g. social_links.twitter). */
  onPropLinkEdit?: (
    blockId: string,
    propKey: string,
    anchor: { x: number; y: number },
  ) => void
  /** Remove a deletable field (hero eyebrow, CTA button, etc.) from the section. */
  onDeleteBlockField?: (blockId: string, fieldKey: string) => void
  /** Builder canvas: submit contact form via authenticated vendor API (draft sites). */
  submitContactForm?: (
    siteId: string,
    body: Record<string, unknown>,
  ) => Promise<{ ok: boolean; lead_id?: string | null; submission_id?: string | null }>
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
