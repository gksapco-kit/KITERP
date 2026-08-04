import { useState, useMemo } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  SlidersHorizontal,
  Search,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import {
  groupFields,
  getFieldsForDocType,
  STATUS_META,
  type DocType,
  type FieldStatus,
  type FieldGroup,
  type ProcurementFieldDef,
} from '@/lib/procurementFieldCatalog'
import { useProcurementFieldConfig } from '@/hooks/useProcurementFieldConfig'

const STATUS_ORDER: FieldStatus[] = ['mandatory', 'optional', 'suppress']

// ── Status badge (read-only display) ─────────────────────────────
function StatusBadge({ status }: { status: FieldStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', meta.bgClass, meta.textClass)}>
      {meta.label}
    </span>
  )
}

// ── Inline status toggle buttons ──────────────────────────────────
function StatusToggle({
  value,
  onChange,
  disabled,
}: {
  value: FieldStatus
  onChange: (s: FieldStatus) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {STATUS_ORDER.map(s => {
        const meta = STATUS_META[s]
        const active = value === s
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onChange(s)}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full font-medium border transition-all select-none',
              active
                ? cn('ring-2', meta.ringClass, meta.bgClass, meta.textClass, 'border-transparent')
                : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 hover:text-gray-600 dark:hover:text-gray-300',
              disabled && 'opacity-40 cursor-not-allowed',
            )}
          >
            {meta.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Collapsible group section ─────────────────────────────────────
function GroupSection({
  group,
  items,
  docType,
  getStatus,
  setStatus,
  highlight,
}: {
  group: FieldGroup
  items: ProcurementFieldDef[]
  docType: DocType
  getStatus: (d: DocType, k: string) => FieldStatus
  setStatus: (d: DocType, k: string, s: FieldStatus) => void
  highlight?: string
}) {
  const [open, setOpen] = useState(true)

  const mandatoryCount = items.filter(f => getStatus(docType, f.key) === 'mandatory').length
  const suppressCount = items.filter(f => getStatus(docType, f.key) === 'suppress').length

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Group header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{group}</span>
          <span className="text-xs text-gray-400">({items.length} fields)</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {mandatoryCount > 0 && (
            <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded-full font-medium">
              {mandatoryCount} mandatory
            </span>
          )}
          {suppressCount > 0 && (
            <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
              {suppressCount} suppressed
            </span>
          )}
        </div>
      </button>

      {/* Field rows */}
      {open && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {items.map(field => {
            const status = getStatus(docType, field.key)
            const matchesSearch = !highlight || field.label.toLowerCase().includes(highlight.toLowerCase())
            if (!matchesSearch) return null
            return (
              <div
                key={field.key}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {field.label}
                    </span>
                    {field.systemFixed && (
                      <span className="text-xs text-gray-400 italic">system-fixed</span>
                    )}
                  </div>
                  {field.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{field.description}</p>
                  )}
                </div>
                <StatusToggle
                  value={status}
                  onChange={s => setStatus(docType, field.key, s)}
                  disabled={field.systemFixed}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Summary bar ───────────────────────────────────────────────────
function SummaryBar({ docType, getStatus }: { docType: DocType; getStatus: (d: DocType, k: string) => FieldStatus }) {
  const fields = getFieldsForDocType(docType)
  const mandatory = fields.filter(f => getStatus(docType, f.key) === 'mandatory').length
  const optional = fields.filter(f => getStatus(docType, f.key) === 'optional').length
  const suppressed = fields.filter(f => getStatus(docType, f.key) === 'suppress').length

  return (
    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
      <span>
        <span className="font-semibold text-rose-600 dark:text-rose-400">{mandatory}</span> mandatory
      </span>
      <span>
        <span className="font-semibold text-blue-600 dark:text-blue-400">{optional}</span> optional
      </span>
      <span>
        <span className="font-semibold text-gray-500">{suppressed}</span> suppressed
      </span>
      <span className="text-gray-300 dark:text-gray-600">|</span>
      <span>{fields.length} total fields</span>
    </div>
  )
}

// ── Doc-type tab content ──────────────────────────────────────────
function DocTypeTab({
  docType,
  getStatus,
  setStatus,
  resetDocType,
  overrideCount,
}: {
  docType: DocType
  getStatus: (d: DocType, k: string) => FieldStatus
  setStatus: (d: DocType, k: string, s: FieldStatus) => void
  resetDocType: (d: DocType) => void
  overrideCount: (d: DocType) => number
}) {
  const [search, setSearch] = useState('')

  const fields = getFieldsForDocType(docType)
  const groups = useMemo(() => groupFields(fields), [fields])

  const filteredGroups = useMemo(() => {
    if (!search) return groups
    const q = search.toLowerCase()
    return groups
      .map(g => ({ ...g, items: g.items.filter(f => f.label.toLowerCase().includes(q) || f.group.toLowerCase().includes(q)) }))
      .filter(g => g.items.length > 0)
  }, [groups, search])

  const overrides = overrideCount(docType)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search field…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <SummaryBar docType={docType} getStatus={getStatus} />
          {overrides > 0 && (
            <button
              type="button"
              onClick={() => resetDocType(docType)}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset {docType} to defaults
            </button>
          )}
        </div>
      </div>

      {/* Field groups */}
      {filteredGroups.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No fields match "{search}"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(({ group, items }) => (
            <GroupSection
              key={group}
              group={group}
              items={items}
              docType={docType}
              getStatus={getStatus}
              setStatus={setStatus}
              highlight={search}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function ProcurementFieldConfigPage() {
  const [tab, setTab] = useState<DocType>('PR')
  const { getStatus, setStatus, save, resetDocType, resetAll, dirty, saved, overrideCount } =
    useProcurementFieldConfig()

  return (
    <div className="space-y-6 pb-24">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-primary" />
            Procurement Field Configuration
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Control which fields are <strong>mandatory</strong>, <strong>optional</strong>, or{' '}
            <strong>suppressed</strong> on Purchase Requisitions and Purchase Orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(overrideCount('PR') > 0 || overrideCount('PO') > 0) && (
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg hover:border-red-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset all
            </button>
          )}
          <Button onClick={save} disabled={!dirty} className="gap-2">
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong>How field status works:</strong>{' '}
          <span className="text-rose-600 dark:text-rose-400 font-medium">Mandatory</span> — the field is required and enforced on save.{' '}
          <span className="text-blue-600 dark:text-blue-400 font-medium">Optional</span> — the field is shown but not required.{' '}
          <span className="text-gray-500 font-medium">Suppress</span> — the field is hidden from the form entirely.
          Changes apply to all users in your organisation.
        </div>
      </div>

      {/* Unsaved changes warning */}
      {dirty && (
        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You have unsaved changes. Click <strong>Save changes</strong> to apply them.
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as DocType)}>
        <TabsList className="mb-4">
          <TabsTrigger value="PR" className="gap-2">
            Purchase Requisition (PR)
            {overrideCount('PR') > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-primary/10 text-primary font-semibold">
                {overrideCount('PR')}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="PO" className="gap-2">
            Purchase Order (PO)
            {overrideCount('PO') > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-primary/10 text-primary font-semibold">
                {overrideCount('PO')}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="PR">
          <DocTypeTab
            docType="PR"
            getStatus={getStatus}
            setStatus={setStatus}
            resetDocType={resetDocType}
            overrideCount={overrideCount}
          />
        </TabsContent>

        <TabsContent value="PO">
          <DocTypeTab
            docType="PO"
            getStatus={getStatus}
            setStatus={setStatus}
            resetDocType={resetDocType}
            overrideCount={overrideCount}
          />
        </TabsContent>
      </Tabs>

      {/* Floating save bar */}
      {dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 dark:bg-gray-800 text-white px-5 py-3 rounded-2xl shadow-2xl ring-1 ring-white/10">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm">Unsaved changes</span>
          <Button
            size="sm"
            onClick={save}
            className="bg-white text-gray-900 hover:bg-gray-100 font-semibold gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
        </div>
      )}
    </div>
  )
}
