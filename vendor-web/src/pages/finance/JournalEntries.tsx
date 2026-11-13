import { useState, useEffect, useRef, useMemo, Fragment, type ReactNode } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  useJournalEntries, usePostJournalEntry, useVoidJournalEntry,
  useCreateJournalEntry, useUpdateJournalEntry, useJournalEntry,
  useCompanies, useCostCenters, useProjects, useIntercompanyPartners,
  useApprovalPolicies, useApproveRequest, useRejectRequest,
  useFiscalYears,
  usePeriods,
  useSimulateJournalEntry, useJournalTimeline,
  useSubmitJournalEntry, useWithdrawJournalEntry, useReverseJournalEntry,
} from '@/hooks/useFinance'
import * as api from '@/api/finance'
import type {
  JournalEntry, JournalLineIn, JournalEntryCreate, JournalAttachment,
  Company, CostCenter, Project, AccountSearchResult, RefDocResult,
  DocType, RefDocType, JEAction, JEIssue, JESimulationResult,
} from '@/types/finance'
import { DOC_TYPES, REF_DOC_TYPES } from '@/types/finance'
import {
  Plus, CheckCircle, XCircle, Pencil, X, Trash2, Search,
  ChevronDown, ChevronRight, AlertTriangle, Clock, Building2,
  User, Info, Save, SendHorizonal, Layers, Play, Undo2, Ban,
  ThumbsUp, ThumbsDown, Send, ChevronLeft, Paperclip, FileText, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, mediaUrl } from '@/lib/utils'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { useAuthStore } from '@/stores/authStore'
import { useHasPermission } from '@/hooks/usePermissions'
import type { TaxPostingAccount } from '@/api/finance'
import { buildTaxCodeMap, resolveLineTax, type TaxCode } from '@/lib/procurementTax'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-orange-100 text-orange-700',
  posted: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-600',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  posted: 'Posted',
  void: 'Void',
}

function fmt(n: number | string) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0)
}

/** Local calendar date (toISOString is UTC and gives "yesterday" in IST before 05:30). */
const today = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Turn any API error into a readable message (FastAPI detail may be a string or an array). */
function formatApiError(e: any, fallback = 'Request failed'): string {
  const detail = e?.response?.data?.detail
  if (!detail) return e?.message && !e?.response ? e.message : fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => (d?.line != null ? `Line ${d.line + 1}: ` : '') + (d?.msg || JSON.stringify(d)))
      .join('; ')
  }
  return JSON.stringify(detail)
}

/** Per-line errors from either a 400 array detail or a simulation's issue list. */
function issuesFromApiError(e: any): JEIssue[] {
  const detail = e?.response?.data?.detail
  if (!Array.isArray(detail)) return []
  return detail
    .filter((d: any) => d && typeof d === 'object' && 'msg' in d)
    .map((d: any) => ({
      severity: (d.severity || 'error') as JEIssue['severity'],
      line: typeof d.line === 'number' ? d.line : null,
      field: d.field ?? null,
      message: String(d.msg),
    }))
}

/** Mandatory field marker — always red so it stands out on gray labels. */
function ReqRequiredMark() {
  return <span className="text-red-500" aria-hidden>*</span>
}

