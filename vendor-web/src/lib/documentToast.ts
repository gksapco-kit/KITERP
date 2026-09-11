/** Trim a document number from API payloads, or return an empty string. */
export function pickDocNo(data: unknown, ...keys: string[]): string {
  if (typeof data === 'string' || typeof data === 'number') {
    return String(data).trim()
  }
  if (!data || typeof data !== 'object') return ''
  const rec = data as Record<string, unknown>
  for (const key of keys) {
    const value = rec[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

type DocRef = { label: string; number?: unknown }

function formatRefs(refs: DocRef[] | undefined): string {
  if (!refs?.length) return ''
  return refs
    .map((ref) => {
      const n = pickDocNo(ref.number)
      return n ? `${ref.label} ${n}` : ''
    })
    .filter(Boolean)
    .join(' · ')
}

/**
 * "Purchase Order PO-0001 created"
 * "Purchase Order PO-0001 created from PR PR-000123"
 * "Vendor invoice INV-001 created (PO PO-0001 · PR PR-000123)"
 */
export function createdDocMessage(
  kind: string,
  number: unknown,
  opts?: { from?: DocRef; extra?: DocRef[] },
): string {
  const n = pickDocNo(number)
  const head = n ? `${kind} ${n} created` : `${kind} created`
  const fromNo = pickDocNo(opts?.from?.number)
  const fromPart = fromNo && opts?.from ? ` from ${opts.from.label} ${fromNo}` : ''
  const extraPart = formatRefs(opts?.extra)
  return extraPart ? `${head}${fromPart} (${extraPart})` : `${head}${fromPart}`
}

/**
 * "Purchase order PO-0001 sent"
 * "Invoice INV-001 posted (PO PO-0001)"
 */
export function actionDocMessage(
  kind: string,
  number: unknown,
  action: string,
  extra?: DocRef[],
): string {
  const n = pickDocNo(number)
  const head = n ? `${kind} ${n} ${action}` : `${kind} ${action}`
  const extraPart = formatRefs(extra)
  return extraPart ? `${head} (${extraPart})` : head
}
