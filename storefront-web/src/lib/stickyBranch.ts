/** Branch captured from ?branch= so the address bar can drop the query without losing the unit. */
let stickyBranch: string | null = null

export function noteStickyBranch(code: string | null | undefined) {
  stickyBranch = code?.trim() || null
}

export function readStickyBranch(): string | null {
  return stickyBranch
}