// ─── Account Combobox ─────────────────────────────────────────────────────────
function AccountCombobox({
  value, onChange, companyId, placeholder = 'Search account…', initialCode, initialName, hasError,
}: {
  value: string
  onChange: (id: string, acc?: AccountSearchResult) => void
  companyId?: string
  placeholder?: string
  /** Display values for an already-saved account (edit mode), so the field isn't blank. */
  initialCode?: string
  initialName?: string
  hasError?: boolean
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<AccountSearchResult[]>([])
  const [selected, setSelected] = useState<AccountSearchResult | null>(
    () => (value && (initialCode || initialName)
      ? ({ id: value, code: initialCode || '', name: initialName || '', account_type: '' } as AccountSearchResult)
      : null),
  )
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      try {
        const data = await api.searchAccounts({ q, company_id: companyId, limit: 20 })
        setResults(data)
      } catch { setResults([]) }
    }, 200)
    return () => clearTimeout(t)
  }, [q, companyId, open])

  useEffect(() => {
    // Only drop the chosen account; never wipe what the user is typing into the search box.
    if (!value) setSelected(null)
  }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (acc: AccountSearchResult) => {
    setSelected(acc); setQ(acc.name); setOpen(false); onChange(acc.id, acc)
  }

  const TYPE_COLORS: Record<string, string> = {
    Asset: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    Liability: 'bg-red-500/15 text-red-700 dark:text-red-300',
    Equity: 'bg-primary/15 text-primary',
    Income: 'bg-green-500/15 text-green-700 dark:text-green-300',
    Expense: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  }

  const lineInputClass =
    'w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          value={selected ? `${selected.code} · ${selected.name}` : q}
          onChange={e => { setQ(e.target.value); setSelected(null); onChange(''); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={cn(lineInputClass, 'pl-6 pr-2', hasError && 'border-destructive ring-1 ring-destructive/40')}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl max-h-56 overflow-y-auto">
          {results.map(acc => (
            <button
              key={acc.id}
              onClick={() => select(acc)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
            >
              <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{acc.code}</span>
              <span className="flex-1 truncate text-xs text-foreground">{acc.name}</span>
              <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold', TYPE_COLORS[acc.account_type] || 'bg-muted text-muted-foreground')}>
                {acc.account_type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Ref-doc search ───────────────────────────────────────────────────────────
function RefDocSearch({
  docType, value, onChange,
}: { docType: RefDocType | ''; value: string; onChange: (id: string, no: string) => void }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<RefDocResult[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!docType || !open) return
    const t = setTimeout(async () => {
      try {
        const data = await api.searchReferenceDocs({ doc_type: docType, q })
        setResults(data)
      } catch { setResults([]) }
    }, 200)
    return () => clearTimeout(t)
  }, [q, docType, open])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  if (!docType) return <span className="text-xs text-gray-400 italic">Select type first</span>

  return (
    <div ref={ref} className="relative">
      <input
        value={value || q}
        onChange={e => { setQ(e.target.value); onChange('', ''); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Doc number…"
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl max-h-40 overflow-y-auto">
          {results.map(r => (
            <button key={r.id} onClick={() => { onChange(r.id, r.no); setQ(r.label); setOpen(false) }}
              className="w-full px-3 py-2 text-left text-xs hover:bg-primary/10">
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Party (customer / supplier) search ───────────────────────────────────────
function PartySearch({
  partyType, value, initialName, onChange, hasError,
}: {
  partyType: 'customer' | 'supplier' | undefined
  value: string
  initialName?: string
  onChange: (id: string, name: string) => void
  hasError?: boolean
}) {
  const [q, setQ] = useState('')
  const [name, setName] = useState(initialName || '')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<api.PartySearchResult[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!partyType || !open) return
    const t = setTimeout(async () => {
      try { setResults(await api.searchParties({ party_type: partyType, q, limit: 20 })) }
      catch { setResults([]) }
    }, 200)
    return () => clearTimeout(t)
  }, [q, partyType, open])

  useEffect(() => { if (!value) setName('') }, [value])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  if (!partyType) return <span className="text-xs text-gray-400 italic">Select type first</span>

  return (
    <div ref={ref} className="relative">
      <input
        value={value && name ? name : q}
        onChange={e => { setQ(e.target.value); setName(''); onChange('', ''); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={partyType === 'customer' ? 'Search customer…' : 'Search supplier…'}
        className={cn(
          'w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary',
          hasError && 'border-destructive ring-1 ring-destructive/40',
        )}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl max-h-40 overflow-y-auto">
          {results.map(p => (
            <button key={p.id} onClick={() => { setName(p.name); setQ(p.name); onChange(p.id, p.name); setOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-primary/10">
              {p.code && <span className="w-14 shrink-0 font-mono text-muted-foreground">{p.code}</span>}
              <span className="flex-1 truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Empty line factory ───────────────────────────────────────────────────────
function emptyLine(): JournalLineIn & {
  _key: string; _accCode?: string; _accName?: string; _accType?: string
  /** Set on auto-generated GST lines: the `_key` of the base line they belong to. */
  _taxFor?: string
} {
  return {
    _key: Math.random().toString(36).slice(2),
    account_id: '', description: '',
    debit: 0, credit: 0,
    currency: 'INR', fx_rate: 1,
    cost_center_id: '', project_id: '', intercompany_partner_id: '',
    value_date: '', party_type: undefined, party_id: '',
    ref_doc_type: undefined, ref_doc_id: '', ref_doc_no: '',
    tax_code: '', tax_amount: 0, assignment: '', sequence: 0,
  }
}

// ─── Automatic tax (GST) lines ────────────────────────────────────────────────
type JELine = ReturnType<typeof emptyLine>
type TaxAccounts = { input: TaxPostingAccount | null; output: TaxPostingAccount | null }
const ADDITIVE_TAX_TYPES = new Set(['CGST', 'SGST', 'IGST', 'UTGST', 'GST', 'VAT', 'CESS'])

const lineSig = (ls: JELine[]) => ls.map(l => [
  l._key, l.account_id, l.debit, l.credit, l.tax_amount, l.tax_code, l._taxFor, l.description,
  l.cost_center_id, l.project_id, l.fx_rate, l.value_date,
].join('|')).join(';')

/**
 * Keeps one generated tax line under every "base" line that carries an additive tax code
 * and a tax amount:
 *   - base line is a debit  → Dr GST Input Credit  (input tax on purchases / expenses)
 *   - base line is a credit → Cr GST Output Payable (output tax on sales / income)
 * The tax line sits on the same side as its base line, so the entry balances once the
 * counter-side line is entered gross (base + tax). Tax lines carry tax_amount = 0 so the
 * tax is not counted twice by anything summing tax_amount.
 *
 * Also re-links tax lines of an already-saved entry (GST account + tax code + tax_amount 0)
 * to their base line, so editing a saved entry doesn't create duplicates.
 */
function syncTaxLines(
  prev: JELine[],
  codeMap: Map<string, TaxCode>,
  accs: TaxAccounts | undefined,
): JELine[] {
  if (!accs) return prev
  const taxAccIds = new Set([accs.input?.id, accs.output?.id].filter(Boolean) as string[])

  // 1. re-link saved tax lines to their base lines
  const linked = new Set(prev.filter(l => l._taxFor).map(l => l._taxFor as string))
  const work = prev.map((l, i) => {
    if (l._taxFor || !l.tax_code || !taxAccIds.has(l.account_id) || Number(l.tax_amount) > 0) return l
    for (let j = i - 1; j >= 0; j--) {
      const b = prev[j]
      if (!b._taxFor && !linked.has(b._key) && !taxAccIds.has(b.account_id)
        && b.tax_code === l.tax_code && Number(b.tax_amount) > 0) {
        linked.add(b._key)
        return { ...l, _taxFor: b._key }
      }
    }
    return l
  })

  // 2. (re)generate a tax line after each base line; orphaned tax lines are dropped
  const out: JELine[] = []
  for (const l of work) {
    if (l._taxFor) continue
    out.push(l)
    const code = (l.tax_code || '').trim()
    const amount = Number(l.tax_amount) || 0
    const entry = code ? codeMap.get(code.toUpperCase()) : undefined
    const isBase = !!(l.account_id && entry && amount > 0 && !taxAccIds.has(l.account_id)
      && ADDITIVE_TAX_TYPES.has((entry.tax_type || '').trim().toUpperCase())
      && (Number(l.debit) > 0 || Number(l.credit) > 0))
    if (!isBase) continue
    const isDebit = Number(l.debit) > 0
    const acc = isDebit ? accs.input : accs.output
    if (!acc) continue
    const existing = work.find(t => t._taxFor === l._key)
    out.push({
      ...(existing ?? emptyLine()),
      _taxFor: l._key,
      account_id: acc.id, _accCode: acc.code, _accName: acc.name,
      description: `${code} ${isDebit ? 'input' : 'output'} tax`,
      debit: isDebit ? amount : 0,
      credit: isDebit ? 0 : amount,
      tax_code: code, tax_amount: 0,
      fx_rate: l.fx_rate,
      cost_center_id: l.cost_center_id, project_id: l.project_id, value_date: l.value_date,
    })
  }
  return lineSig(out) === lineSig(prev) ? prev : out
}

// ─── JE Drawer ────────────────────────────────────────────────────────────────
interface JEDrawerProps {
  mode: 'new' | 'edit'
  initialData?: JournalEntry | null
  onClose: () => void
  onSaved: () => void
}

function JEDrawer({
 mode, initialData, onClose, onSaved }: JEDrawerProps) {
  const { user } = useAuthStore()
  const { data: companies = [] } = useCompanies()
  const { data: fiscalYears = [] } = useFiscalYears()
  const { data: approvalPolicies = [] } = useApprovalPolicies()
  const [savePreview, setSavePreview] = useState<JournalEntry | null>(null)

  const defaultCompany = (companies as Company[]).find(c => c.is_default) || (companies as Company[])[0]

  // ── Header state ──────────────────────────────────────────────────────────
  const [companyId, setCompanyId] = useState(initialData?.company_id || defaultCompany?.id || '')
  const [entryDate, setEntryDate] = useState(initialData?.entry_date || today())
  const [documentDate, setDocumentDate] = useState(initialData?.document_date || today())
  const [docType, setDocType] = useState<DocType>(initialData?.document_type || 'SA')
  const [reference, setReference] = useState(initialData?.reference || '')
  const [narration, setNarration] = useState(initialData?.narration || '')
  const [headerText, setHeaderText] = useState(initialData?.header_text || '')
  const [attachments, setAttachments] = useState<JournalAttachment[]>(
    () => initialData?.attachments || [],
  )
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const [currency, setCurrency] = useState(initialData?.currency || 'Default')
  const [showHeaderExpanded, setShowHeaderExpanded] = useState(true)
  const [fiscalYearId, setFiscalYearId] = useState(
    () => (initialData as JournalEntry | undefined)?.fiscal_year_id || '',
  )
  const [periodId, setPeriodId] = useState(
    () => (initialData as JournalEntry | undefined)?.period_id || '',
  )
  const { data: periods = [] } = usePeriods(fiscalYearId || '')

  const { data: fieldRulesRes } = useQuery({
    queryKey: ['finance', 'field-rules-effective', companyId],
    queryFn: () => api.getEffectiveFieldRules({ entity_type: 'journal_entry', company_id: companyId || undefined }),
  })
  const fr = fieldRulesRes?.fields || {}
  const fieldMandatory = (k: string) => fr[k] === 'mandatory'
  const fieldHidden = (k: string) => fr[k] === 'hidden'

  // ── Dimension data scoped to chosen company ───────────────────────────────
  const { data: costCenters = [] } = useCostCenters(companyId || undefined)
  const { data: projects = [] } = useProjects(companyId || undefined)
  const { data: icPartners = [] } = useIntercompanyPartners(companyId || undefined)

  // ── Lines state ───────────────────────────────────────────────────────────
  type FullLine = ReturnType<typeof emptyLine>
  const [lines, setLines] = useState<FullLine[]>(() => {
    if (initialData?.lines?.length) {
      return initialData.lines.map(l => ({
        ...emptyLine(),
        ...l,
        // API returns Decimals as strings ("0.0000" is truthy and would render in the empty side)
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        fx_rate: Number(l.fx_rate) || 1,
        tax_amount: Number(l.tax_amount) || 0,
        description: l.description || '',
        cost_center_id: l.cost_center_id || '',
        project_id: l.project_id || '',
        intercompany_partner_id: l.intercompany_partner_id || '',
        value_date: l.value_date || '',
        _key: Math.random().toString(36).slice(2),
        _accCode: (l as any).account_code,
        _accName: (l as any).account_name,
      }))
    }
    return [emptyLine(), emptyLine()]
  })

  // ── Server feedback ───────────────────────────────────────────────────────
  // Issues from save / simulate, mapped back to the UI rows via the submitted-line order.
  const [issues, setIssues] = useState<JEIssue[]>([])
  const [sim, setSim] = useState<JESimulationResult | null>(null)
  const lineIssueKeys = useRef<string[]>([])   // payload line index → line _key
  const issuesByKey = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const i of issues) {
      if (i.line == null || i.severity === 'info') continue
      const k = lineIssueKeys.current[i.line]
      if (k) (m[k] ||= []).push(i.message)
    }
    return m
  }, [issues])
  const headerIssues = issues.filter(i => i.line == null && i.severity !== 'info')

  const [expandedLine, setExpandedLine] = useState<string | null>(null)

  const setLine = (key: string, patch: Partial<FullLine>) =>
    setLines(prev => prev.map(l => l._key === key ? { ...l, ...patch } : l))

  // ── Tax code master (drives the Tax Code dropdown + Tax Amount calculation) ──
  const { data: taxCodesRes } = useQuery({
    queryKey: ['finance', 'tax-codes'],
    queryFn: () => api.listTaxCodes(),
    staleTime: 5 * 60 * 1000,
  })
  const taxCodes = useMemo(
    () => ((taxCodesRes as TaxCode[] | undefined) ?? []).filter(c => c.is_active !== false),
    [taxCodesRes],
  )
  const taxCodeMap = useMemo(() => buildTaxCodeMap(taxCodes), [taxCodes])
  const calcTax = (base: number, code?: string | null) =>
    resolveLineTax(base, code, taxCodeMap, false).amount

  // GL accounts the generated GST lines post to (GST Input Credit / GST Output Payable)
  const { data: taxAccounts } = useQuery({
    queryKey: ['finance', 'tax-posting-accounts'],
    queryFn: () => api.getTaxPostingAccounts(),
    staleTime: 5 * 60 * 1000,
  })

  // Keep generated GST lines in step with every base line's tax code / amount
  useEffect(() => {
    setLines(prev => syncTaxLines(prev, taxCodeMap, taxAccounts))
  }, [lines, taxCodeMap, taxAccounts])

  /** Change a line's tax code and auto-fill the tax amount from the master rate. */
  const setLineTaxCode = (key: string, code: string) =>
    setLines(prev => prev.map(l => {
      if (l._key !== key) return l
      const base = Number(l.debit) || Number(l.credit) || 0
      return { ...l, tax_code: code, tax_amount: code ? calcTax(base, code) : 0 }
    }))

  /** Change a line's debit/credit; keep an auto-calculated tax amount in step with it. */
  const setLineAmount = (key: string, side: 'debit' | 'credit', value: number) =>
    setLines(prev => prev.map(l => {
      if (l._key !== key) return l
      const oldBase = Number(l.debit) || Number(l.credit) || 0
      const patch: Partial<FullLine> = side === 'debit'
        ? { debit: value, credit: 0 }
        : { credit: value, debit: 0 }
      const wasAuto = !l.tax_amount || Math.abs(Number(l.tax_amount) - calcTax(oldBase, l.tax_code)) < 0.005
      if (l.tax_code && wasAuto) patch.tax_amount = calcTax(value, l.tax_code)
      return { ...l, ...patch }
    }))

  const addLine = () => {
    const nl = emptyLine()
    setLines(prev => [...prev, nl])
    setExpandedLine(nl._key)
  }

  /** Append a line carrying the current difference on the opposite side. */
  const addBalancingLine = () => {
    if (isBalanced) return
    const nl = emptyLine()
    const amount = Math.round(diff * 10000) / 10000
    if (totalDebit > totalCredit) nl.credit = amount
    else nl.debit = amount
    setLines(prev => [...prev, nl])
    setExpandedLine(null)
  }

  const removeLine = (key: string) => {
    if (lines.length <= 2) { toast.error('A journal entry must have at least 2 lines'); return }
    setLines(prev => prev.filter(l => l._key !== key))
  }

  // ── Balance ───────────────────────────────────────────────────────────────
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const diff = Math.abs(totalDebit - totalCredit)
  const isBalanced = diff < 0.0001

  // ── Approval indication ───────────────────────────────────────────────────
  const jePolicy = (approvalPolicies as any[]).find(
    (p: any) => p.entity_type === 'journal_entry' && p.is_active
  )
  const needsApproval = jePolicy &&
    (jePolicy.threshold_amount == null || totalDebit >= Number(jePolicy.threshold_amount))

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMut = useCreateJournalEntry()
  const updateMut = useUpdateJournalEntry()

  const resolvedCurrency = currency === 'Default' ? (defaultCompany?.currency || 'INR') : currency

  /** Payload plus the UI line key of each submitted line (server issues refer to payload indexes). */
  const buildPayload = (): { payload: JournalEntryCreate; keys: string[] } => {
    const valid = lines.filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
    return {
      keys: valid.map(l => l._key),
      payload: {
        company_id: companyId || undefined,
        entry_date: entryDate,
        document_date: documentDate || undefined,
        document_type: docType,
        source_type: 'manual',
        reference: reference || undefined,
        narration: narration || undefined,
        header_text: headerText || undefined,
        attachments: attachments.length ? attachments : [],
        currency: resolvedCurrency,
        period_id: periodId || undefined,
        lines: valid.map(l => ({
          account_id: l.account_id,
          description: l.description || undefined,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          currency: resolvedCurrency,          // lines follow the header currency
          fx_rate: Number(l.fx_rate) || 1,
          cost_center_id: l.cost_center_id || undefined,
          project_id: l.project_id || undefined,
          intercompany_partner_id: l.intercompany_partner_id || undefined,
          store_id: l.store_id || undefined,
          value_date: l.value_date || undefined,
          party_type: l.party_type || undefined,
          party_id: l.party_id || undefined,
          ref_doc_type: l.ref_doc_type || undefined,
          ref_doc_id: l.ref_doc_id || undefined,
          ref_doc_no: l.ref_doc_no || undefined,
          tax_code: l.tax_code || undefined,
          tax_amount: Number(l.tax_amount) || 0,
          assignment: l.assignment || undefined,
          sequence: l.sequence || 0,
        })),
      },
    }
  }

  /** Client-side checks that mirror the server's field configuration; returns an error or null. */
  const validateClient = (): string | null => {
    if (!isBalanced) return 'Entry is not balanced'
    if (fieldMandatory('header.narration') && !narration?.trim()) return 'Narration is required.'
    if (fieldMandatory('header.reference') && !reference?.trim()) return 'Reference is required (field configuration).'
    if (fieldMandatory('header.header_text') && !headerText?.trim()) return 'Header note is required (field configuration).'
    if (fieldMandatory('header.document_date') && !documentDate) return 'Document date is required (field configuration).'
    if (fieldMandatory('header.entry_date') && !entryDate) return 'Posting date is required (field configuration).'
    return null
  }

  const handleSaveError = (e: any) => {
    const apiIssues = issuesFromApiError(e)
    setIssues(apiIssues)
    toast.error(formatApiError(e, 'Save failed'))
  }

  const save = () => {
    if (savePreview || createMut.isPending || updateMut.isPending) return
    const err = validateClient()
    if (err) { toast.error(err); return }
    const { payload, keys } = buildPayload()
    if (payload.lines.length < 2) {
      toast.error('At least 2 lines with an account and an amount are required.')
      return
    }
    lineIssueKeys.current = keys
    setIssues([])
    if (mode === 'edit' && initialData?.id) {
      updateMut.mutate(
        { id: initialData.id, data: payload as any },
        {
          onSuccess: (data) => {
            toast.success('Journal entry saved.')
            setSavePreview(data as unknown as JournalEntry)
          },
          onError: handleSaveError,
        }
      )
    } else {
      createMut.mutate(
        payload as any,
        {
          onSuccess: (data) => {
            toast.success('Journal entry created.')
            setSavePreview(data as unknown as JournalEntry)
          },
          onError: handleSaveError,
        }
      )
    }
  }

  // ── Simulation (dry run through the same server pipeline as save) ─────────
  const simMut = useSimulateJournalEntry()
  const simulate = () => {
    const err = validateClient()
    if (err) { toast.error(err); return }
    const { payload, keys } = buildPayload()
    if (payload.lines.length < 2) {
      toast.error('At least 2 lines with an account and an amount are required.')
      return
    }
    lineIssueKeys.current = keys
    simMut.mutate(payload as any, {
      onSuccess: (r: JESimulationResult) => { setSim(r); setIssues(r.issues || []) },
      onError: (e: any) => {
        setIssues(issuesFromApiError(e))
        toast.error(formatApiError(e, 'Simulation failed'))
      },
    })
  }

  // ── Unsaved-changes guard ─────────────────────────────────────────────────
  const snapshot = JSON.stringify({
    companyId, entryDate, documentDate, docType, reference, narration, headerText, currency,
    attachments: attachments.map(a => a.url),
    lines: lines.map(l => [l.account_id, Number(l.debit) || 0, Number(l.credit) || 0, l.description || '',
      l.cost_center_id || '', l.project_id || '', l.tax_code || '', Number(l.tax_amount) || 0,
      l.ref_doc_no || '', l.assignment || '']),
  })
  const initialSnapshot = useRef<string | null>(null)
  if (initialSnapshot.current === null) initialSnapshot.current = snapshot
  const isDirty = !savePreview && snapshot !== initialSnapshot.current

  const requestClose = () => {
    if (isDirty && !window.confirm('Discard your unsaved changes?')) return
    onClose()
  }

  // Default business unit once companies load (without counting it as a user edit).
  useEffect(() => {
    if (companyId || !defaultCompany || isDirty) return
    setCompanyId(defaultCompany.id)
    initialSnapshot.current = null
  }, [companyId, defaultCompany, isDirty])

  // Ctrl/Cmd+S saves
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const postMut = usePostJournalEntry()
  const canPost = useHasPermission('finance.journal.post')

  const isSaving = createMut.isPending || updateMut.isPending

  const matchedFY = useMemo(
    () => (fiscalYears as any[]).find((fy: any) => {
      const d = new Date(entryDate)
      return new Date(fy.start_date) <= d && new Date(fy.end_date) >= d
    }),
    [fiscalYears, entryDate],
  )

  // Keep fiscal year / period consistent with the posting date, but never override a
  // choice that still contains the date (overlapping fiscal-year variants are legitimate).
  useEffect(() => {
    if (!matchedFY) return
    const current = (fiscalYears as any[]).find((fy: any) => fy.id === fiscalYearId)
    const d = new Date(entryDate)
    const currentCoversDate = current && new Date(current.start_date) <= d && new Date(current.end_date) >= d
    if (!currentCoversDate) setFiscalYearId((matchedFY as any).id)
  }, [fiscalYearId, fiscalYears, matchedFY, entryDate])

  useEffect(() => {
    if (!fiscalYearId || !periods.length) return
    const d = new Date(entryDate)
    const covers = (x: any) => new Date(x.start_date) <= d && new Date(x.end_date) >= d
    const current = (periods as any[]).find((x) => x.id === periodId)
    if (current && covers(current)) return
    const p = (periods as any[]).find(covers)
    // No period for this date → clear, so the server resolves it instead of rejecting a stale id.
    setPeriodId(p ? p.id : '')
  }, [fiscalYearId, periods, entryDate, periodId])

  return (
    <>
    <ModalOverlay onClose={requestClose} className="z-[100] bg-black/60 p-3">
      <ModalPanel className="max-w-5xl max-h-[calc(100dvh-1.5rem)] !rounded-lg bg-background">
        <ModalHeader
          title={
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {mode === 'edit' ? `Edit Journal Entry ${initialData?.entry_no}` : 'New Journal Entry'}
              </h2>
              {needsApproval && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  Approval ≥ {fmt(jePolicy.threshold_amount ?? 0)}
                </span>
              )}
            </div>
          }
          onClose={requestClose}
          className="border-0 px-4 py-3"
        />

        <ModalBody className="flex min-h-0 flex-1 overflow-hidden p-0">
        <div className="flex min-h-0 flex-1 overflow-hidden">

          {/* ── Main content ── */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">

            {mode === 'edit' && (initialData?.status === 'approved' || initialData?.status === 'rejected') && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  This entry is <strong>{initialData.status}</strong>. Saving changes drops the existing approval and
                  re-evaluates the approval policy against the new amount.
                </span>
              </div>
            )}

            {(headerIssues.length > 0 || Object.keys(issuesByKey).length > 0) && !sim && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                <p className="mb-1 font-semibold">Please fix the following:</p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {headerIssues.map((i, n) => <li key={`h${n}`}>{i.message}</li>)}
                  {issues.filter(i => i.line != null && i.severity === 'error').map((i, n) => (
                    <li key={`l${n}`}>Line {(i.line as number) + 1}: {i.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Document Header card ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowHeaderExpanded(x => !x)}
                className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-sm font-semibold text-gray-800">Document Header</span>
                  <span className="text-xs text-gray-400">{docType} · {entryDate}</span>
                </div>
                {showHeaderExpanded
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>

              {showHeaderExpanded && (
                <div className="px-4 pb-3 pt-1 border-t border-gray-100">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2 mt-2">

                    {/* Business unit */}
                    <div className="col-span-2 lg:col-span-1">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">
                        <Building2 className="inline w-3 h-3 mr-0.5" /> Business unit <ReqRequiredMark />
                      </label>
                      <Select
                        value={companyId}
                        onChange={setCompanyId}
                        options={selectOptionsWithBlank(
                          '— Select —',
                          (companies as Company[]).map(c => ({ value: c.id, label: `${c.code} · ${c.name}` })),
                        )}
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Document Type */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Document Type</label>
                      <Select
                        value={docType}
                        onChange={v => setDocType(v as DocType)}
                        options={DOC_TYPES.map(d => ({ value: d.value, label: d.label }))}
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Currency */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Currency</label>
                      <Select
                        value={currency}
                        onChange={setCurrency}
                        options={[
                          { value: 'Default', label: `Default (${defaultCompany?.currency || 'INR'})` },
                          ...['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map(c => ({ value: c, label: c })),
                        ]}
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Posting Date */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">
                        Posting Date <ReqRequiredMark />
                      </label>
                      <input
                        type="date"
                        value={entryDate}
                        onChange={e => setEntryDate(e.target.value)}
                        className="w-full h-8 border border-gray-200 rounded-md px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    {/* Document Date */}
                    {!fieldHidden('header.document_date') && (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">
                        Document Date{fieldMandatory('header.document_date') ? <> <ReqRequiredMark /></> : null}
                      </label>
                      <input
                        type="date"
                        value={documentDate}
                        onChange={e => setDocumentDate(e.target.value)}
                        className="w-full h-8 border border-gray-200 rounded-md px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    )}

                    {/* Fiscal year & period */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Fiscal Year</label>
                      <Select
                        value={fiscalYearId}
                        onChange={v => { setFiscalYearId(v); setPeriodId('') }}
                        options={selectOptionsWithBlank(
                          '— Select —',
                          (fiscalYears as any[]).map((fy: any) => ({ value: fy.id, label: fy.name })),
                        )}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Accounting Period</label>
                      <Select
                        value={periodId}
                        onChange={setPeriodId}
                        disabled={!fiscalYearId}
                        options={selectOptionsWithBlank(
                          '— Select —',
                          (periods as any[]).map((p: any) => ({
                            value: p.id,
                            label: `${p.period_number != null ? `${p.period_number} · ` : ''}${p.name} (${p.start_date} – ${p.end_date})`,
                          })),
                        )}
                        className="h-8 text-xs bg-white disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </div>

                    {/* Reference */}
                    {!fieldHidden('header.reference') && (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">
                        Reference{fieldMandatory('header.reference') ? <> <ReqRequiredMark /></> : null}
                      </label>
                      <input
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                        placeholder="External ref / cheque no."
                        className="w-full h-8 border border-gray-200 rounded-md px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    )}

                    {/* Narration / Description */}
                    {!fieldHidden('header.narration') && (
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">
                        Narration / Description{fieldMandatory('header.narration') ? <> <ReqRequiredMark /></> : null}
                      </label>
                      <input
                        value={narration}
                        onChange={e => setNarration(e.target.value)}
                        placeholder="Header narration — describe the transaction"
                        className="w-full h-8 border border-gray-200 rounded-md px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    )}

                    {/* Header Text / Note */}
                    {!fieldHidden('header.header_text') && (
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">
                        Header Note (internal){fieldMandatory('header.header_text') ? <> <ReqRequiredMark /></> : null}
                      </label>
                      <textarea
                        value={headerText}
                        onChange={e => setHeaderText(e.target.value)}
                        rows={1}
                        placeholder="Internal notes for approvers / auditors…"
                        className="w-full min-h-8 border border-gray-200 rounded-md px-2 py-1.5 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    )}

                    {/* Created by */}
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 col-span-full pt-0.5">
                      <User className="w-3 h-3" />
                      <span>Created by: <strong>{(user as any)?.name || (user as any)?.email || 'you'}</strong></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Line Items ── */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">Line Items</span>
                  <span className="text-xs text-muted-foreground">{lines.length} lines</span>
                </div>
                <button
                  onClick={addLine}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary/80"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Line
                </button>
              </div>

              {/* Column headers */}
              <div className="grid border-b border-border bg-muted/30 px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                style={{ gridTemplateColumns: '2fr 1.5fr 80px 80px 24px' }}>
                <span>Account</span>
                <span>Description</span>
                <span className="text-right">Debit</span>
                <span className="text-right">Credit</span>
                <span />
              </div>

              <div className="divide-y divide-border">
                {lines.map((ln, idx) => (
                  <div key={ln._key} className="group">
                    {/* Main line row */}
                    <div
                      className={cn(
                        'grid cursor-pointer items-center gap-2 px-4 py-2 hover:bg-muted/30',
                        issuesByKey[ln._key] && 'bg-destructive/5',
                      )}
                      style={{ gridTemplateColumns: '2fr 1.5fr 80px 80px 24px' }}
                    >
                      {ln._taxFor ? (
                        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-dashed border-input bg-muted/40 px-2 py-1.5 text-xs">
                          <span className="font-mono text-muted-foreground">{ln._accCode}</span>
                          <span className="truncate">{ln._accName}</span>
                          <span className="ml-auto shrink-0 rounded bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                            AUTO TAX
                          </span>
                        </div>
                      ) : (
                      <AccountCombobox
                        value={ln.account_id}
                        companyId={companyId}
                        initialCode={ln._accCode}
                        initialName={ln._accName}
                        hasError={!!issuesByKey[ln._key]}
                        onChange={(id, acc) => setLine(ln._key, {
                          account_id: id,
                          _accCode: acc?.code,
                          _accName: acc?.name,
                          _accType: acc?.account_type,
                        })}
                      />
                      )}
                      <input
                        value={ln.description || ''}
                        readOnly={!!ln._taxFor}
                        onChange={e => setLine(ln._key, { description: e.target.value })}
                        placeholder="Line description"
                        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="number"
                        min={0}
                        readOnly={!!ln._taxFor}
                        value={ln.debit || ''}
                        onChange={e => setLineAmount(ln._key, 'debit', Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-right text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="number"
                        min={0}
                        readOnly={!!ln._taxFor}
                        value={ln.credit || ''}
                        onChange={e => setLineAmount(ln._key, 'credit', Number(e.target.value))}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-right text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        onClick={() => setExpandedLine(expandedLine === ln._key ? null : ln._key)}
                        className={cn('p-1 text-muted-foreground transition-colors hover:text-primary', ln._taxFor && 'invisible')}
                        title="More fields"
                      >
                        {expandedLine === ln._key
                          ? <ChevronDown className="w-3.5 h-3.5" />
                          : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {issuesByKey[ln._key] && (
                      <div className="px-4 pb-2 text-[11px] text-destructive">
                        {issuesByKey[ln._key].map((m, n) => <p key={n}>⚠ {m}</p>)}
                      </div>
                    )}

                    {/* Expanded extra fields */}
                    {expandedLine === ln._key && !ln._taxFor && (
                      <div className="px-4 pb-3 pt-1 bg-primary/10/30 border-t border-primary/20/60 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                          {/* Cost Centre */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Cost Centre</label>
                            <Select
                              value={ln.cost_center_id || ''}
                              onChange={v => setLine(ln._key, { cost_center_id: v })}
                              options={selectOptionsWithBlank(
                                '— None —',
                                (costCenters as CostCenter[]).map(cc => ({ value: cc.id, label: `${cc.code} · ${cc.name}` })),
                              )}
                              className="text-xs bg-white"
                            />
                          </div>

                          {/* Project */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Project</label>
                            <Select
                              value={ln.project_id || ''}
                              onChange={v => setLine(ln._key, { project_id: v })}
                              options={selectOptionsWithBlank(
                                '— None —',
                                (projects as Project[]).map(p => ({ value: p.id, label: `${p.code} · ${p.name}` })),
                              )}
                              className="text-xs bg-white"
                            />
                          </div>

                          {/* Intercompany */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Intercompany</label>
                            <Select
                              value={ln.intercompany_partner_id || ''}
                              onChange={v => setLine(ln._key, { intercompany_partner_id: v })}
                              options={selectOptionsWithBlank(
                                '— None —',
                                (icPartners as any[]).map((ip: any) => ({
                                  value: ip.id,
                                  label: `IC · ${ip.partner_company_id?.slice(0, 8)}`,
                                })),
                              )}
                              className="text-xs bg-white"
                            />
                          </div>

                          {/* Value Date */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Value Date</label>
                            <input
                              type="date"
                              value={ln.value_date || ''}
                              onChange={e => setLine(ln._key, { value_date: e.target.value })}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                            />
                          </div>

                          {/* Party Type */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Party Type</label>
                            <Select
                              value={ln.party_type || ''}
                              onChange={v => setLine(ln._key, { party_type: (v as any) || undefined, party_id: '' })}
                              options={selectOptionsWithBlank('— None —', [
                                { value: 'customer', label: 'Customer' },
                                { value: 'supplier', label: 'Supplier' },
                              ])}
                              className="text-xs bg-white"
                            />
                          </div>

                          {/* Party */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Party</label>
                            <PartySearch
                              key={`${ln._key}-${ln.party_type || ''}`}
                              partyType={(ln.party_type as 'customer' | 'supplier' | undefined) || undefined}
                              value={ln.party_id || ''}
                              initialName={(ln as any).party_name}
                              hasError={(issuesByKey[ln._key] || []).some(m => /part(y|ner)/i.test(m))}
                              onChange={id => setLine(ln._key, { party_id: id })}
                            />
                          </div>

                          {/* Ref Doc Type */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Ref Doc Type</label>
                            <Select
                              value={ln.ref_doc_type || ''}
                              onChange={v => setLine(ln._key, { ref_doc_type: (v as RefDocType) || undefined, ref_doc_id: '', ref_doc_no: '' })}
                              options={selectOptionsWithBlank(
                                '— None —',
                                REF_DOC_TYPES.map(r => ({ value: r.value, label: r.label })),
                              )}
                              className="text-xs bg-white"
                            />
                          </div>

                          {/* Ref Doc No */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Ref Doc Number</label>
                            <RefDocSearch
                              docType={(ln.ref_doc_type || '') as RefDocType | ''}
                              value={ln.ref_doc_no || ''}
                              onChange={(id, no) => setLine(ln._key, { ref_doc_id: id, ref_doc_no: no })}
                            />
                          </div>

                          {/* Tax Code */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Tax Code</label>
                            <Select
                              value={ln.tax_code || ''}
                              onChange={v => setLineTaxCode(ln._key, (v as string) || '')}
                              options={selectOptionsWithBlank('— None —', [
                                ...taxCodes.map(c => ({
                                  value: c.code,
                                  label: `${c.code} — ${c.name}`,
                                  hint: `${c.tax_type} ${Number(c.rate)}%`,
                                })),
                                // keep a legacy / unknown value visible so it can be corrected
                                ...(ln.tax_code && !taxCodeMap.has(ln.tax_code.trim().toUpperCase())
                                  ? [{ value: ln.tax_code, label: `${ln.tax_code} (not in tax master)` }]
                                  : []),
                              ])}
                              className="text-xs bg-white"
                            />
                          </div>

                          {/* Tax Amount */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Tax Amount</label>
                            <input
                              type="number"
                              min={0}
                              value={ln.tax_amount || ''}
                              onChange={e => setLine(ln._key, { tax_amount: Number(e.target.value) })}
                              placeholder="0.00"
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                            />
                            {ln.tax_code && Number(ln.tax_amount) > 0 && (
                              (Number(ln.debit) > 0 ? taxAccounts?.input : taxAccounts?.output)
                                ? <p className="mt-1 text-[11px] text-muted-foreground">
                                    Posted as a separate line to {Number(ln.debit) > 0 ? 'GST Input' : 'GST Output'}. Enter the other side gross (amount + tax).
                                  </p>
                                : <p className="mt-1 text-[11px] text-destructive">
                                    No {Number(ln.debit) > 0 ? 'GST Input' : 'GST Output'} account found in the chart of accounts — tax will not be posted.
                                  </p>
                            )}
                          </div>

                          {/* Assignment */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Assignment</label>
                            <input
                              value={ln.assignment || ''}
                              onChange={e => setLine(ln._key, { assignment: e.target.value })}
                              placeholder="Clearing reference"
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                            />
                          </div>

                          {/* FX Rate */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">FX Rate</label>
                            <input
                              type="number"
                              step="0.000001"
                              min={0}
                              value={ln.fx_rate || 1}
                              onChange={e => setLine(ln._key, { fx_rate: Number(e.target.value) })}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            onClick={() => removeLine(ln._key)}
                            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 font-medium"
                          >
                            <Trash2 className="w-3 h-3 text-red-600" /> Remove line
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Balance footer */}
              <div className={cn(
                'flex items-center justify-between border-t px-5 py-3 font-mono text-sm font-semibold',
                isBalanced
                  ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                  : 'border-destructive/30 bg-destructive/10 text-destructive',
              )}>
                <div className="flex items-center gap-4">
                  <span>Debit: {fmt(totalDebit)}</span>
                  <span>Credit: {fmt(totalCredit)}</span>
                  {!isBalanced && <span className="text-xs">Difference: {fmt(diff)}</span>}
                </div>
                <span className="flex items-center gap-3 text-xs font-medium">
                  {!isBalanced && (
                    <button
                      type="button"
                      onClick={addBalancingLine}
                      className="rounded-md border border-destructive/40 bg-background px-2 py-0.5 font-sans text-[11px] font-semibold text-destructive hover:bg-destructive/10"
                    >
                      + Balancing line ({fmt(diff)} {totalDebit > totalCredit ? 'Cr' : 'Dr'})
                    </button>
                  )}
                  {isBalanced ? '✓ Balanced' : '⚠ Not balanced'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Right rail: User & Approval ── */}
          <div className="w-64 border-l bg-white flex flex-col shrink-0 overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* User details */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">User Details</p>
                <div className="rounded-xl border border-gray-100 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-700 truncate">{(user as any)?.name || (user as any)?.email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-500 truncate">
                      {companyId
                        ? (companies as Company[]).find(c => c.id === companyId)?.name || '—'
                        : '— No company —'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-500">{today()}</span>
                  </div>
                </div>
              </div>

              {/* Approval panel */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Approval</p>
                {jePolicy ? (
                  <div className={cn(
                    'rounded-xl border p-3 space-y-2 text-xs',
                    needsApproval ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'
                  )}>
                    <div className="flex items-start gap-1.5">
                      {needsApproval
                        ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        : <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />}
                      <div>
                        <p className={cn('font-semibold', needsApproval ? 'text-amber-800' : 'text-gray-600')}>
                          {needsApproval ? 'Approval required' : 'No approval needed'}
                        </p>
                        <p className={cn('mt-0.5 leading-snug', needsApproval ? 'text-amber-700' : 'text-gray-500')}>
                          {jePolicy.threshold_amount == null
                            ? 'All journal entries require approval.'
                            : `Threshold: ≥ ${fmt(jePolicy.threshold_amount)}`}
                        </p>
                        <p className="text-gray-400 mt-1">
                          Current amount: {fmt(totalDebit)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-400">
                    No approval policy configured for journal entries.
                  </div>
                )}
              </div>

              {/* Entry summary */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Summary</p>
                <div className="rounded-xl border border-gray-100 p-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Lines</span>
                    <span className="font-medium text-gray-800">{lines.filter(l => l.account_id).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Debit</span>
                    <span className="font-mono font-semibold text-gray-800">{fmt(totalDebit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Credit</span>
                    <span className="font-mono font-semibold text-gray-800">{fmt(totalCredit)}</span>
                  </div>
                  <div className={cn('flex justify-between border-t pt-1 mt-1', isBalanced ? 'text-green-600' : 'text-red-500')}>
                    <span>Difference</span>
                    <span className="font-mono font-bold">{fmt(diff)}</span>
                  </div>
                </div>
              </div>

              {/* Attachments */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    Attachments{attachments.length ? ` (${attachments.length})` : ''}
                  </p>
                  {uploadingAttachment && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    onChange={async e => {
                      const files = Array.from(e.target.files || [])
                      e.target.value = ''
                      if (!files.length) return
                      const room = Math.max(0, 10 - attachments.length)
                      if (!room) { toast.error('Maximum 10 attachments per entry'); return }
                      const picked = files.slice(0, room)
                      if (files.length > room) toast.error(`Only ${room} more file(s) can be added.`)
                      setUploadingAttachment(true)
                      try {
                        const uploaded: JournalAttachment[] = []
                        for (const file of picked) {
                          if (file.size > 15 * 1024 * 1024) {
                            toast.error(`${file.name} is larger than 15 MB`)
                            continue
                          }
                          const doc = await api.uploadJournalDocument(file)
                          uploaded.push({
                            url: doc.url,
                            filename: doc.filename || file.name,
                            content_type: doc.content_type,
                            size: doc.size,
                            is_image: doc.is_image,
                          })
                        }
                        if (uploaded.length) setAttachments(prev => [...prev, ...uploaded])
                      } catch (err: any) {
                        toast.error(formatApiError(err, 'Upload failed'))
                      } finally {
                        setUploadingAttachment(false)
                      }
                    }}
                  />
                  {attachments.length < 10 && (
                    <button
                      type="button"
                      disabled={uploadingAttachment}
                      onClick={() => attachmentInputRef.current?.click()}
                      className="ml-auto inline-flex h-6 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-[10px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Paperclip className="h-3 w-3" /> Add
                    </button>
                  )}
                </div>
                <div className="rounded-xl border border-gray-100 p-2">
                  {attachments.length === 0 ? (
                    <button
                      type="button"
                      disabled={uploadingAttachment}
                      onClick={() => attachmentInputRef.current?.click()}
                      className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-5 text-center hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                    >
                      <Paperclip className="h-4 w-4 text-gray-400" />
                      <span className="text-[11px] font-medium text-gray-500">Attach files</span>
                      <span className="text-[10px] text-gray-400">PDF, images, Office · max 15 MB</span>
                    </button>
                  ) : (
                    <ul className="max-h-36 space-y-1 overflow-y-auto pr-0.5">
                      {attachments.map(a => (
                        <li key={a.url} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-2 py-1.5">
                          {a.is_image ? (
                            <img src={mediaUrl(a.url)} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          )}
                          <a
                            href={mediaUrl(a.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 flex-1 truncate text-[11px] text-blue-600 hover:underline"
                          >
                            {a.filename}
                          </a>
                          <button
                            type="button"
                            onClick={() => setAttachments(prev => prev.filter(x => x.url !== a.url))}
                            className="text-gray-300 hover:text-red-500"
                            title="Remove"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        </ModalBody>

        <ModalFooter className="border-0 px-4 py-3 justify-between">
          <button type="button" onClick={requestClose} className="btn-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600">Cancel</button>
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={simulate}
            disabled={!isBalanced || isSaving || simMut.isPending}
            title="Dry-run the entry through validation, splitting and approval rules without saving"
            className="flex items-center gap-1.5 rounded-lg border border-primary/40 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="w-4 h-4" /> {simMut.isPending ? 'Simulating…' : 'Simulate'}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!isBalanced || isSaving}
            className={cn(
              'flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all',
              isBalanced
                ? needsApproval
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-primary hover:bg-primary/90 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            {isSaving
              ? 'Saving…'
              : needsApproval
                ? <><SendHorizonal className="w-4 h-4" /> Submit for Approval</>
                : <><Save className="w-4 h-4" /> Save Entry</>}
          </button>
          </div>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>

    {savePreview && (
      <div data-kiterp-modal className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={onSaved}>
        <div className="bg-card border border-border text-foreground rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {savePreview.status === 'pending_approval' ? 'Submitted for approval' : 'Entry saved'}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {savePreview.status === 'pending_approval'
                    ? 'This journal entry is pending approval. You can track it in the list below.'
                    : 'Your journal entry was saved. Review the document summary below.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSaved}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              aria-label="Close"
            >
                <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-6 py-4 overflow-y-auto space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-gray-400 font-medium">Document</p>
                <p className="text-gray-900 font-mono font-semibold">{savePreview.entry_no}</p>
              </div>
              <div>
                <p className="text-gray-400 font-medium">Status</p>
                <p className="text-gray-900"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[savePreview.status] || 'bg-gray-100')}>{savePreview.status}</span></p>
              </div>
              <div>
                <p className="text-gray-400 font-medium">Posting date</p>
                <p className="text-gray-900">{savePreview.entry_date}</p>
              </div>
              <div>
                <p className="text-gray-400 font-medium">Type</p>
                <p className="text-gray-900">{savePreview.document_type}</p>
              </div>
            </div>
            {savePreview.narration && (
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-700">
                <span className="text-gray-400 font-medium">Narration · </span>
                {savePreview.narration}
              </div>
            )}
            {savePreview.lines && savePreview.lines.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="text-left px-2 py-1.5"><TableColumnLabel>Account</TableColumnLabel></th>
                      <th className="text-right px-2 py-1.5"><TableColumnLabel>Dr</TableColumnLabel></th>
                      <th className="text-right px-2 py-1.5"><TableColumnLabel>Cr</TableColumnLabel></th>
                    </tr>
                  </thead>
                  <tbody>
                    {savePreview.lines.map((ln, i) => (
                      <tr key={ln.id || i} className="border-b border-gray-100 last:border-0">
                        <td className="px-2 py-1.5 text-gray-800">
                          {ln.account_code && <span className="font-mono text-gray-500 mr-1">{ln.account_code}</span>}
                          {ln.account_name || '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-gray-800">{Number(ln.debit) > 0 ? fmt(ln.debit) : '—'}</td>
                        <td className="px-2 py-1.5 text-right font-mono text-gray-800">{Number(ln.credit) > 0 ? fmt(ln.credit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-border bg-muted/25 flex justify-end gap-2">
            {canPost && (savePreview.status === 'draft' || savePreview.status === 'approved') && (
              <button
                type="button"
                disabled={postMut.isPending}
                onClick={() =>
                  postMut.mutate(savePreview.id, {
                    onSuccess: () => { toast.success(`${savePreview.entry_no} posted`); onSaved() },
                    onError: (e: any) => toast.error(formatApiError(e, 'Cannot post')),
                  })
                }
                className="flex items-center gap-1.5 rounded-lg border border-green-600/40 px-5 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" /> {postMut.isPending ? 'Posting…' : 'Post now'}
              </button>
            )}
            <button
              type="button"
              onClick={onSaved}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary/90"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    )}

    {sim && (
      <SimulationDialog
        sim={sim}
        onClose={() => setSim(null)}
        onSave={() => { setSim(null); save() }}
        saving={isSaving}
      />
    )}
    </>
  )
}

// ─── Simulation dialog ────────────────────────────────────────────────────────
const ISSUE_STYLE: Record<JEIssue['severity'], string> = {
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}

function SimulationDialog({
  sim, onClose, onSave, saving,
}: { sim: JESimulationResult; onClose: () => void; onSave: () => void; saving: boolean }) {
  const errors = sim.issues.filter(i => i.severity === 'error')
  const others = sim.issues.filter(i => i.severity !== 'error')
  const splitsByLine = useMemo(() => {
    const m: Record<number, JESimulationResult['split_items']> = {}
    for (const s of sim.split_items) if (s.line_index != null) (m[s.line_index] ||= []).push(s)
    return m
  }, [sim.split_items])

  return (
    <div
      data-kiterp-modal
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Play className="h-4 w-4 text-primary" /> Simulation result
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                nothing was saved
              </span>
            </h3>
            <p className={cn('mt-0.5 text-xs', sim.ok ? 'text-green-700' : 'text-destructive')}>
              {sim.ok
                ? 'This entry passes every check and would be saved as shown.'
                : `${errors.length} problem${errors.length === 1 ? '' : 's'} must be fixed before this can be saved.`}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4 text-sm">
          {[...errors, ...others].length > 0 && (
            <div className="space-y-1.5">
              {[...errors, ...others].map((i, n) => (
                <div key={n} className={cn('rounded-lg border px-3 py-1.5 text-xs', ISSUE_STYLE[i.severity])}>
                  <span className="font-semibold uppercase">{i.severity}</span>
                  {i.line != null && <span> · Line {i.line + 1}</span>}
                  {i.field && i.line == null && <span> · {i.field}</span>}
                  {' — '}{i.message}
                </div>
              ))}
            </div>
          )}

          {sim.ok && sim.entry && (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                <div>
                  <p className="font-medium text-muted-foreground">Document no.</p>
                  <p className="font-mono font-semibold">{sim.entry.entry_no} <span className="font-sans font-normal text-muted-foreground">(provisional)</span></p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Status after save</p>
                  <p><span className={cn('rounded-full px-2 py-0.5 font-medium', STATUS_COLORS[sim.entry.status_after_save])}>
                    {STATUS_LABELS[sim.entry.status_after_save] || sim.entry.status_after_save}
                  </span></p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Accounting period</p>
                  <p className={sim.entry.period_name ? '' : 'text-amber-700'}>
                    {sim.entry.period_name ? `${sim.entry.period_name} (${sim.entry.period_status})` : 'None open for this date'}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Approval</p>
                  <p className={sim.approval?.required ? 'text-amber-700' : 'text-green-700'}>
                    {sim.approval?.required ? `Required (${fmt(sim.approval.amount)})` : 'Not required'}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left">#</th>
                      <th className="px-2 py-1.5 text-left">Account</th>
                      <th className="px-2 py-1.5 text-right">Debit</th>
                      <th className="px-2 py-1.5 text-right">Credit</th>
                      <th className="px-2 py-1.5 text-right">Base Dr</th>
                      <th className="px-2 py-1.5 text-right">Base Cr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sim.lines.map(l => (
                      <Fragment key={l.index}>
                        <tr className="border-b border-border last:border-0">
                          <td className="px-2 py-1.5 text-muted-foreground">{l.index + 1}</td>
                          <td className="px-2 py-1.5">
                            <span className="mr-1 font-mono text-muted-foreground">{l.account_code}</span>{l.account_name}
                            {l.open_item && <span className="ml-1 rounded bg-blue-100 px-1 text-[10px] text-blue-700">open item</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono">{Number(l.debit) > 0 ? fmt(l.debit) : ''}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{Number(l.credit) > 0 ? fmt(l.credit) : ''}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{Number(l.base_debit) > 0 ? fmt(l.base_debit) : ''}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{Number(l.base_credit) > 0 ? fmt(l.base_credit) : ''}</td>
                        </tr>
                        {(splitsByLine[l.index] || []).map((s, k) => (
                          <tr key={`${l.index}-${k}`} className="border-b border-border bg-muted/20 text-[11px] text-muted-foreground">
                            <td />
                            <td className="px-2 py-1 pl-6">↳ split {Number(s.split_pct).toFixed(2)}%</td>
                            <td className="px-2 py-1 text-right font-mono">{Number(s.debit) > 0 ? fmt(s.debit) : ''}</td>
                            <td className="px-2 py-1 text-right font-mono">{Number(s.credit) > 0 ? fmt(s.credit) : ''}</td>
                            <td colSpan={2} />
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-border bg-muted/40 font-semibold">
                    <tr>
                      <td colSpan={2} className="px-2 py-1.5 text-right">Total</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmt(sim.entry.total_debit)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmt(sim.entry.total_credit)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {sim.post_blockers && sim.post_blockers.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                  <p className="mb-1 font-semibold">It can't be posted straight after saving because:</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                    {sim.post_blockers.map((b, n) => <li key={n}>{b.message}</li>)}
                  </ul>
                </div>
              )}
              {sim.can_post_after_save && (
                <p className="text-xs text-green-700">✓ Once saved, this entry can be posted immediately.</p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-muted/25 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
            {sim.ok ? 'Back to editing' : 'Fix problems'}
          </button>
          {sim.ok && (
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {sim.approval?.required ? 'Save & submit for approval' : 'Save entry'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Action dialogs (post / void / reverse / withdraw / reject) ───────────────
function DialogFrame({
  title, onClose, children, footer, tone = 'default',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <div
      data-kiterp-modal
      className="fixed inset-0 z-[130] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className={cn('text-base font-semibold', tone === 'danger' && 'text-destructive')}>{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm">{children}</div>
        <div className="flex justify-end gap-2 border-t border-border bg-muted/25 px-5 py-3">{footer}</div>
      </div>
    </div>
  )
}

function ActionDialog({
  action, je, onClose, onDone,
}: { action: JEAction; je: JournalEntry; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [reversalDate, setReversalDate] = useState(today())
  const postMut = usePostJournalEntry()
  const voidMut = useVoidJournalEntry()
  const reverseMut = useReverseJournalEntry()
  const withdrawMut = useWithdrawJournalEntry()
  const rejectMut = useRejectRequest()
  const qc = useQueryClient()

  const check = useQuery({
    queryKey: ['finance', 'journal-post-check', je.id],
    queryFn: () => api.getJournalPostCheck(je.id),
    enabled: action === 'post',
    staleTime: 0,
    gcTime: 0,
  })
  const blockers = ((check.data?.issues || []) as JEIssue[]).filter(i => i.severity === 'error')

  const fail = (e: any) => toast.error(formatApiError(e))
  const done = (msg: string) => () => { toast.success(msg); onDone() }
  const btn = 'rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'
  const cancel = <button type="button" onClick={onClose} className={cn(btn, 'border border-border text-muted-foreground hover:bg-muted')}>Cancel</button>

  const summary = (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
      <div className="flex justify-between"><span className="text-muted-foreground">Entry</span><span className="font-mono font-semibold">{je.entry_no}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Posting date</span><span>{je.entry_date}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-mono">{fmt(je.total_debit)}</span></div>
    </div>
  )

  if (action === 'post') {
    return (
      <DialogFrame
        title="Post journal entry"
        onClose={onClose}
        footer={<>
          {cancel}
          <button
            type="button"
            disabled={check.isLoading || blockers.length > 0 || postMut.isPending}
            onClick={() => postMut.mutate(je.id, { onSuccess: done(`${je.entry_no} posted`), onError: fail })}
            className={cn(btn, 'bg-green-600 text-white hover:bg-green-700')}
          >
            {postMut.isPending ? 'Posting…' : 'Post to ledger'}
          </button>
        </>}
      >
        {summary}
        {check.isLoading && <p className="text-xs text-muted-foreground">Checking period, approval and accounts…</p>}
        {blockers.length > 0 ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <p className="mb-1 font-semibold">This entry can't be posted yet:</p>
            <ul className="list-disc space-y-0.5 pl-4">{blockers.map((b, n) => <li key={n}>{b.message}</li>)}</ul>
          </div>
        ) : !check.isLoading && (
          <p className="text-xs text-muted-foreground">
            Posting makes this entry final: it appears in the ledger and trial balance and can only be corrected by a reversal.
          </p>
        )}
      </DialogFrame>
    )
  }

  if (action === 'reverse') {
    return (
      <DialogFrame
        title="Reverse journal entry"
        onClose={onClose}
        footer={<>
          {cancel}
          <button
            type="button"
            disabled={reverseMut.isPending || !reversalDate}
            onClick={() => reverseMut.mutate(
              { id: je.id, data: { reversal_date: reversalDate, reason: reason.trim() || undefined } },
              { onSuccess: (r: any) => { toast.success(`Reversed by ${r.reversal_entry_no}`); onDone() }, onError: fail },
            )}
            className={cn(btn, 'bg-primary text-white hover:bg-primary/90')}
          >
            {reverseMut.isPending ? 'Reversing…' : 'Post reversal'}
          </button>
        </>}
      >
        {summary}
        <p className="text-xs text-muted-foreground">
          A new posted entry with debits and credits swapped is created and linked to this one. The original stays in the ledger for the audit trail.
        </p>
        <label className="block text-xs font-semibold text-muted-foreground">
          Reversal posting date
          <input type="date" value={reversalDate} onChange={e => setReversalDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          Reason
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this being reversed?"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </label>
      </DialogFrame>
    )
  }

  if (action === 'void') {
    return (
      <DialogFrame
        tone="danger"
        title="Void journal entry"
        onClose={onClose}
        footer={<>
          {cancel}
          <button
            type="button"
            disabled={voidMut.isPending || !reason.trim()}
            onClick={() => voidMut.mutate({ id: je.id, reason: reason.trim() }, { onSuccess: done(`${je.entry_no} voided`), onError: fail })}
            className={cn(btn, 'bg-destructive text-white hover:bg-destructive/90')}
          >
            {voidMut.isPending ? 'Voiding…' : 'Void entry'}
          </button>
        </>}
      >
        {summary}
        <p className="text-xs text-muted-foreground">
          Voiding removes the entry from the ledger entirely. Prefer <strong>Reverse</strong> unless it was posted by mistake.
        </p>
        <label className="block text-xs font-semibold text-muted-foreground">
          Reason <span className="text-red-500">*</span>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Required for the audit log"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </label>
      </DialogFrame>
    )
  }

  if (action === 'withdraw') {
    return (
      <DialogFrame
        title="Withdraw from approval"
        onClose={onClose}
        footer={<>
          {cancel}
          <button
            type="button"
            disabled={withdrawMut.isPending}
            onClick={() => withdrawMut.mutate(je.id, { onSuccess: done('Withdrawn — the entry is a draft again'), onError: fail })}
            className={cn(btn, 'bg-primary text-white hover:bg-primary/90')}
          >
            {withdrawMut.isPending ? 'Withdrawing…' : 'Withdraw'}
          </button>
        </>}
      >
        {summary}
        <p className="text-xs text-muted-foreground">The pending approval request is cancelled and the entry returns to draft so it can be edited.</p>
      </DialogFrame>
    )
  }

  // reject
  return (
    <DialogFrame
      tone="danger"
      title="Reject journal entry"
      onClose={onClose}
      footer={<>
        {cancel}
        <button
          type="button"
          disabled={rejectMut.isPending || !reason.trim() || !je.approval_request_id}
          onClick={() => rejectMut.mutate(
            { id: je.approval_request_id as string, data: { step: 1, comments: reason.trim() } },
            {
              onSuccess: () => {
                for (const k of ['journal-entries', 'journal-entry', 'journal-timeline']) qc.invalidateQueries({ queryKey: ['finance', k] })
                toast.success(`${je.entry_no} rejected`); onDone()
              },
              onError: fail,
            },
          )}
          className={cn(btn, 'bg-destructive text-white hover:bg-destructive/90')}
        >
          {rejectMut.isPending ? 'Rejecting…' : 'Reject'}
        </button>
      </>}
    >
      {summary}
      <label className="block text-xs font-semibold text-muted-foreground">
        Reason <span className="text-red-500">*</span>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Tell the requester what to fix"
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
      </label>
    </DialogFrame>
  )
}

/**
 * One place that decides what each action does, shared by the list rows and the detail panel
 * so both always agree (the server's `allowed_actions` decides which are offered).
 */
function useJournalActions(onChanged: () => void) {
  const [pending, setPending] = useState<{ action: JEAction; je: JournalEntry } | null>(null)
  const submitMut = useSubmitJournalEntry()
  const approveMut = useApproveRequest()
  const qc = useQueryClient()

  const run = (action: JEAction, je: JournalEntry) => {
    if (action === 'submit') {
      submitMut.mutate(je.id, {
        onSuccess: (r: any) => {
          toast.success(r?.approval_raised ? 'Submitted for approval' : 'No approval needed — the entry is ready to post')
          onChanged()
        },
        onError: (e: any) => toast.error(formatApiError(e)),
      })
    } else if (action === 'approve') {
      if (!je.approval_request_id) return
      approveMut.mutate({ id: je.approval_request_id, data: { step: 1 } }, {
        onSuccess: () => {
          for (const k of ['journal-entries', 'journal-entry', 'journal-timeline']) qc.invalidateQueries({ queryKey: ['finance', k] })
          toast.success(`${je.entry_no} approved`)
          onChanged()
        },
        onError: (e: any) => toast.error(formatApiError(e)),
      })
    } else if (action === 'post' || action === 'void' || action === 'reverse' || action === 'withdraw' || action === 'reject') {
      setPending({ action, je })
    }
  }

  const dialog = pending ? (
    <ActionDialog
      action={pending.action}
      je={pending.je}
      onClose={() => setPending(null)}
      onDone={() => { setPending(null); onChanged() }}
    />
  ) : null

  return { run, dialog, busy: submitMut.isPending || approveMut.isPending }
}

const ACTION_META: Partial<Record<JEAction, { label: string; icon: typeof Pencil; cls: string }>> = {
  edit: { label: 'Edit', icon: Pencil, cls: 'text-gray-500 hover:text-primary' },
  submit: { label: 'Submit for approval', icon: Send, cls: 'text-amber-600 hover:text-amber-800' },
  withdraw: { label: 'Withdraw from approval', icon: Undo2, cls: 'text-gray-500 hover:text-gray-800' },
  approve: { label: 'Approve', icon: ThumbsUp, cls: 'text-blue-600 hover:text-blue-800' },
  reject: { label: 'Reject', icon: ThumbsDown, cls: 'text-orange-600 hover:text-orange-800' },
  post: { label: 'Post', icon: CheckCircle, cls: 'text-green-600 hover:text-green-800' },
  reverse: { label: 'Reverse', icon: Undo2, cls: 'text-indigo-600 hover:text-indigo-800' },
  void: { label: 'Void', icon: Ban, cls: 'text-red-500 hover:text-red-700' },
}

/** Which of the server-allowed actions this user may actually perform. */
function usePermittedActions(je: JournalEntry): JEAction[] {
  const { user } = useAuthStore()
  const canCreate = useHasPermission('finance.journal.create')
  const canPost = useHasPermission('finance.journal.post')
  const canApprove = useHasPermission('finance.controls.approve')
  const isRequester = !!je.created_by_id && je.created_by_id === (user as any)?.id
  return (je.allowed_actions || []).filter(a => {
    if (a === 'edit' || a === 'submit' || a === 'withdraw') return canCreate
    if (a === 'post' || a === 'reverse' || a === 'void') return canPost
    if (a === 'approve' || a === 'reject') return canApprove && !isRequester
    return false
  })
}

function JEActionButtons({
  je, onAction, size = 'icon',
}: { je: JournalEntry; onAction: (a: JEAction) => void; size?: 'icon' | 'full' }) {
  const actions = usePermittedActions(je).filter(a => ACTION_META[a])
  if (!actions.length) return size === 'icon' ? <span className="text-gray-300">—</span> : null
  return (
    <div className={cn('flex gap-1', size === 'full' && 'flex-wrap gap-2')} onClick={e => e.stopPropagation()}>
      {actions.map(a => {
        const m = ACTION_META[a]!
        const Icon = m.icon
        return size === 'icon' ? (
          <button key={a} type="button" title={m.label} aria-label={m.label} onClick={() => onAction(a)}
            className={cn('rounded p-1 transition-colors hover:bg-gray-100', m.cls)}>
            <Icon className="h-4 w-4" />
          </button>
        ) : (
          <button key={a} type="button" onClick={() => onAction(a)}
            className={cn('flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted', m.cls)}>
            <Icon className="h-3.5 w-3.5" /> {m.label}
          </button>
        )
      })}
    </div>
  )
}

function StatusBadge({ je }: { je: JournalEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[je.status] || '')}>
        {STATUS_LABELS[je.status] || je.status}
        {je.status === 'pending_approval' && je.approval_progress && je.approval_progress.levels_required > 1
          ? ` · ${je.approval_progress.levels_approved}/${je.approval_progress.levels_required}` : ''}
      </span>
      {je.reversed_by_entry_no && (
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700" title={`Reversed by ${je.reversed_by_entry_no}`}>
          Reversed
        </span>
      )}
      {je.reverses_entry_no && (
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600" title={`Reversal of ${je.reverses_entry_no}`}>
          Reversal
        </span>
      )}
    </div>
  )
}

// ─── JE Detail View ───────────────────────────────────────────────────────────
const AUDIT_LABELS: Record<string, string> = {
  created: 'Created', updated: 'Edited', submitted: 'Submitted for approval', approved: 'Approved',
  rejected: 'Rejected', withdrawn: 'Withdrawn from approval', posted: 'Posted', reversed: 'Reversed', void: 'Voided',
}

function JEDetail({
  jeId, onClose, onEdit, onChanged,
}: { jeId: string; onClose: () => void; onEdit: (id: string) => void; onChanged: () => void }) {
  const { data: je, isLoading, refetch } = useJournalEntry(jeId)
  const { data: timeline } = useJournalTimeline(jeId)
  const actions = useJournalActions(() => { refetch(); onChanged() })

  if (isLoading) return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-card border border-border text-foreground rounded-xl p-8 text-muted-foreground text-sm">Loading…</div>
    </div>
  )
  if (!je) return null

  const jed = je as unknown as JournalEntry
  const hasFx = (jed.lines || []).some(l => Number(l.fx_rate) !== 1)
  const handle = (a: JEAction) => (a === 'edit' ? onEdit(jed.id) : actions.run(a, jed))

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[100] flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-3xl bg-card border-l border-border text-foreground h-full shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Journal Entry — {jed.entry_no}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <StatusBadge je={jed} />
              <span className="text-xs text-gray-400">{jed.document_type} · {jed.entry_date}</span>
              {jed.company_name && <span className="text-xs text-gray-400">· {jed.company_name}</span>}
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <JEActionButtons je={jed} onAction={handle} size="full" />

          {jed.status === 'pending_approval' && jed.approval_progress && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Awaiting approval
              {jed.approval_progress.levels_required > 1
                ? ` — level ${Math.min(jed.approval_progress.levels_approved + 1, jed.approval_progress.levels_required)} of ${jed.approval_progress.levels_required}`
                : ''}
              .
              {jed.approval_blocked_reason && <span className="mt-0.5 block text-amber-700">{jed.approval_blocked_reason}</span>}
            </div>
          )}

          {(jed.reversed_by_entry_no || jed.reverses_entry_no) && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              {jed.reversed_by_entry_no && <>This entry was reversed by <strong className="font-mono">{jed.reversed_by_entry_no}</strong>.</>}
              {jed.reverses_entry_no && <>This is the reversal of <strong className="font-mono">{jed.reverses_entry_no}</strong>.</>}
            </div>
          )}

          {/* Header summary */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            {[
              ['Posting Date', jed.entry_date],
              ['Document Date', jed.document_date || '—'],
              ['Reference', jed.reference || '—'],
              ['Narration', jed.narration || '—'],
              ['Currency', jed.currency],
              ['Requires Approval', jed.requires_approval ? `Yes${jed.approval_status ? ` (${jed.approval_status})` : ''}` : 'No'],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-gray-400 font-medium">{k}</p>
                <p className="text-gray-800 mt-0.5">{v}</p>
              </div>
            ))}
          </div>
          {jed.header_text && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">{jed.header_text}</div>
          )}
          {(jed.attachments?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                <Paperclip className="h-3 w-3" /> Attachments ({jed.attachments!.length})
              </p>
              <ul className="space-y-1">
                {jed.attachments!.map(a => (
                  <li key={a.url} className="flex items-center gap-2">
                    {a.is_image ? (
                      <img src={mediaUrl(a.url)} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    )}
                    <a
                      href={mediaUrl(a.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 truncate text-xs text-blue-600 hover:underline"
                    >
                      {a.filename}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Lines */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['#', 'Account', 'Description', 'Debit', 'Credit', ...(hasFx ? ['FX', 'Base Dr', 'Base Cr'] : []), 'Cost Ctr', 'Project', 'Ref Doc'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(jed.lines || []).map((ln, i) => {
                  const code = (ln as any).account_code as string | undefined
                  const name = (ln as any).account_name as string | undefined
                  const desc = ln.description || (ln as any).narration || '—'
                  const ccLabel = (ln as any).cost_center_code
                    || (ln as any).cost_center_name
                    || '—'
                  const projectLabel = (ln as any).project_code
                    || (ln as any).project_name
                    || '—'
                  return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 text-gray-800">
                      {code || name ? (
                        <div className="flex flex-col gap-0.5 min-w-0">
                          {code ? <span className="font-mono text-[11px] text-gray-500">{code}</span> : null}
                          <span className="font-medium truncate">{name || 'Unnamed account'}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Unknown account</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate">{desc}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(ln.debit) > 0 ? fmt(ln.debit) : ''}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(ln.credit) > 0 ? fmt(ln.credit) : ''}</td>
                    {hasFx && (
                      <>
                        <td className="px-3 py-2 text-right font-mono text-gray-500">{Number(ln.fx_rate)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-500">{Number(ln.base_debit) > 0 ? fmt(ln.base_debit) : ''}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-500">{Number(ln.base_credit) > 0 ? fmt(ln.base_credit) : ''}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-gray-500 truncate">{ccLabel}</td>
                    <td className="px-3 py-2 text-gray-500 truncate">{projectLabel}</td>
                    <td className="px-3 py-2 text-gray-400">{ln.ref_doc_type ? `${ln.ref_doc_type}: ${ln.ref_doc_no || ''}` : '—'}</td>
                  </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-3 py-2 font-semibold text-xs text-right text-gray-600">Total</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmt(jed.total_debit)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmt(jed.total_credit)}</td>
                  <td colSpan={hasFx ? 6 : 3} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Document splitting */}
          {timeline && timeline.split_items.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <p className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600">Document splitting</p>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-gray-100">
                  {timeline.split_items.map(s => (
                    <tr key={s.id}>
                      <td className="px-3 py-1.5 text-gray-500">Line {s.line_index != null ? s.line_index + 1 : '?'}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{Number(s.split_pct).toFixed(2)}%</td>
                      <td className="px-3 py-1.5 text-right font-mono">{Number(s.debit) > 0 ? fmt(s.debit) : ''}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{Number(s.credit) > 0 ? fmt(s.credit) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Approval + audit trail */}
          {timeline && (timeline.approval || timeline.audit.length > 0) && (
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="mb-2 text-xs font-semibold text-gray-600">History</p>
              <ol className="space-y-2 border-l border-gray-200 pl-4 text-xs">
                {timeline.audit.map(a => {
                  const reason = a.diff_json?.reason
                  const reversalNo = a.diff_json?.reversal_no
                  return (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                      <span className="font-medium text-gray-800">{AUDIT_LABELS[a.action] || a.action}</span>
                      <span className="ml-2 text-gray-400">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</span>
                      {typeof reason === 'string' && reason !== '' && <p className="text-gray-500">Reason: {reason}</p>}
                      {typeof reversalNo === 'string' && <p className="text-gray-500">Reversal entry: {reversalNo}</p>}
                    </li>
                  )
                })}
              </ol>
              {timeline.approval && (
                <div className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-600">
                  <p>
                    Approval request:{' '}
                    <span className="font-semibold capitalize">{timeline.approval.status}</span>
                    {timeline.approval.levels_required > 1 && (
                      <> · {timeline.approval.levels_approved} of {timeline.approval.levels_required} levels approved</>
                    )}
                    {timeline.approval.amount != null && <> · {fmt(timeline.approval.amount as number)}</>}
                    {timeline.approval.requested_by_name && <> · raised by {timeline.approval.requested_by_name}</>}
                  </p>
                  {timeline.approval.steps.map(s => (
                    <p key={s.id} className="text-gray-500">
                      Level {s.step_number}: <span className="capitalize">{s.status}</span>
                      {s.approver_name ? ` by ${s.approver_name}` : ''}
                      {s.action_at ? ` · ${new Date(s.action_at).toLocaleString()}` : ''}
                      {s.comments ? ` — “${s.comments}”` : ''}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {actions.dialog}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25
const STATUS_FILTERS = ['', 'draft', 'pending_approval', 'approved', 'rejected', 'posted', 'void']

export default function JournalEntries() {
  const [filter, setFilter] = useState({ status: '', from_date: '', to_date: '', company_id: '' })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [showNew, setShowNew] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const { data: companies = [] } = useCompanies()

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const params = useMemo(() => ({
    limit: PAGE_SIZE,
    skip: page * PAGE_SIZE,
    status: filter.status || undefined,
    from_date: filter.from_date || undefined,
    to_date: filter.to_date || undefined,
    company_id: filter.company_id || undefined,
    q: debouncedSearch || undefined,
  }), [filter, debouncedSearch, page])

  const { data, isLoading, isFetching, refetch } = useJournalEntries(params)
  const canCreate = useHasPermission('finance.journal.create')

  const entries = (data?.items || []) as JournalEntry[]
  const total: number = data?.total ?? entries.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleSaved = () => { setShowNew(false); setEditId(null); refetch() }
  const actions = useJournalActions(() => refetch())
  const onRowAction = (a: JEAction, e: JournalEntry) => {
    if (a === 'edit') { setEditId(e.id); setShowNew(false); setDetailId(null) }
    else actions.run(a, e)
  }
  const setStatus = (s: string) => { setFilter(f => ({ ...f, status: s })); setPage(0) }
  const hasFilters = !!(filter.status || filter.from_date || filter.to_date || filter.company_id || debouncedSearch)

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal Entries</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} {total === 1 ? 'entry' : 'entries'}{hasFilters ? ' match your filters' : ''}</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 font-medium"
          >
            <Plus className="w-4 h-4" /> New Entry
          </button>
        )}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm border transition-colors',
              filter.status === s
                ? 'bg-primary text-white border-primary'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            )}
          >
            {s === '' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Search + range filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Entry no, reference or narration…"
            className="w-72 rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <label className="text-xs text-gray-500">
          From
          <input type="date" value={filter.from_date} onChange={e => { setFilter(f => ({ ...f, from_date: e.target.value })); setPage(0) }}
            className="mt-0.5 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-gray-500">
          To
          <input type="date" value={filter.to_date} onChange={e => { setFilter(f => ({ ...f, to_date: e.target.value })); setPage(0) }}
            className="mt-0.5 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        {(companies as Company[]).length > 1 && (
          <label className="text-xs text-gray-500">
            Business unit
            <div className="mt-0.5 w-48">
              <Select
                value={filter.company_id}
                onChange={v => { setFilter(f => ({ ...f, company_id: v })); setPage(0) }}
                options={selectOptionsWithBlank('All', (companies as Company[]).map(c => ({ value: c.id, label: `${c.code} · ${c.name}` })))}
                className="text-sm"
              />
            </div>
          </label>
        )}
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setFilter({ status: '', from_date: '', to_date: '', company_id: '' }); setSearch(''); setPage(0) }}
            className="pb-2 text-xs font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden transition-opacity', isFetching && !isLoading && 'opacity-70')}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Entry No', 'Business unit', 'Posting Date', 'Doc Date', 'Type', 'Narration', 'Debit', 'Credit', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">{hasFilters ? 'No journal entries match these filters.' : 'No journal entries found.'}</td></tr>
            ) : entries.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50 cursor-pointer" onClick={onClickableTableRow(() => setDetailId(e.id))}>
                <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{e.entry_no}</td>
                <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[100px]">{e.company_name || '—'}</td>
                <td className="px-4 py-3 text-gray-700 text-xs">{e.entry_date}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{e.document_date || '—'}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{e.document_type || 'SA'}</span>
                </td>
                <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate" title={e.narration || ''}>{e.narration || '—'}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{fmt(e.total_debit)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{fmt(e.total_credit)}</td>
                <td className="px-4 py-3"><StatusBadge je={e} /></td>
                <td className="px-4 py-3">
                  <JEActionButtons je={e} onAction={a => onRowAction(a, e)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <span>Page {page + 1} / {pageCount}</span>
              <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage(p => p + 1)}
                className="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 disabled:opacity-40">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New JE drawer */}
      {showNew && !editId && (
        <JEDrawer mode="new" onClose={() => setShowNew(false)} onSaved={handleSaved} />
      )}

      {/* Edit JE drawer */}
      {editId && (
        <EditJEWrapper jeId={editId} onClose={() => setEditId(null)} onSaved={handleSaved} />
      )}

      {/* Detail view */}
      {detailId && !editId && (
        <JEDetail
          jeId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={id => { setEditId(id); setDetailId(null) }}
          onChanged={() => refetch()}
        />
      )}

      {actions.dialog}
    </div>
  )
}

// Small wrapper to load the JE before opening the edit drawer
function EditJEWrapper({ jeId, onClose, onSaved }: { jeId: string; onClose: () => void; onSaved: () => void }) {
  const { data: je, isLoading } = useJournalEntry(jeId)
  if (isLoading || !je) return null
  return (
    <JEDrawer
      mode="edit"
      initialData={je as unknown as JournalEntry}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}
