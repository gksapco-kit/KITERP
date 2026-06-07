import type { CustomField, VendorCategory } from '@/types'

export function findCategoryPath(
  tree: VendorCategory[],
  category: string,
  subcategory?: string | null,
): VendorCategory[] {
  if (!category) return []
  for (const root of tree) {
    if (root.name !== category) continue
    if (!subcategory?.trim()) return [root]
    const parts = subcategory.split(' / ').map(s => s.trim()).filter(Boolean)
    const path: VendorCategory[] = [root]
    let current = root
    for (const part of parts) {
      const child = (current.children || []).find(c => c.name === part)
      if (!child) return [root]
      path.push(child)
      current = child
    }
    return path
  }
  return []
}

export function findCategoryNode(
  tree: VendorCategory[],
  category: string,
  subcategory?: string | null,
): VendorCategory | null {
  const path = findCategoryPath(tree, category, subcategory)
  return path.length ? path[path.length - 1] : null
}

export function categoryNodeToFields(
  tree: VendorCategory[],
  node: VendorCategory,
): { category: string; subcategory: string } {
  const path = findPathById(tree, node.id) ?? [node]
  if (path.length === 1) return { category: path[0].name, subcategory: '' }
  return {
    category: path[0].name,
    subcategory: path.slice(1).map(n => n.name).join(' / '),
  }
}

export function findPathById(tree: VendorCategory[], id: string): VendorCategory[] | null {
  for (const node of tree) {
    if (node.id === id) return [node]
    const childPath = findPathById(node.children || [], id)
    if (childPath) return [node, ...childPath]
  }
  return null
}

export function flattenCategoryTree(
  cats: VendorCategory[],
  rootTree?: VendorCategory[],
  prefix = '',
): { id: string; label: string; category: string; subcategory: string }[] {
  const roots = rootTree ?? cats
  const result: { id: string; label: string; category: string; subcategory: string }[] = []
  for (const c of cats) {
    const fields = categoryNodeToFields(roots, c)
    result.push({
      id: c.id,
      label: prefix + c.name,
      category: fields.category,
      subcategory: fields.subcategory,
    })
    if (c.children?.length) {
      result.push(...flattenCategoryTree(c.children, roots, prefix + '  '))
    }
  }
  return result
}

export function collectCustomFieldsFromSelection(
  tree: VendorCategory[],
  category: string,
  subcategory?: string | null,
): CustomField[] {
  const path = findCategoryPath(tree, category, subcategory)
  const seen = new Set<string>()
  const fields: CustomField[] = []
  for (const node of path) {
    for (const f of node.custom_fields || []) {
      if (!f.name || seen.has(f.name)) continue
      seen.add(f.name)
      fields.push(f)
    }
  }
  return fields
}

export function filterCategoryTree(
  tree: VendorCategory[],
  appliesTo: 'product' | 'service' | 'both',
): VendorCategory[] {
  const keep = (c: VendorCategory) =>
    c.applies_to === appliesTo || c.applies_to === 'both'

  function prune(nodes: VendorCategory[]): VendorCategory[] {
    return nodes
      .map(node => ({
        ...node,
        children: prune(node.children || []),
      }))
      .filter(node => keep(node) || (node.children?.length ?? 0) > 0)
  }

  return prune(tree)
}
