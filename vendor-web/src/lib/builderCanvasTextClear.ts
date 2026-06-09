import type { WebsiteBlock } from '@/types/websites'
import {
  applyTextClearToFieldElement,
  buildFieldStylesClearPatch,
  ctaUrlPropForFieldKey,
  normalizeHtmlContent,
  type TextClearAction,
} from '@storefront/lib/builderTextClear'
import {
  getSavedInlineTextSelection,
  hasActiveInlineTextSelection,
  restoreSavedInlineSelection,
} from '@storefront/lib/builderInlineTextSelection'
import { buildPropPatchFromFieldKey } from './builderCanvasTextEdit'

export type { TextClearAction }

export const TEXT_CLEAR_MENU: {
  id: TextClearAction
  label: string
  description: string
  shortcut?: string
  dividerBefore?: boolean
}[] = [
  {
    id: 'all',
    label: 'Clear All',
    description: 'Remove text, formatting, and field layout overrides',
    shortcut: 'A',
  },
  {
    id: 'removeHyperlinks',
    label: 'Remove Hyperlinks',
    description: 'Remove links and reset formatting on linked text',
    shortcut: 'R',
    dividerBefore: true,
  },
]

function findFieldElement(blockId: string, fieldKey: string): HTMLElement | null {
  const blockEl = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`)
  return blockEl?.querySelector(`[data-text-key="${CSS.escape(fieldKey)}"]`) as HTMLElement | null
}

function notifyInlineCommit(fieldEl: HTMLElement) {
  fieldEl.dispatchEvent(new CustomEvent('builder-inline-text-commit', { bubbles: true }))
}

function selectionRangeForField(fieldKey: string, fieldEl: HTMLElement): Range | null {
  if (hasActiveInlineTextSelection(fieldKey)) {
    restoreSavedInlineSelection()
    const saved = getSavedInlineTextSelection()?.range
    if (saved && !saved.collapsed && fieldEl.contains(saved.commonAncestorContainer)) return saved
  }
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (range.collapsed || !fieldEl.contains(range.commonAncestorContainer)) return null
  return range
}

function propTextValue(props: Record<string, unknown>, fieldKey: string): string {
  const patch = buildPropPatchFromFieldKey(fieldKey, '', props)
  const nested = fieldKey.includes('.')
  if (nested) {
    const [arrayKey, rest] = fieldKey.split('.')
    const index = Number(rest.split('.')[0])
    const itemKey = rest.split('.').slice(1).join('.')
    const arr = props[arrayKey]
    if (Array.isArray(arr) && arr[index] && typeof arr[index] === 'object') {
      const val = (arr[index] as Record<string, unknown>)[itemKey]
      return typeof val === 'string' ? val : ''
    }
    return ''
  }
  const val = props[fieldKey]
  return typeof val === 'string' ? val : ''
}

function nextValueFromStored(
  action: TextClearAction,
  current: string,
): string {
  if (action === 'all' || action === 'contents') return ''
  if (action === 'formats') {
    return normalizeHtmlContent(current, { unwrapLinks: false })
  }
  if (action === 'hyperlinks') {
    return normalizeHtmlContent(current, { unwrapLinks: true, stripLinkFormats: false })
  }
  if (action === 'removeHyperlinks') {
    return normalizeHtmlContent(current, { unwrapLinks: true, stripLinkFormats: true })
  }
  return current
}

function clearOneField(
  blockId: string,
  fieldKey: string,
  action: TextClearAction,
  props: Record<string, unknown>,
  allowSelection: boolean,
): { value: string; changed: boolean; usedSelection: boolean } {
  const fieldEl = findFieldElement(blockId, fieldKey)
  const range = allowSelection && fieldEl ? selectionRangeForField(fieldKey, fieldEl) : null

  if (fieldEl) {
    const { value, changed } = applyTextClearToFieldElement(fieldEl, action, range)
    if (changed) notifyInlineCommit(fieldEl)
    return { value, changed, usedSelection: Boolean(range) }
  }

  const current = propTextValue(props, fieldKey)
  const value = nextValueFromStored(action, current)
  return { value, changed: value !== current, usedSelection: false }
}

export function runCanvasTextClearAction(
  action: TextClearAction,
  block: WebsiteBlock,
  fieldKeys: string[],
): {
  propsPatch: Record<string, unknown>
  clearedFields: string[]
  usedSelection: boolean
} | null {
  if (!fieldKeys.length) return null

  const props = block.props as Record<string, unknown>
  const fieldStyles = (props._field_styles as Record<string, Record<string, unknown>>) || {}
  const propsPatch: Record<string, unknown> = {}
  const clearedFields: string[] = []
  let usedSelection = false
  const allowSelection = fieldKeys.length === 1

  fieldKeys.forEach(fieldKey => {
    const { value, changed, usedSelection: selUsed } = clearOneField(
      block.id,
      fieldKey,
      action,
      props,
      allowSelection,
    )
    if (selUsed) usedSelection = true

    const needsContentPatch =
      action === 'all'
      || action === 'contents'
      || changed

    if (needsContentPatch) {
      Object.assign(propsPatch, buildPropPatchFromFieldKey(fieldKey, value, props))
      clearedFields.push(fieldKey)
    } else if (action === 'formats' || action === 'hyperlinks' || action === 'removeHyperlinks') {
      clearedFields.push(fieldKey)
    }
  })

  const stylesPatch = buildFieldStylesClearPatch(fieldStyles, fieldKeys, action)
  if (stylesPatch) {
    propsPatch._field_styles = stylesPatch
  }

  if (action === 'hyperlinks' || action === 'removeHyperlinks' || action === 'all') {
    fieldKeys.forEach(fieldKey => {
      const urlKey = ctaUrlPropForFieldKey(fieldKey)
      if (urlKey && urlKey in props) {
        propsPatch[urlKey] = ''
      }
    })
  }

  if (Object.keys(propsPatch).length === 0 && !clearedFields.length) return null
  return { propsPatch, clearedFields, usedSelection }
}
