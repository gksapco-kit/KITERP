import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { useQuery } from '@tanstack/react-query'
import {
  useJournalEntries, usePostJournalEntry, useVoidJournalEntry,
  useCreateJournalEntry, useUpdateJournalEntry, useJournalEntry,
  useCompanies, useCostCenters, useProjects, useIntercompanyPartners,
  useApprovalPolicies, useApprovals, useApproveRequest,
  useFiscalYears,
  usePeriods,
} from '@/hooks/useFinance'
import * as api from '@/api/finance'
import type {
  JournalEntry, JournalLineIn, JournalEntryCreate,
  Company, CostCenter, Project, AccountSearchResult, RefDocResult,
  DocType, RefDocType,
} from '@/types/finance'
import { DOC_TYPES, REF_DOC_TYPES } from '@/types/finance'
import {
  Plus, CheckCircle, XCircle, Pencil, X, Trash2, Search,
  ChevronDown, ChevronRight, AlertTriangle, Clock, Building2,
  User, FileText, Info, Save, SendHorizonal, Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import { useAuthStore } from '@/stores/authStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_approval: 'bg-amber-100 text-amber-700',
  posted: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-600',
}

function fmt(n: number | string) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0)
}

const today = () => new Date().toISOString().slice(0, 10)

// ─── Account Combobox ─────────────────────────────────────────────────────────
function AccountCombobox({
  value, onChange, companyId, placeholder = 'Search account…',
}: {
  value: string
  onChange: (id: string, acc?: AccountSearchResult) => void
  companyId?: string
  placeholder?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<AccountSearchResult[]>([])
  const [selected, setSelected] = useState<AccountSearchResult | null>(null)
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
    if (!value) { setSelected(null); setQ('') }
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
          className={cn(lineInputClass, 'pl-6 pr-2')}
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

// ─── Empty line factory ───────────────────────────────────────────────────────
function emptyLine(): JournalLineIn & { _key: string; _accCode?: string; _accName?: string; _accType?: string } {
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

// ─── JE Drawer ────────────────────────────────────────────────────────────────
interface JEDrawerProps {
  mode: 'new' | 'edit'
  initialData?: JournalEntry | null
  onClose: () => void
  onSaved: () => void
}

function JEDrawer({
 mode, initialData, onClose, onSaved }: JEDrawerProps) {
  useEscapeToClose(onClose)

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
        _key: Math.random().toString(36).slice(2),
        _accCode: (l as any).account_code,
        _accName: (l as any).account_name,
      }))
    }
    return [emptyLine(), emptyLine()]
  })

  const [expandedLine, setExpandedLine] = useState<string | null>(null)

  const setLine = (key: string, patch: Partial<FullLine>) =>
    setLines(prev => prev.map(l => l._key === key ? { ...l, ...patch } : l))

  const addLine = () => {
    const nl = emptyLine()
    setLines(prev => [...prev, nl])
    setExpandedLine(nl._key)
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

  const buildPayload = (): JournalEntryCreate => ({
    company_id: companyId || undefined,
    entry_date: entryDate,
    document_date: documentDate || undefined,
    document_type: docType,
    source_type: 'manual',
    reference: reference || undefined,
    narration: narration || undefined,
    header_text: headerText || undefined,
    currency: currency === 'Default' ? (defaultCompany?.currency || 'INR') : currency,
    period_id: periodId || undefined,
    lines: lines
      .filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map(l => ({
        account_id: l.account_id,
        description: l.description || undefined,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        currency: l.currency || 'INR',
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
  })

  const formatApiError = (e: any): string => {
    const detail = e?.response?.data?.detail
    if (!detail) return 'Save failed'
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ')
    return JSON.stringify(detail)
  }

  const save = () => {
    if (!isBalanced) { toast.error('Entry is not balanced'); return }
    if (fieldMandatory('header.narration') && !narration?.trim()) {
      toast.error('Narration is required.')
      return
    }
    if (fieldMandatory('header.reference') && !reference?.trim()) {
      toast.error('Reference is required (field configuration).')
      return
    }
    if (fieldMandatory('header.header_text') && !headerText?.trim()) {
      toast.error('Header note is required (field configuration).')
      return
    }
    if (fieldMandatory('header.document_date') && !documentDate) {
      toast.error('Document date is required (field configuration).')
      return
    }
    if (fieldMandatory('header.entry_date') && !entryDate) {
      toast.error('Posting date is required (field configuration).')
      return
    }
    const payload = buildPayload()
    if (payload.lines.length < 2) {
      toast.error('At least 2 lines with an account and an amount are required.')
      return
    }
    if (mode === 'edit' && initialData?.id) {
      updateMut.mutate(
        { id: initialData.id, data: payload as any },
        {
          onSuccess: (data) => {
            toast.success('Journal entry saved.')
            setSavePreview(data as unknown as JournalEntry)
          },
          onError: (e: any) => toast.error(formatApiError(e)),
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
          onError: (e: any) => toast.error(formatApiError(e)),
        }
      )
    }
  }

  const isSaving = createMut.isPending || updateMut.isPending

  const matchedFY = useMemo(
    () => (fiscalYears as any[]).find((fy: any) => {
      const d = new Date(entryDate)
      return new Date(fy.start_date) <= d && new Date(fy.end_date) >= d
    }),
    [fiscalYears, entryDate],
  )

  useEffect(() => {
    if (fiscalYearId) return
    if (matchedFY) setFiscalYearId((matchedFY as any).id)
  }, [fiscalYearId, matchedFY])

  useEffect(() => {
    if (!fiscalYearId || !periods.length) return
    const d = new Date(entryDate)
    const p = (periods as any[]).find(
      (x) => new Date(x.start_date) <= d && new Date(x.end_date) >= d,
    )
    if (p) setPeriodId(p.id)
  }, [fiscalYearId, periods, entryDate])

  return (
    <>
    <div data-kiterp-modal className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-5xl bg-gray-50 h-full shadow-2xl flex flex-col overflow-hidden">

        {/* ── Drawer header bar ── */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">
                {mode === 'edit' ? `Edit Journal Entry ${initialData?.entry_no}` : 'New Journal Entry'}
              </h2>
              <p className="text-xs text-gray-500">General Ledger · Manual Posting</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {needsApproval && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Requires approval ≥ {fmt(jePolicy.threshold_amount ?? 0)}
              </div>
            )}
            <button type="button" aria-label="Close" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Main content ── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* ── Document Header card ── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowHeaderExpanded(x => !x)}
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-gray-800">Document Header</span>
                  <span className="text-xs text-gray-400">{docType} · {entryDate}</span>
                </div>
                {showHeaderExpanded
                  ? <ChevronDown className="w-4 h-4 text-gray-400" />
                  : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>

              {showHeaderExpanded && (
                <div className="px-5 pb-5 pt-1 border-t border-gray-100">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">

                    {/* Business unit */}
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        <Building2 className="inline w-3 h-3 mr-0.5" /> Business unit *
                      </label>
                      <select
                        value={companyId}
                        onChange={e => setCompanyId(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">— Select —</option>
                        {(companies as Company[]).map(c => (
                          <option key={c.id} value={c.id}>{c.code} · {c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Document Type */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Document Type</label>
                      <select
                        value={docType}
                        onChange={e => setDocType(e.target.value as DocType)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </div>

                    {/* Currency */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Currency</label>
                      <select
                        value={currency}
                        onChange={e => setCurrency(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="Default">Default ({defaultCompany?.currency || 'INR'})</option>
                        {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Posting Date */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Posting Date *
                      </label>
                      <input
                        type="date"
                        value={entryDate}
                        onChange={e => setEntryDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    {/* Document Date */}
                    {!fieldHidden('header.document_date') && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Document Date{fieldMandatory('header.document_date') ? ' *' : ''}
                      </label>
                      <input
                        type="date"
                        value={documentDate}
                        onChange={e => setDocumentDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    )}

                    {/* Fiscal year & period */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Fiscal Year</label>
                      <select
                        value={fiscalYearId}
                        onChange={e => { setFiscalYearId(e.target.value); setPeriodId('') }}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                      >
                        <option value="">— Select —</option>
                        {(fiscalYears as any[]).map((fy: any) => (
                          <option key={fy.id} value={fy.id}>{fy.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Accounting Period</label>
                      <select
                        value={periodId}
                        onChange={e => setPeriodId(e.target.value)}
                        disabled={!fiscalYearId}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        <option value="">— Select —</option>
                        {(periods as any[]).map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.period_number != null ? `${p.period_number} · ` : ''}{p.name}
                            {' '}({p.start_date} – {p.end_date})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Reference */}
                    {!fieldHidden('header.reference') && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Reference{fieldMandatory('header.reference') ? ' *' : ''}
                      </label>
                      <input
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                        placeholder="External ref / cheque no."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    )}

                    {/* Narration / Description */}
                    {!fieldHidden('header.narration') && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Narration / Description{fieldMandatory('header.narration') ? ' *' : ''}
                      </label>
                      <input
                        value={narration}
                        onChange={e => setNarration(e.target.value)}
                        placeholder="Header narration — describe the transaction"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    )}

                    {/* Header Text / Note */}
                    {!fieldHidden('header.header_text') && (
                    <div className="md:col-span-3">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                        Header Note (internal){fieldMandatory('header.header_text') ? ' *' : ''}
                      </label>
                      <textarea
                        value={headerText}
                        onChange={e => setHeaderText(e.target.value)}
                        rows={2}
                        placeholder="Internal notes for approvers / auditors…"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    )}

                    {/* Created by */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 col-span-full">
                      <User className="w-3.5 h-3.5" />
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
                      className="grid cursor-pointer items-center gap-2 px-4 py-2 hover:bg-muted/30"
                      style={{ gridTemplateColumns: '2fr 1.5fr 80px 80px 24px' }}
                    >
                      <AccountCombobox
                        value={ln.account_id}
                        companyId={companyId}
                        onChange={(id, acc) => setLine(ln._key, {
                          account_id: id,
                          _accCode: acc?.code,
                          _accName: acc?.name,
                          _accType: acc?.account_type,
                        })}
                      />
                      <input
                        value={ln.description || ''}
                        onChange={e => setLine(ln._key, { description: e.target.value })}
                        placeholder="Line description"
                        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="number"
                        min={0}
                        value={ln.debit || ''}
                        onChange={e => setLine(ln._key, { debit: Number(e.target.value), credit: 0 })}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-right text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="number"
                        min={0}
                        value={ln.credit || ''}
                        onChange={e => setLine(ln._key, { credit: Number(e.target.value), debit: 0 })}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-right text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        onClick={() => setExpandedLine(expandedLine === ln._key ? null : ln._key)}
                        className="p-1 text-muted-foreground transition-colors hover:text-primary"
                        title="More fields"
                      >
                        {expandedLine === ln._key
                          ? <ChevronDown className="w-3.5 h-3.5" />
                          : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Expanded extra fields */}
                    {expandedLine === ln._key && (
                      <div className="px-4 pb-3 pt-1 bg-primary/10/30 border-t border-primary/20/60 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                          {/* Cost Centre */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Cost Centre</label>
                            <select
                              value={ln.cost_center_id || ''}
                              onChange={e => setLine(ln._key, { cost_center_id: e.target.value })}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                            >
                              <option value="">— None —</option>
                              {(costCenters as CostCenter[]).map(cc => (
                                <option key={cc.id} value={cc.id}>{cc.code} · {cc.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Project */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Project</label>
                            <select
                              value={ln.project_id || ''}
                              onChange={e => setLine(ln._key, { project_id: e.target.value })}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                            >
                              <option value="">— None —</option>
                              {(projects as Project[]).map(p => (
                                <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Intercompany */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Intercompany</label>
                            <select
                              value={ln.intercompany_partner_id || ''}
                              onChange={e => setLine(ln._key, { intercompany_partner_id: e.target.value })}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                            >
                              <option value="">— None —</option>
                              {(icPartners as any[]).map((ip: any) => (
                                <option key={ip.id} value={ip.id}>IC · {ip.partner_company_id?.slice(0, 8)}</option>
                              ))}
                            </select>
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
                            <select
                              value={ln.party_type || ''}
                              onChange={e => setLine(ln._key, { party_type: (e.target.value as any) || undefined })}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                            >
                              <option value="">— None —</option>
                              <option value="customer">Customer</option>
                              <option value="supplier">Supplier</option>
                            </select>
                          </div>

                          {/* Ref Doc Type */}
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Ref Doc Type</label>
                            <select
                              value={ln.ref_doc_type || ''}
                              onChange={e => setLine(ln._key, { ref_doc_type: (e.target.value as RefDocType) || undefined, ref_doc_id: '', ref_doc_no: '' })}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                            >
                              <option value="">— None —</option>
                              {REF_DOC_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
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
                            <input
                              value={ln.tax_code || ''}
                              onChange={e => setLine(ln._key, { tax_code: e.target.value })}
                              placeholder="e.g. GST18"
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white"
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
                            <Trash2 className="w-3 h-3" /> Remove line
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
                <span className="text-xs font-medium">
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
            </div>
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="px-6 py-4 border-t bg-white flex items-center justify-between">
          <button onClick={onClose} className="btn-cancel px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600">Cancel</button>
          <div className="flex items-center gap-2">
            <button
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
        </div>
      </div>
    </div>

    {savePreview && (
      <div data-kiterp-modal className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={onSaved}>
        <div className="bg-card border border-border text-foreground rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-3">
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
          <div className="px-6 py-4 border-t border-border bg-muted/25 flex justify-end">
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
    </>
  )
}

// ─── JE Detail View ───────────────────────────────────────────────────────────
function JEDetail({
 jeId, onClose }: { jeId: string; onClose: () => void }) {
  const { data: je, isLoading } = useJournalEntry(jeId)

  if (isLoading) return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-card border border-border text-foreground rounded-xl p-8 text-muted-foreground text-sm">Loading…</div>
    </div>
  )
  if (!je) return null

  const jed = je as unknown as JournalEntry

  return (
    <div data-kiterp-modal className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-3xl bg-card border-l border-border text-foreground h-full shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Journal Entry — {jed.entry_no}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[jed.status])}>{jed.status}</span>
              <span className="text-xs text-gray-400">{jed.document_type} · {jed.entry_date}</span>
              {jed.company_name && <span className="text-xs text-gray-400">· {jed.company_name}</span>}
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Header summary */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            {[
              ['Posting Date', jed.entry_date],
              ['Document Date', jed.document_date || '—'],
              ['Reference', jed.reference || '—'],
              ['Narration', jed.narration || '—'],
              ['Currency', jed.currency],
              ['Requires Approval', jed.requires_approval ? 'Yes' : 'No'],
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
          {/* Lines */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['#', 'Account', 'Description', 'Debit', 'Credit', 'Cost Ctr', 'Project', 'Ref Doc'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(jed.lines || []).map((ln, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-gray-700">
                      {(ln as any).account_code || ''} {(ln as any).account_name || ln.account_id?.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate">{ln.description || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(ln.debit) > 0 ? fmt(ln.debit) : ''}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(ln.credit) > 0 ? fmt(ln.credit) : ''}</td>
                    <td className="px-3 py-2 text-gray-400 truncate">{(ln as any).cost_center_id?.slice(0, 8) || '—'}</td>
                    <td className="px-3 py-2 text-gray-400 truncate">{(ln as any).project_id?.slice(0, 8) || '—'}</td>
                    <td className="px-3 py-2 text-gray-400">{ln.ref_doc_type ? `${ln.ref_doc_type}: ${ln.ref_doc_no || ''}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-3 py-2 font-semibold text-xs text-right text-gray-600">Total</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmt(jed.total_debit)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-gray-800">{fmt(jed.total_credit)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function JournalEntries() {
  const [params] = useState<Record<string, unknown>>({ limit: 50, skip: 0 })
  const [filter, setFilter] = useState({ status: '', source_type: '' })
  const [showNew, setShowNew] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data, isLoading, refetch } = useJournalEntries({ ...params, ...filter })
  const postMut = usePostJournalEntry()
  const voidMut = useVoidJournalEntry()
  const approveReqMut = useApproveRequest()

  const entries = (data?.items || data || []) as JournalEntry[]
  const total = (data as any)?.total || entries.length

  const handleSaved = () => { setShowNew(false); setEditId(null); refetch() }

  const handlePost = (id: string) => {
    postMut.mutate(id, {
      onSuccess: () => toast.success('Posted'),
      onError: (e: any) => toast.error(e?.response?.data?.detail || 'Cannot post'),
    })
  }

  const handleVoid = (id: string) => {
    voidMut.mutate(id, {
      onSuccess: () => toast.success('Voided'),
      onError: () => toast.error('Cannot void'),
    })
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal Entries</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} entries</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 font-medium"
        >
          <Plus className="w-4 h-4" /> New Entry
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'draft', 'pending_approval', 'posted', 'void'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(f => ({ ...f, status: s }))}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm border transition-colors',
              filter.status === s
                ? 'bg-primary text-white border-primary'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            )}
          >
            {s === '' ? 'All' : s === 'pending_approval' ? 'Pending Approval' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">No journal entries found.</td></tr>
            ) : entries.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50 cursor-pointer" onClick={onClickableTableRow(() => setDetailId(e.id))}>
                <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">{e.entry_no}</td>
                <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[100px]">{e.company_name || '—'}</td>
                <td className="px-4 py-3 text-gray-700 text-xs">{e.entry_date}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{e.document_date || '—'}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{e.document_type || 'SA'}</span>
                </td>
                <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{e.narration || '—'}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{fmt(e.total_debit)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{fmt(e.total_credit)}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[e.status] || '')}>
                    {e.status === 'pending_approval' ? 'Pending Approval' : e.status}
                  </span>
                  {e.requires_approval && e.status === 'pending_approval' && (
                    <AlertTriangle className="inline w-3 h-3 ml-1 text-amber-500" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {e.status === 'draft' && (
                      <>
                        <button onClick={() => { setEditId(e.id); setShowNew(false) }} title="Edit"
                          className="p-1 text-gray-400 hover:text-primary"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handlePost(e.id)} title="Post"
                          className="p-1 text-green-600 hover:text-green-800"><CheckCircle className="w-4 h-4" /></button>
                      </>
                    )}
                    {e.status === 'posted' && (
                      <button onClick={() => handleVoid(e.id)} title="Void"
                        className="p-1 text-red-500 hover:text-red-700"><XCircle className="w-4 h-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      {detailId && (
        <JEDetail jeId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}

// Small wrapper to load the JE before opening the edit drawer
function EditJEWrapper({ jeId, onClose, onSaved }: { jeId: string; onClose: () => void; onSaved: () => void }) {
  const { data: je, isLoading } = useJournalEntry(jeId)
  if (isLoading) return null
  return (
    <JEDrawer
      mode="edit"
      initialData={je as unknown as JournalEntry}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}
