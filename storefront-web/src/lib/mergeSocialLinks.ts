/** Merge social link maps — later sources only override when non-empty. */
export function mergeSocialLinks(
  ...sources: Array<Record<string, string> | null | undefined>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const source of sources) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'string' && value.trim()) out[key] = value.trim()
    }
  }
  return out
}
