/** True when this section is bound to the live Categories catalog. */
export function isCategoriesDataSource(props: Record<string, unknown> | undefined): boolean {
  if (!props) return false
  const ds = props.data_source
  return Boolean(ds && typeof ds === 'object' && (ds as { type?: string }).type === 'categories')
}

/**
 * Read category title for display/edit.
 * When synced from Categories (or `preferLive`), always use the live/normalized
 * `fallback` so stale template `props.categories[i].title` cannot win.
 */
export function categoryItemTitle(
  props: Record<string, unknown> | undefined,
  index: number,
  fallback: string,
  options?: { preferLive?: boolean },
): string {
  if (!props) return fallback
  if (options?.preferLive || isCategoriesDataSource(props)) return fallback
  const arr = props.categories as Array<{ title?: string }> | undefined
  const t = arr?.[index]?.title
  return typeof t === 'string' && t.trim() ? t.trim() : fallback
}

export function categoryFieldKey(index: number, itemKey = 'title'): string {
  return `categories.${index}.${itemKey}`
}
