/** Read category title from props.categories[i] with live/normalized fallback. */
export function categoryItemTitle(
  props: Record<string, unknown> | undefined,
  index: number,
  fallback: string,
): string {
  if (!props) return fallback
  const arr = props.categories as Array<{ title?: string }> | undefined
  const t = arr?.[index]?.title
  return typeof t === 'string' && t.trim() ? t.trim() : fallback
}

export function categoryFieldKey(index: number, itemKey = 'title'): string {
  return `categories.${index}.${itemKey}`
}
