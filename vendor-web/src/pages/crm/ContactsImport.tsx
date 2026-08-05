import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { crmApi } from '@/api/crm'
import { normalizePhoneE164 } from '@/lib/phoneE164'
import { extractApiError } from '@/lib/errorMessages'
import {
  CheckCircle2, Download, FileSpreadsheet, History, Loader2, RotateCcw, Upload, X, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

const LAST_IMPORT_KEY = 'kiterp-crm-contacts-last-import'
const IMPORT_HISTORY_KEY = 'kiterp-crm-contacts-import-history'
const REVERSAL_HISTORY_KEY = 'kiterp-crm-contacts-reversal-history'
const MAX_HISTORY = 5
const MAX_REVERSALS = 20

type BatchContactSnapshot = {
  record_type: string
  salutation: string
  first_name: string
  last_name: string
  email: string
  phone: string
  mobile: string
  title: string
  company: string
  industry: string
  region: string
  website: string
  lifecycle_stage: string
  lead_source: string
  tags: string
  notes: string
}

type LastImportBatch = {
  batchId: string
  createdAt: string
  /** Delete people before companies (parent FKs). */
  contactIds: string[]
  count: number
  fileName?: string
  /** Snapshot of successfully imported rows (for re-download after reverse). */
  contacts?: BatchContactSnapshot[]
}

type ReversalRecord = {
  batchId: string
  importedAt: string
  reversedAt: string
  count: number
  deleted: number
  failed: number
  fileName?: string
  contacts?: BatchContactSnapshot[]
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value == null) {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
      sessionStorage.setItem(key, value)
    }
  } catch {
    /* ignore quota / private mode */
  }
}

