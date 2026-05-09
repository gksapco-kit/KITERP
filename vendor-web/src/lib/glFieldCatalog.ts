/** Journal / GL field keys (must match backend `field_rules` header.* keys) */
export const JOURNAL_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: 'header.entry_date', label: 'Posting date' },
  { value: 'header.document_date', label: 'Document date' },
  { value: 'header.reference', label: 'Reference' },
  { value: 'header.narration', label: 'Narration' },
  { value: 'header.header_text', label: 'Header note (internal)' },
]

export function fieldLabelForKey(key: string) {
  return JOURNAL_FIELD_OPTIONS.find(f => f.value === key)?.label || key
}
