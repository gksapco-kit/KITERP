/** Branch codes are scoped to their parent business unit: `{BU}-01`, `{BU}-02`, … */

export function branchCodePrefix(parent: { code?: string | null; name: string }): string {
  const raw = (parent.code ?? '').trim()
  if (raw) return raw.toUpperCase()
  const fromName = (parent.name ?? '').replace(/[^a-zA-Z0-9]+/g, '').toUpperCase()
  return (fromName.slice(0, 20) || 'MAIN').toUpperCase()
}

export function nextBranchAutoCode(
  parentBu: { code?: string | null; name: string },
  siblingBranches: { code?: string | null }[],
): string {
  const prefix = branchCodePrefix(parentBu)
  const pattern = `${prefix}-`
  let maxSuffix = 0
  for (const branch of siblingBranches) {
    const code = (branch.code ?? '').trim().toUpperCase()
    if (!code.startsWith(pattern)) continue
    const tail = code.slice(pattern.length)
    if (/^\d+$/.test(tail)) {
      maxSuffix = Math.max(maxSuffix, parseInt(tail, 10))
    }
  }
  const next = maxSuffix + 1
  const width = Math.max(2, String(next).length)
  return `${prefix}-${String(next).padStart(width, '0')}`
}
