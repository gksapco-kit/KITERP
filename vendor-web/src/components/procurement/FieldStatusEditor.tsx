import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Search, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import {
  groupFields,
  STATUS_META,
  type DocType,
  type FieldStatus,
  type FieldGroup,
  type ProcurementFieldDef,
} from '@/lib/procurementFieldCatalog'

const STATUS_ORDER: FieldStatus[] = ['mandatory', 'optional', 'suppress']

// ── Status toggle pill buttons ────────────────────────────────────
export function StatusToggle({
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
export function GroupSection({
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

      {open && (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {items.map(field => {
            const status = getStatus(docType, field.key)
            const matchesSearch = !highlight || field.label.toLowerCase().includes(highlight.toLowerCase())
            if (!matchesSearch) return null
            const notImplemented = field.implemented === false
            return (
              <div
                key={field.key}
                className={cn(
                  'flex items-center justify-between px-4 py-2.5 transition-colors gap-4',
                  notImplemented
                    ? 'bg-gray-50/50 dark:bg-gray-900/30 opacity-70'
                    : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-sm font-medium', notImplemented ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-100')}>{field.label}</span>
                    {field.systemFixed && (
                      <span className="text-xs text-gray-400 italic">system-fixed</span>
                    )}
                    {notImplemented && (
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        Not on form yet
                      </span>
                    )}
                  </div>
                  {field.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{field.description}</p>
                  )}
                </div>
                <StatusToggle
                  value={status}
                  onChange={s => setStatus(docType, field.key, s)}
                  disabled={field.systemFixed || notImplemented}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Summary counts bar ────────────────────────────────────────────
export function SummaryBar({
  fields,
  docType,
  getStatus,
}: {
  fields: ProcurementFieldDef[]
  docType: DocType
  getStatus: (d: DocType, k: string) => FieldStatus
}) {
  const mandatory = fields.filter(f => getStatus(docType, f.key) === 'mandatory').length
  const optional = fields.filter(f => getStatus(docType, f.key) === 'optional').length
  const suppressed = fields.filter(f => getStatus(docType, f.key) === 'suppress').length

  return (
    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
      <span><span className="font-semibold text-rose-600 dark:text-rose-400">{mandatory}</span> mandatory</span>
      <span><span className="font-semibold text-blue-600 dark:text-blue-400">{optional}</span> optional</span>
      <span><span className="font-semibold text-gray-500">{suppressed}</span> suppressed</span>
      <span className="text-gray-300 dark:text-gray-600">|</span>
      <span>{fields.length} total fields</span>
    </div>
  )
}

// ── Full doc-type tab content (search + groups + reset) ───────────
export function DocTypeFieldList({
  docType,
  fields,
  getStatus,
  setStatus,
  resetDocType,
  overrideCount,
}: {
  docType: DocType
  fields: ProcurementFieldDef[]
  getStatus: (d: DocType, k: string) => FieldStatus
  setStatus: (d: DocType, k: string, s: FieldStatus) => void
  resetDocType: (d: DocType) => void
  overrideCount: (d: DocType) => number
}) {
  const [search, setSearch] = useState('')
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
          <SummaryBar fields={fields} docType={docType} getStatus={getStatus} />
          {overrides > 0 && (
            <button
              type="button"
              onClick={() => resetDocType(docType)}
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to defaults
            </button>
          )}
        </div>
      </div>

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
