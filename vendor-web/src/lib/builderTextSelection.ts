import { CONTENT_GROUP_FIELD_KEY } from '@storefront/lib/fieldTextStyles'
import { isMultiSelectModifier } from '@storefront/lib/builderMultiSelect'

export { isMultiSelectModifier }

export type ActiveTextTarget = {
  blockId: string
  fieldKeys: string[]
}

export function primaryTextFieldKey(target: ActiveTextTarget | null | undefined): string | null {
  if (!target?.fieldKeys.length) return null
  return target.fieldKeys[target.fieldKeys.length - 1] ?? null
}

export function isFieldInTextTarget(
  target: ActiveTextTarget | null | undefined,
  fieldKey: string,
): boolean {
  return target?.fieldKeys.includes(fieldKey) ?? false
}

export function editableFieldKeys(target: ActiveTextTarget | null | undefined): string[] {
  if (!target) return []
  return target.fieldKeys.filter(k => k !== CONTENT_GROUP_FIELD_KEY)
}

export function toggleTextFieldInTarget(
  target: ActiveTextTarget | null,
  blockId: string,
  fieldKey: string,
  additive: boolean,
): ActiveTextTarget | null {
  if (fieldKey === CONTENT_GROUP_FIELD_KEY) {
    return { blockId, fieldKeys: [CONTENT_GROUP_FIELD_KEY] }
  }
  if (!additive || !target || target.blockId !== blockId) {
    return { blockId, fieldKeys: [fieldKey] }
  }
  const withoutGroup = target.fieldKeys.filter(k => k !== CONTENT_GROUP_FIELD_KEY)
  if (withoutGroup.includes(fieldKey)) {
    const next = withoutGroup.filter(k => k !== fieldKey)
    return next.length ? { blockId, fieldKeys: next } : null
  }
  return { blockId, fieldKeys: [...withoutGroup, fieldKey] }
}