function readLastImport(): LastImportBatch | null {
  try {
    const raw = readStorage(LAST_IMPORT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LastImportBatch
    if (!parsed?.batchId || !Array.isArray(parsed.contactIds) || !parsed.contactIds.length) return null
    return parsed
  } catch {
    return null
  }
}

function readImportHistory(): LastImportBatch[] {
  try {
    const raw = readStorage(IMPORT_HISTORY_KEY)
    if (!raw) {
      const last = readLastImport()
      return last ? [last] : []
    }
    const parsed = JSON.parse(raw) as LastImportBatch[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((b) => b?.batchId && Array.isArray(b.contactIds) && b.contactIds.length)
  } catch {
    const last = readLastImport()
    return last ? [last] : []
  }
}

function writeLastImport(batch: LastImportBatch | null) {
  if (!batch || !batch.contactIds.length) {
    writeStorage(LAST_IMPORT_KEY, null)
    return
  }
  writeStorage(LAST_IMPORT_KEY, JSON.stringify(batch))
  const history = readImportHistory().filter((b) => b.batchId !== batch.batchId)
  history.unshift(batch)
  writeStorage(IMPORT_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
}

function removeBatchFromHistory(batchId: string) {
  const history = readImportHistory().filter((b) => b.batchId !== batchId)
  writeStorage(IMPORT_HISTORY_KEY, history.length ? JSON.stringify(history) : null)
  const last = readLastImport()
  if (last?.batchId === batchId) {
    writeStorage(LAST_IMPORT_KEY, history[0] ? JSON.stringify(history[0]) : null)
  }
}

function readReversalHistory(): ReversalRecord[] {
  try {
    const raw = readStorage(REVERSAL_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ReversalRecord[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((r) => r?.batchId && r?.reversedAt)
  } catch {
    return []
  }
}

function appendReversal(record: ReversalRecord) {
  const history = readReversalHistory().filter((r) => r.batchId !== record.batchId)
  history.unshift(record)
  writeStorage(REVERSAL_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_REVERSALS)))
}

function clearReversalHistory() {
  writeStorage(REVERSAL_HISTORY_KEY, null)
}

function newBatchId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `imp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function formatBatchId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}

type ImportRow = {
  sourceRow: number
  record_type: string
  salutation: string
  first_name: string
  last_name: string
  email: string
  phone: string
  mobile: string
  title: string
  company: string
  industry: string
  region: string
  website: string
  lifecycle_stage: string
  lead_source: string
  tags: string
  notes: string
  skipReason?: string
}

type RowResult = {
  row: number
  status: 'pending' | 'success' | 'error' | 'skipped'
  message?: string
}

const TEMPLATE_HEADERS = [
  'record_type',
  'salutation',
  'first_name',
  'last_name',
  'email',
  'phone',
  'mobile',
  'title',
  'company',
  'industry',
  'region',
  'website',
  'lifecycle_stage',
  'lead_source',
  'tags',
  'notes',
] as const

type ImportFieldKey = (typeof TEMPLATE_HEADERS)[number]

const IMPORT_FIELDS: { key: ImportFieldKey; label: string; aliases: string[] }[] = [
  { key: 'record_type', label: 'Record type (person / company)', aliases: ['record_type', 'type', 'record type', 'contact_type', 'contact type'] },
  { key: 'salutation', label: 'Salutation', aliases: ['salutation', 'prefix', 'title_prefix'] },
  { key: 'first_name', label: 'First name / Company name', aliases: ['first_name', 'firstname', 'first name', 'name', 'company_name', 'company name', 'full_name', 'full name'] },
  { key: 'last_name', label: 'Last name', aliases: ['last_name', 'lastname', 'last name', 'surname', 'family_name'] },
  { key: 'email', label: 'Email', aliases: ['email', 'e-mail', 'email_address', 'email address', 'mail'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'telephone', 'phone_number', 'phone number', 'landline'] },
  { key: 'mobile', label: 'Mobile', aliases: ['mobile', 'cell', 'cellphone', 'mobile_number', 'mobile number', 'whatsapp'] },
  { key: 'title', label: 'Job title', aliases: ['title', 'job_title', 'job title', 'designation', 'position'] },
  { key: 'company', label: 'Company (for people)', aliases: ['company', 'organisation', 'organization', 'org', 'employer', 'account'] },
  { key: 'industry', label: 'Industry', aliases: ['industry', 'sector'] },
  { key: 'region', label: 'Region', aliases: ['region', 'area', 'territory', 'state', 'city'] },
  { key: 'website', label: 'Website', aliases: ['website', 'url', 'web', 'site'] },
  { key: 'lifecycle_stage', label: 'Lifecycle stage', aliases: ['lifecycle_stage', 'lifecycle stage', 'stage', 'status'] },
  { key: 'lead_source', label: 'Lead source', aliases: ['lead_source', 'lead source', 'source', 'origin'] },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'labels', 'tag'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments', 'comment', 'remarks'] },
]

const SKIP_FIELD = '' as const
type ColumnFieldChoice = ImportFieldKey | typeof SKIP_FIELD

function normalizeHeaderKey(h: string): string {
  return h
    .toLowerCase()
    .replace(/^\ufeff/, '')
    .trim()
    .replace(/[\s-]+/g, '_')
}

function guessFieldForHeader(header: string, used: Set<string>): ColumnFieldChoice {
  const key = normalizeHeaderKey(header)
  const loose = header.toLowerCase().trim()
  for (const field of IMPORT_FIELDS) {
    if (used.has(field.key)) continue
    for (const alias of field.aliases) {
      const a = normalizeHeaderKey(alias)
      if (key === a || loose === alias.toLowerCase()) return field.key
    }
  }
  return SKIP_FIELD
}

function autoMapColumns(headers: string[]): ColumnFieldChoice[] {
  const used = new Set<string>()
  return headers.map((h) => {
    const guess = guessFieldForHeader(h, used)
    if (guess) used.add(guess)
    return guess
  })
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function snapshotToCsv(contacts: BatchContactSnapshot[]): string {
  const header = TEMPLATE_HEADERS.join(',')
  const lines = contacts.map((c) =>
    TEMPLATE_HEADERS.map((key) => csvEscape(String(c[key] ?? ''))).join(','),
  )
  return [header, ...lines].join('\n')
}

function downloadBatchContacts(
  batchId: string,
  contacts: BatchContactSnapshot[] | undefined,
  fileName?: string,
) {
  if (!contacts?.length) {
    toast.error('No contact list saved for this batch. Re-import to enable download.')
    return
  }
  const safeName = (fileName || 'contacts').replace(/\.csv$/i, '')
  const blob = new Blob(['\uFEFF' + snapshotToCsv(contacts)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName}_batch_${formatBatchId(batchId).replace(/[….]/g, '')}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`Downloaded ${contacts.length} contact${contacts.length === 1 ? '' : 's'}`)
}

function rowToSnapshot(row: ImportRow): BatchContactSnapshot {
  return {
    record_type: row.record_type,
    salutation: row.salutation,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    title: row.title,
    company: row.company,
    industry: row.industry,
    region: row.region,
    website: row.website,
    lifecycle_stage: row.lifecycle_stage,
    lead_source: row.lead_source,
    tags: row.tags,
    notes: row.notes,
  }
}

const TEMPLATE_CSV = [
  TEMPLATE_HEADERS.join(','),
  'person,Mr,Asha,Patel,asha@example.com,+919876543210,,Sales Manager,Acme Corp,,,,,customer,referral,"vip, west",Follow up Q2',
  // Company name goes in first_name (same column people use for given name).
  'company,,Acme Corp,,hello@acme.com,+912212345678,,,,"Software",West,https://acme.example,customer,website,,',
  'person,Ms,Ravi,Kumar,ravi@example.com,+919811122233,,Account Exec,Acme Corp,,,,,lead,website,,',
].join('\n')

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }
  const parseLine = (line: string): string[] => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if ((ch === ',' || ch === '\t') && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    cells.push(current.trim())
    return cells
  }
  // Keep original header labels for mapping UI; strip BOM only.
  const headers = parseLine(lines[0]).map((h) => h.replace(/^\ufeff/, '').trim())
  const rows = lines.slice(1).map(parseLine)
  return { headers, rows }
}

function normalizeRecordType(raw: string): 'person' | 'company' {
  const v = raw.trim().toLowerCase()
  if (v === 'company' || v === 'organisation' || v === 'organization' || v === 'org') return 'company'
  return 'person'
}

function fieldValue(columnMap: ColumnFieldChoice[], cells: string[], field: ImportFieldKey): string {
  const idx = columnMap.indexOf(field)
  if (idx < 0) return ''
  return (cells[idx] || '').trim()
}

function mapRowFromColumnMap(
  columnMap: ColumnFieldChoice[],
  cells: string[],
  sourceRow: number,
): ImportRow {
  const rawType = fieldValue(columnMap, cells, 'record_type')
  const recordType = normalizeRecordType(rawType || 'person')
  let firstName = fieldValue(columnMap, cells, 'first_name')
  const lastName = fieldValue(columnMap, cells, 'last_name')
  const company = fieldValue(columnMap, cells, 'company')
  if (!firstName && recordType === 'company') {
    firstName = company
  }

  const row: ImportRow = {
    sourceRow,
    record_type: recordType,
    salutation: fieldValue(columnMap, cells, 'salutation'),
    first_name: firstName,
    last_name: lastName,
    email: fieldValue(columnMap, cells, 'email'),
    phone: fieldValue(columnMap, cells, 'phone'),
    mobile: fieldValue(columnMap, cells, 'mobile'),
    title: fieldValue(columnMap, cells, 'title'),
    company,
    industry: fieldValue(columnMap, cells, 'industry'),
    region: fieldValue(columnMap, cells, 'region'),
    website: fieldValue(columnMap, cells, 'website'),
    lifecycle_stage: fieldValue(columnMap, cells, 'lifecycle_stage') || 'subscriber',
    lead_source: fieldValue(columnMap, cells, 'lead_source'),
    tags: fieldValue(columnMap, cells, 'tags'),
    notes: fieldValue(columnMap, cells, 'notes'),
  }

  if (!row.first_name.trim()) {
    row.skipReason = 'Missing first_name (map a column to First name / Company name)'
  } else if (
    rawType
    && !['person', 'company', 'organisation', 'organization', 'org', ''].includes(rawType.trim().toLowerCase())
  ) {
    row.notes = row.notes
      ? `${row.notes} (record_type "${rawType}" treated as person)`
      : `record_type "${rawType}" treated as person`
  }

  return row
}

function buildParsedRows(
  columnMap: ColumnFieldChoice[],
  rows: string[][],
): ImportRow[] {
  const parsed = rows
    .map((cells, idx) => ({ cells, sourceRow: idx + 2 }))
    .filter(({ cells }) => cells.some((c) => c.trim()))
    .map(({ cells, sourceRow }) => mapRowFromColumnMap(columnMap, cells, sourceRow))

  parsed.sort((a, b) => {
    const ac = a.record_type === 'company' ? 0 : 1
    const bc = b.record_type === 'company' ? 0 : 1
    return ac - bc
  })
  return parsed
}

export function ContactsImportHistoryModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [batches, setBatches] = useState<LastImportBatch[]>(() => readImportHistory())
  const [reversals, setReversals] = useState<ReversalRecord[]>(() => readReversalHistory())
  const [undoingBatchId, setUndoingBatchId] = useState<string | null>(null)

  const refreshBatches = useCallback(() => {
    setBatches(readImportHistory())
    setReversals(readReversalHistory())
  }, [])

  const undoImport = useCallback(async (batch: LastImportBatch) => {
    if (!batch.contactIds.length) return
    if (!window.confirm(
      `Reverse batch ${batch.batchId}?\n\nThis deletes ${batch.count} contact${batch.count === 1 ? '' : 's'} from that upload so you can re-upload a corrected file.`,
    )) return

    setUndoingBatchId(batch.batchId)
    let deleted = 0
    let failed = 0
    for (const id of batch.contactIds) {
      try {
        await crmApi.deleteContact(id)
        deleted++
      } catch {
        failed++
      }
    }
    await qc.invalidateQueries({ queryKey: ['crm', 'contacts'] })
    appendReversal({
      batchId: batch.batchId,
      importedAt: batch.createdAt,
      reversedAt: new Date().toISOString(),
      count: batch.count,
      deleted,
      failed,
      fileName: batch.fileName,
      contacts: batch.contacts,
    })
    removeBatchFromHistory(batch.batchId)
    refreshBatches()
    setUndoingBatchId(null)
    if (deleted) toast.success(`Batch cleaned — removed ${deleted} contact${deleted === 1 ? '' : 's'}`)
    if (failed) toast.error(`${failed} could not be deleted (may already be removed)`)
  }, [qc, refreshBatches])

  return (
    <div
      data-kiterp-modal
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card text-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History className="h-5 w-5 text-primary" />
            Import history
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Upload batches</p>
              <p className="text-[11px] text-muted-foreground">Reverse cleans only that batch</p>
            </div>
            {batches.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No reversible batches yet. After you import a file, the batch ID and a Reverse button appear here.
              </p>
            ) : (
              <ul className="space-y-2">
                {batches.map((b) => (
                  <li
                    key={b.batchId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-medium text-amber-950">
                        Batch ID:{' '}
                        <span className="font-mono select-all">{b.batchId}</span>
                      </p>
                      <p className="text-[11px] text-amber-800/90">
                        {b.count} contact{b.count === 1 ? '' : 's'}
                        {b.fileName ? ` · ${b.fileName}` : ''}
                        {' · '}
                        {new Date(b.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {b.contacts?.length ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-amber-400 bg-white text-amber-950 hover:bg-amber-100"
                          onClick={() => downloadBatchContacts(b.batchId, b.contacts, b.fileName)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-amber-400 bg-white text-amber-950 hover:bg-amber-100"
                        disabled={undoingBatchId != null}
                        onClick={() => void undoImport(b)}
                      >
                        {undoingBatchId === b.batchId
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <RotateCcw className="h-3.5 w-3.5" />}
                        Reverse
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <History className="h-4 w-4 text-muted-foreground" />
                Reversal history
              </p>
              {reversals.length > 0 ? (
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                  onClick={() => {
                    if (!window.confirm('Clear reversal history from this browser?')) return
                    clearReversalHistory()
                    setReversals([])
                  }}
                >
                  Clear history
                </button>
              ) : null}
            </div>
            {reversals.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No reversals yet. When you reverse a batch, it is logged here with batch ID, counts, and a download of that contact list.
              </p>
            ) : (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                {reversals.map((r) => (
                  <li
                    key={`${r.batchId}-${r.reversedAt}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        Batch ID:{' '}
                        <span className="font-mono select-all break-all">{r.batchId}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Reversed {new Date(r.reversedAt).toLocaleString()}
                        {' · '}
                        removed {r.deleted}/{r.count}
                        {r.failed ? ` · ${r.failed} failed` : ''}
                        {r.fileName ? ` · ${r.fileName}` : ''}
                      </p>
                      <p className="text-[11px] text-muted-foreground/80">
                        Originally imported {new Date(r.importedAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 shrink-0"
                      disabled={!r.contacts?.length}
                      title={
                        r.contacts?.length
                          ? 'Download contacts from this batch'
                          : 'Contact list not saved for this older batch — re-import to enable download'
                      }
                      onClick={() => downloadBatchContacts(r.batchId, r.contacts, r.fileName)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ContactsImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'processing' | 'done' | 'undoing'>('upload')
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([])
  const [parseError, setParseError] = useState('')
  const [results, setResults] = useState<RowResult[]>([])
  const [createdIds, setCreatedIds] = useState<string[]>([])
  const [importBatchId, setImportBatchId] = useState<string | null>(null)
  const [sourceFileName, setSourceFileName] = useState('')
  const [fileHeaders, setFileHeaders] = useState<string[]>([])
  const [fileRows, setFileRows] = useState<string[][]>([])
  const [columnMap, setColumnMap] = useState<ColumnFieldChoice[]>([])
  const [batches, setBatches] = useState<LastImportBatch[]>(() => readImportHistory())
  const [undoingBatchId, setUndoingBatchId] = useState<string | null>(null)

  const downloadTemplate = useCallback(() => {
    const blob = new Blob(['\uFEFF' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'crm_contacts_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const refreshBatches = useCallback(() => {
    setBatches(readImportHistory())
  }, [])

  const undoImport = useCallback(async (batch: LastImportBatch) => {
    if (!batch.contactIds.length) return
    if (!window.confirm(
      `Reverse batch ${batch.batchId}?\n\nThis deletes ${batch.count} contact${batch.count === 1 ? '' : 's'} from that upload so you can re-upload a corrected file.`,
    )) return

    setUndoingBatchId(batch.batchId)
    setStep('undoing')
    let deleted = 0
    let failed = 0
    for (const id of batch.contactIds) {
      try {
        await crmApi.deleteContact(id)
        deleted++
      } catch {
        failed++
      }
    }
    await qc.invalidateQueries({ queryKey: ['crm', 'contacts'] })
    appendReversal({
      batchId: batch.batchId,
      importedAt: batch.createdAt,
      reversedAt: new Date().toISOString(),
      count: batch.count,
      deleted,
      failed,
      fileName: batch.fileName,
      contacts: batch.contacts,
    })
    removeBatchFromHistory(batch.batchId)
    refreshBatches()
    if (importBatchId === batch.batchId) {
      setCreatedIds([])
      setImportBatchId(null)
    }
    setUndoingBatchId(null)
    setStep('upload')
    setParsedRows([])
    setFileHeaders([])
    setFileRows([])
    setColumnMap([])
    setResults([])
    if (deleted) toast.success(`Batch cleaned — removed ${deleted} contact${deleted === 1 ? '' : 's'}`)
    if (failed) toast.error(`${failed} could not be deleted (may already be removed)`)
  }, [qc, importBatchId, refreshBatches])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setParseError('')
    const file = e.target.files?.[0]
    if (!file) return
    setSourceFileName(file.name)

    const lower = file.name.toLowerCase()
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      setParseError('Please save your Excel file as CSV (File → Save As → CSV UTF-8) and upload that file.')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '')
      if (text.startsWith('PK')) {
        setParseError('This looks like an Excel workbook. Save it as CSV UTF-8 from Excel, then upload again.')
        return
      }
      const { headers, rows } = parseCSV(text)
      if (!headers.length) {
        setParseError('No header row found in the file.')
        return
      }

      const dataRows = rows.filter((cells) => cells.some((c) => c.trim()))
      if (!dataRows.length) {
        setParseError('No data rows found in the file.')
        return
      }

      setFileHeaders(headers)
      setFileRows(dataRows)
      setColumnMap(autoMapColumns(headers))
      setParsedRows([])
      setStep('map')
    }
    reader.onerror = () => setParseError('Could not read that file.')
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  const setColumnField = useCallback((colIndex: number, field: ColumnFieldChoice) => {
    setColumnMap((prev) => {
      const next = [...prev]
      if (field && field !== SKIP_FIELD) {
        for (let i = 0; i < next.length; i++) {
          if (i !== colIndex && next[i] === field) next[i] = SKIP_FIELD
        }
      }
      next[colIndex] = field
      return next
    })
  }, [])

  const applyMappingAndPreview = useCallback(() => {
    if (!columnMap.includes('first_name')) {
      toast.error('Map at least one column to First name / Company name.')
      return
    }
    const parsed = buildParsedRows(columnMap, fileRows)
    if (!parsed.length) {
      toast.error('No data rows found after mapping.')
      return
    }
    setParsedRows(parsed)
    setStep('preview')
  }, [columnMap, fileRows])

  const fieldSelectOptionsFor = useCallback((colIndex: number) => {
    const current = columnMap[colIndex] || SKIP_FIELD
    const used = new Set(columnMap.filter((f, i) => f && i !== colIndex))
    return [
      { value: '__skip__', label: '— Skip column —' },
      ...IMPORT_FIELDS
        .filter((f) => f.key === current || !used.has(f.key))
        .map((f) => ({ value: f.key, label: f.label })),
    ]
  }, [columnMap])

  const runImport = useCallback(async () => {
    const importable = parsedRows.filter((r) => !r.skipReason)
    if (!importable.length) {
      toast.error('No valid rows to import. Fix first_name on skipped rows.')
      return
    }

    const batchId = newBatchId()
    const importedAt = new Date().toISOString()
    setImportBatchId(batchId)
    setStep('processing')
    const next: RowResult[] = parsedRows.map((r) =>
      r.skipReason
        ? { row: r.sourceRow, status: 'skipped' as const, message: r.skipReason }
        : { row: r.sourceRow, status: 'pending' as const },
    )
    setResults([...next])

    const companyIds = new Map<string, string>()
    try {
      const existing = await crmApi.listContacts({ record_type: 'company', size: 200 })
      for (const c of existing.items || []) {
        companyIds.set(c.first_name.trim().toLowerCase(), c.id)
      }
    } catch {
      /* best-effort company lookup */
    }

    const createdPeople: string[] = []
    const createdCompanies: string[] = []
    const snapshots: BatchContactSnapshot[] = []

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i]
      if (row.skipReason) continue

      const type = row.record_type === 'company' ? 'company' : 'person'
      const firstName = row.first_name.trim()

      let parentId: string | undefined
      if (type === 'person' && row.company.trim()) {
        parentId = companyIds.get(row.company.trim().toLowerCase())
      }

      const phone = row.phone.trim() ? normalizePhoneE164(row.phone.trim()) : undefined
      const mobile = row.mobile.trim() ? normalizePhoneE164(row.mobile.trim()) : undefined
      const tags = row.tags
        ? row.tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean)
        : undefined

      try {
        const created = await crmApi.createContact({
          record_type: type,
          salutation: type === 'person' && row.salutation ? row.salutation : undefined,
          first_name: firstName,
          last_name: type === 'person' && row.last_name ? row.last_name : undefined,
          email: row.email || undefined,
          phone: phone || undefined,
          mobile: mobile || undefined,
          title: row.title || undefined,
          industry: type === 'company' && row.industry ? row.industry : undefined,
          region: type === 'company' && row.region ? row.region : undefined,
          website: type === 'company' && row.website ? row.website : undefined,
          lifecycle_stage: row.lifecycle_stage || 'subscriber',
          lead_source: row.lead_source || undefined,
          tags,
          notes: row.notes || undefined,
          parent_contact_id: parentId,
          custom_fields: {
            import_batch_id: batchId,
            imported_at: importedAt,
          },
        })
        if (type === 'company') {
          companyIds.set(firstName.toLowerCase(), created.id)
          createdCompanies.push(created.id)
        } else {
          createdPeople.push(created.id)
        }
        snapshots.push(rowToSnapshot(row))
        next[i] = {
          row: row.sourceRow,
          status: 'success',
          message: type === 'person' && row.company.trim() && !parentId
            ? `Created (company "${row.company}" not found — left unlinked)`
            : undefined,
        }
      } catch (err) {
        next[i] = {
          row: row.sourceRow,
          status: 'error',
          message: extractApiError(err, 'Could not create contact'),
        }
      }
      setResults([...next])
    }

    const idsForUndo = [...createdPeople, ...createdCompanies]
    setCreatedIds(idsForUndo)
    if (idsForUndo.length) {
      const batch: LastImportBatch = {
        batchId,
        createdAt: importedAt,
        contactIds: idsForUndo,
        count: idsForUndo.length,
        fileName: sourceFileName || undefined,
        contacts: snapshots,
      }
      writeLastImport(batch)
      refreshBatches()
    }

    await qc.invalidateQueries({ queryKey: ['crm', 'contacts'] })
    setStep('done')
    const ok = next.filter((r) => r.status === 'success').length
    const bad = next.filter((r) => r.status === 'error').length
    const skipped = next.filter((r) => r.status === 'skipped').length
    if (ok) toast.success(`Imported ${ok} contact${ok === 1 ? '' : 's'} · batch ${formatBatchId(batchId)}`)
    if (bad) toast.error(`${bad} row${bad === 1 ? '' : 's'} failed`)
    if (skipped) toast.message(`${skipped} row${skipped === 1 ? '' : 's'} skipped`)
  }, [parsedRows, qc, sourceFileName, refreshBatches])

  const successCount = results.filter((r) => r.status === 'success').length
  const errorCount = results.filter((r) => r.status === 'error').length
  const skippedCount = results.filter((r) => r.status === 'skipped').length
  const validCount = parsedRows.filter((r) => !r.skipReason).length
  const previewSkipped = parsedRows.filter((r) => r.skipReason).length

  return (
    <div
      data-kiterp-modal
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-4 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-card text-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import contacts from Excel
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {step === 'upload' && (
            <>
              <p className="text-sm text-muted-foreground">
                Upload a CSV exported from Excel. After upload, map each file column to a contact field with the dropdowns.
                Optional: download the template for a ready-made layout.
              </p>

              <div className="space-y-3 rounded-xl border-2 border-dashed border-border p-8 text-center">
                <Upload className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <div>
                  <Button type="button" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4" /> Select Excel / CSV file
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.txt,text/csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Accepts .csv (recommended). Save .xlsx as CSV from Excel first.</p>
              </div>

              {parseError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {parseError}
                </div>
              ) : null}

              <button
                type="button"
                onClick={downloadTemplate}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                <Download className="h-4 w-4" /> Download Excel template (CSV)
              </button>

              <div className="space-y-1 rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Mappable fields</p>
                <p>
                  <span className="font-medium">Required:</span> First name / Company name
                </p>
                <p>
                  Optional: record type, salutation, last name, email, phone, mobile, job title,
                  company, industry, region, website, lifecycle stage, lead source, tags, notes
                </p>
              </div>
            </>
          )}

          {step === 'map' && (
            <>
              <p className="text-sm text-muted-foreground">
                Map each column from <span className="font-medium text-foreground">{sourceFileName || 'your file'}</span> to a contact field.
                Matching names are pre-selected — change any dropdown as needed.
              </p>
              {!columnMap.includes('first_name') ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Map one column to <span className="font-medium">First name / Company name</span> to continue.
                </div>
              ) : null}
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/80">
                    <tr>
                      <th className="px-3 py-2 font-medium">File column</th>
                      <th className="px-3 py-2 font-medium">Sample</th>
                      <th className="px-3 py-2 font-medium min-w-[220px]">Maps to</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {fileHeaders.map((header, colIndex) => {
                      const sample = fileRows
                        .slice(0, 3)
                        .map((r) => r[colIndex]?.trim())
                        .filter(Boolean)
                        .slice(0, 2)
                        .join(' · ')
                      return (
                        <tr key={`${header}-${colIndex}`}>
                          <td className="px-3 py-2.5 font-medium text-foreground align-middle">
                            {header || `Column ${colIndex + 1}`}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground align-middle max-w-[180px] truncate" title={sample}>
                            {sample || '—'}
                          </td>
                          <td className="px-3 py-2 align-middle">
                            <Select
                              value={columnMap[colIndex] || '__skip__'}
                              onChange={(v) =>
                                setColumnField(
                                  colIndex,
                                  !v || v === '__skip__' ? SKIP_FIELD : (v as ImportFieldKey),
                                )
                              }
                              options={fieldSelectOptionsFor(colIndex)}
                              wrapperClassName="w-full"
                              className="h-9 text-xs"
                              aria-label={`Map column ${header || colIndex + 1}`}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {fileRows.length} data row{fileRows.length === 1 ? '' : 's'} · each field can only be mapped once
              </p>
            </>
          )}

          {step === 'preview' && (
            <>
              <p className="text-sm text-muted-foreground">
                Found <span className="font-medium text-foreground">{parsedRows.length}</span> row
                {parsedRows.length === 1 ? '' : 's'} in the file
                {previewSkipped > 0 ? (
                  <>
                    {' '}· <span className="font-medium text-amber-700">{validCount} ready</span>
                    {' '}· <span className="font-medium text-amber-700">{previewSkipped} will be skipped</span>
                  </>
                ) : (
                  <> · Companies are created first, then people.</>
                )}
              </p>
              {previewSkipped > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Rows without a name in <span className="font-medium">first_name</span> are skipped.
                  For companies, put the company name in the <span className="font-medium">first_name</span> column
                  (download a fresh template if needed).
                </div>
              ) : null}
              <div className="max-h-64 overflow-auto rounded-lg border">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="sticky top-0 bg-muted/80">
                    <tr>
                      <th className="px-3 py-2 font-medium">Sheet #</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Company</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedRows.slice(0, 50).map((r) => (
                      <tr key={r.sourceRow} className={r.skipReason ? 'bg-amber-50/80' : undefined}>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.sourceRow}</td>
                        <td className="px-3 py-1.5">{r.record_type}</td>
                        <td className="px-3 py-1.5 font-medium">
                          {[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td className="px-3 py-1.5">{r.email || '—'}</td>
                        <td className="px-3 py-1.5">{r.company || '—'}</td>
                        <td className="px-3 py-1.5">
                          {r.skipReason ? (
                            <span className="text-amber-700">Skip: {r.skipReason}</span>
                          ) : (
                            <span className="text-emerald-700">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 ? (
                <p className="text-xs text-muted-foreground">Showing first 50 of {parsedRows.length} rows.</p>
              ) : null}
            </>
          )}

          {(step === 'processing' || step === 'done' || step === 'undoing') && (
            <>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="text-emerald-700">{successCount} imported</span>
                <span className="text-red-600">{errorCount} failed</span>
                <span className="text-amber-700">{skippedCount} skipped</span>
                {step === 'processing' || step === 'undoing' ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {step === 'undoing' ? 'Reversing batch…' : 'Importing…'}
                  </span>
                ) : null}
              </div>
              {step === 'done' && importBatchId && createdIds.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-amber-950">Uploaded batch</p>
                    <p className="text-xs font-mono text-amber-900 select-all break-all">{importBatchId}</p>
                    <p className="text-[11px] text-amber-800/90">
                      {createdIds.length} contact{createdIds.length === 1 ? '' : 's'}
                      {sourceFileName ? ` · ${sourceFileName}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-amber-400 bg-white text-amber-950 hover:bg-amber-100"
                    disabled={undoingBatchId != null}
                    onClick={() => {
                      const batch = batches.find((b) => b.batchId === importBatchId) || {
                        batchId: importBatchId,
                        createdAt: new Date().toISOString(),
                        contactIds: createdIds,
                        count: createdIds.length,
                        fileName: sourceFileName || undefined,
                      }
                      void undoImport(batch)
                    }}
                  >
                    {undoingBatchId === importBatchId
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RotateCcw className="h-3.5 w-3.5" />}
                    Reverse
                  </Button>
                </div>
              ) : null}
              <div className="max-h-64 overflow-auto rounded-lg border">
                <ul className="divide-y text-xs">
                  {results.map((r) => (
                    <li key={r.row} className="flex items-start gap-2 px-3 py-2">
                      {r.status === 'success' ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      ) : r.status === 'error' ? (
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      ) : r.status === 'skipped' ? (
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      ) : (
                        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                      )}
                      <span>
                        Sheet row {r.row}
                        {r.message ? `: ${r.message}` : r.status === 'success' ? ': OK' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
          {step === 'upload' ? (
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          ) : null}
          {step === 'done' ? (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setStep('upload')
                  setParsedRows([])
                  setFileHeaders([])
                  setFileRows([])
                  setColumnMap([])
                  setResults([])
                  setCreatedIds([])
                  setImportBatchId(null)
                  refreshBatches()
                }}
              >
                Import another file
              </Button>
            </>
          ) : null}
          {step === 'map' ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('upload')
                  setFileHeaders([])
                  setFileRows([])
                  setColumnMap([])
                  setParsedRows([])
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={applyMappingAndPreview}
                disabled={!columnMap.includes('first_name')}
              >
                Continue to preview
              </Button>
            </>
          ) : null}
          {step === 'preview' ? (
            <>
              <Button type="button" variant="outline" onClick={() => { setStep('map'); setParsedRows([]) }}>
                Back
              </Button>
              <Button
                type="button"
                onClick={() => void runImport()}
                className="gap-1.5"
                disabled={validCount === 0}
              >
                <Upload className="h-4 w-4" /> Import {validCount} contact{validCount === 1 ? '' : 's'}
              </Button>
            </>
          ) : null}
          {step === 'processing' || step === 'undoing' ? (
            <Button type="button" disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {step === 'undoing' ? 'Reversing…' : 'Importing…'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
