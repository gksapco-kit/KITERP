import type { WebsiteBlock } from '@/types/websites'
import {
  arrayImageDeleteFieldKey,
  canDeleteBlockField,
  canDeleteBlockImageField,
  hideBlockFieldPatch,
} from '@storefront/lib/blockHiddenFields'
import { buildPropPatchFromFieldKey } from './builderCanvasTextEdit'

export type DeleteBlockElementTarget =
  | { kind: 'field'; fieldKey: string }
  | { kind: 'image'; field: string; arrayKey?: string; index?: number; itemField?: string }

export function buildDeleteBlockElementPatch(
  block: WebsiteBlock,
  target: DeleteBlockElementTarget | null | undefined,
): Record<string, unknown> | null {
  if (!target) return null
  const blockType = String(block.block_type)
  const props = (block.props ?? {}) as Record<string, unknown>

  if (target.kind === 'field') {
    if (!canDeleteBlockField(blockType, target.fieldKey)) return null
    return {
      ...hideBlockFieldPatch(props, target.fieldKey),
      ...buildPropPatchFromFieldKey(target.fieldKey, '', props),
    }
  }

  if (target.arrayKey != null && target.index != null && target.itemField) {
    if (!canDeleteBlockImageField(blockType, target.itemField, {
      arrayKey: target.arrayKey,
      itemField: target.itemField,
    })) {
      return null
    }
    const fieldKey = arrayImageDeleteFieldKey(target.arrayKey, target.index, target.itemField)
    return {
      ...hideBlockFieldPatch(props, fieldKey),
      ...buildPropPatchFromFieldKey(fieldKey, '', props),
    }
  }

  if (!canDeleteBlockImageField(blockType, target.field)) return null
  return hideBlockFieldPatch(props, target.field)
}

export function resolveDeleteBlockElementTarget(
  blockType: string,
  activeTextField: string | null | undefined,
  canvasImageField: string | null | undefined,
  canvasImageSlots?: { arrayKey: string; index: number; itemField: string }[] | null,
): DeleteBlockElementTarget | null {
  const slot = canvasImageSlots?.[0]
  if (slot && canDeleteBlockImageField(blockType, slot.itemField, {
    arrayKey: slot.arrayKey,
    itemField: slot.itemField,
  })) {
    return {
      kind: 'image',
      field: slot.itemField,
      arrayKey: slot.arrayKey,
      index: slot.index,
      itemField: slot.itemField,
    }
  }
  if (canvasImageField && canDeleteBlockImageField(blockType, canvasImageField)) {
    return { kind: 'image', field: canvasImageField }
  }
  if (activeTextField && canDeleteBlockField(blockType, activeTextField)) {
    return { kind: 'field', fieldKey: activeTextField }
  }
  return null
}

/** Hide a whole array item by index (features, faqs, plans, etc.). */
export function buildDeleteArrayItemPatch(
  block: WebsiteBlock,
  arrayKey: string,
  index: number,
): Record<string, unknown> | null {
  const blockType = String(block.block_type)
  const fieldKey = `${arrayKey}.${index}`
  if (!canDeleteBlockField(blockType, fieldKey)) return null
  const props = (block.props ?? {}) as Record<string, unknown>
  return hideBlockFieldPatch(props, fieldKey)
}

/** @deprecated use buildDeleteArrayItemPatch */
export function buildDeleteFeatureCardPatch(
  block: WebsiteBlock,
  index: number,
): Record<string, unknown> | null {
  return buildDeleteArrayItemPatch(block, 'features', index)
}
