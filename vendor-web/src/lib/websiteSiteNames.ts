function normalizeSiteName(name: string): string {
  return name.trim().toLowerCase()
}

function takenNames(existingNames: Iterable<string>): Set<string> {
  return new Set([...existingNames].map(normalizeSiteName).filter(Boolean))
}

/** Default Save As name — skips names already used by other sites. */
export function suggestSiteCopyName(sourceName: string, existingNames: Iterable<string>): string {
  const base = sourceName.trim() || 'Site'
  const taken = takenNames(existingNames)

  const first = `${base} (copy)`
  if (!taken.has(normalizeSiteName(first))) return first

  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} (copy ${i})`
    if (!taken.has(normalizeSiteName(candidate))) return candidate
  }

  return `${base} (copy ${Date.now()})`
}

/** Ensure the saved name is unique; append (2), (3), … when needed. */
export function resolveUniqueSiteName(requestedName: string, existingNames: Iterable<string>): string {
  const trimmed = requestedName.trim()
  if (!trimmed) return trimmed

  const taken = takenNames(existingNames)
  if (!taken.has(normalizeSiteName(trimmed))) return trimmed

  for (let i = 2; i < 1000; i++) {
    const candidate = `${trimmed} (${i})`
    if (!taken.has(normalizeSiteName(candidate))) return candidate
  }

  return `${trimmed} (${Date.now()})`
}

export function countSitesWithName(sites: { name: string }[], name: string): number {
  const key = normalizeSiteName(name)
  if (!key) return 0
  return sites.filter(s => normalizeSiteName(s.name) === key).length
}
