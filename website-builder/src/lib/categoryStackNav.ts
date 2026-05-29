/** Live-site path segment after `/site/` */
export function stackCategoryPath(blockId: string, categoryId: string): string {
  return `stack/${blockId}/category/${categoryId}`
}

export function stackItemPath(blockId: string, itemId: string): string {
  return `stack/${blockId}/item/${itemId}`
}

export function isStackNavPath(slug: string): boolean {
  return slug.startsWith('stack/')
}
