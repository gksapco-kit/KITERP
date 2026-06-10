/** Strip prior derived suffixes so re-edits stay readable. */
function stemWithoutDerivedTags(filename: string): { stem: string; ext: string } {
  const dot = filename.lastIndexOf('.')
  const stem = dot > 0 ? filename.slice(0, dot) : filename
  const ext = dot > 0 ? filename.slice(dot) : '.jpg'
  const base = stem.replace(/-(?:edited|cropped)(?:-\d+)?$/i, '')
  return { stem: base, ext }
}

/** Unique library filename for a baked or cropped derivative. */
export function nextDerivedFileName(
  sourceFilename: string,
  existingFilenames: Iterable<string>,
  tag: 'edited' | 'cropped' = 'edited',
): string {
  const existing = new Set(existingFilenames)
  const { stem, ext } = stemWithoutDerivedTags(sourceFilename)

  let n = 1
  while (true) {
    const suffix = n === 1 ? `-${tag}` : `-${tag}-${n}`
    const candidate = `${stem}${suffix}${ext}`
    if (!existing.has(candidate)) return candidate
    n += 1
  }
}
