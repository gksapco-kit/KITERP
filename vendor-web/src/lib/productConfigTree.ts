// vendor-web/src/lib/productConfigTree.ts
import type { ConfigAttribute } from '@/api/vendor'

/** Depth-first flatten of the (unlimited-depth) attribute dependency tree. */
export function flattenAttributes(nodes: ConfigAttribute[]): ConfigAttribute[] {
  const out: ConfigAttribute[] = []
  const walk = (list: ConfigAttribute[]) => {
    for (const n of list) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

/** Machine-safe code derived from a human display name, e.g. "Oil Grade" -> "oil_grade". */
export function slugifyAttributeName(displayName: string): string {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `attr_${Date.now().toString(36)}`
}
