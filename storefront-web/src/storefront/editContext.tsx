/**
 * Visual editing context for storefront template previews.
 * Provides edit mode state, content overrides, and section highlighting.
 */
import { createContext, useContext } from 'react'

export type ContentMap = Record<string, string>

export interface EditContextValue {
  editMode: boolean
  content: ContentMap
  highlighted: string | null
  setHighlighted: (id: string | null) => void
  updateContent: (key: string, value: string) => void
}

export const EditContext = createContext<EditContextValue | null>(null)

/** Access the visual edit context. Returns null when not in edit mode. */
export function useEdit(): EditContextValue | null {
  return useContext(EditContext)
}

/**
 * Returns a resolver function: c(key, fallback) → string.
 * When in edit mode, returns the overridden value if set, otherwise the fallback.
 * When not in edit mode, always returns the fallback unchanged.
 */
export function useContentField(): (key: string, fallback: string) => string {
  const ctx = useContext(EditContext)
  return (key: string, fallback: string) => ctx?.content[key] ?? fallback
}
