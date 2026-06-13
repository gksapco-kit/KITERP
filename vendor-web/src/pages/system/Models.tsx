import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Search,
  Wrench,
} from 'lucide-react'
import {
  vendorApi,
  type SchemaApiBinding,
  type SchemaColumnRecord,
  type SchemaModelRecord,
} from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { lookupColumnBusinessLogic } from '@/lib/fieldDbRegistry'
import FieldMappingModal, { mappingRecordToForm } from '@/pages/system/FieldMappingModal'
import { useIsVendorAdmin } from '@/hooks/usePermissions'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type ColumnFilter = 'all' | 'no_ui' | 'no_api' | 'needs_wiring'

function copyText(text: string, label: string) {
  void navigator.clipboard.writeText(text)
  toast.success(`Copied ${label}`)
}

function methodBadgeClass(method: string) {
  switch (method) {
    case 'GET':
      return 'bg-emerald-100 text-emerald-800'
    case 'POST':
      return 'bg-blue-100 text-blue-800'
    case 'PUT':
    case 'PATCH':
      return 'bg-amber-100 text-amber-800'
    case 'DELETE':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function columnHasUi(table: string, col: SchemaColumnRecord): boolean {
  if (col.user_mapping) return true
  const logic = lookupColumnBusinessLogic(table, col.name)
  return Boolean(logic?.ui_labels.length || logic?.screens?.length)
}

function columnMatchesFilter(
  table: string,
  col: SchemaColumnRecord,
  filter: ColumnFilter,
): boolean {
  if (filter === 'all') return true
  const hasUi = columnHasUi(table, col)
  const hasApi = Boolean(col.api_bindings?.length)
  if (filter === 'no_ui') return !hasUi
  if (filter === 'no_api') return !hasApi
  if (filter === 'needs_wiring') return !hasUi && !hasApi && !col.primary_key
  return true
}

function ApiBindingList({ bindings }: { bindings: SchemaApiBinding[] }) {
  if (!bindings.length) {
    return <p className="font-sans text-[10px] text-gray-500">No vendor API binding detected for this column.</p>
  }
  return (
    <ul className="mt-1.5 space-y-1.5">
      {bindings.map((b) => (
        <li
          key={`${b.method}-${b.path}-${b.schema}`}
          className="rounded border border-gray-100 bg-white px-2 py-1.5 font-sans text-[10px]"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded px-1.5 py-0.5 font-semibold', methodBadgeClass(b.method))}>
              {b.method}
            </span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 font-medium',
                b.direction === 'write' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800',
              )}
            >
              {b.direction}
            </span>
            <span className="font-mono text-gray-600">{b.schema}</span>
          </div>
          <p className="mt-1 break-all font-mono text-[10px] text-gray-700">{b.path}</p>
          <button
            type="button"
            onClick={() => copyText(b.path, 'API path')}
            className="mt-1 text-primary hover:underline"
          >
            Copy path
          </button>
        </li>
      ))}
    </ul>
  )
}

function ColumnDetailPanel({
  table,
  column,
  onClose,
}: {
  table: string
  column: SchemaColumnRecord
  onClose: () => void
}) {
  const businessLogic = lookupColumnBusinessLogic(table, column.name)
  const bindings = column.api_bindings ?? []

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900">Database, API & business logic</p>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-800"
          aria-label="Close details"
        >
          ×
        </button>
      </div>
      <dl className="mt-2 space-y-1.5 font-mono text-[11px]">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-gray-500">Table</dt>
          <dd>{table}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-gray-500">Column</dt>
          <dd>{column.name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-gray-500">Type</dt>
          <dd className="break-all">{column.type}</dd>
        </div>
        {column.foreign_keys.length > 0 ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-gray-500">FK</dt>
            <dd className="break-all">{column.foreign_keys.join(', ')}</dd>
          </div>
        ) : null}
        {businessLogic?.note ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-gray-500">Note</dt>
            <dd className="font-sans text-gray-600">{businessLogic.note}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-3 border-t border-gray-200 pt-2">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          API bindings
        </p>
        <ApiBindingList bindings={bindings} />
      </div>

      {businessLogic && businessLogic.ui_labels.length > 0 ? (
        <div className="mt-3 border-t border-gray-200 pt-2">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            UI labels (field help)
          </p>
          <ul className="mt-1.5 space-y-1 font-sans text-[11px] text-gray-700">
            {businessLogic.ui_labels.map((label) => (
              <li key={label} className="rounded border border-gray-100 bg-white px-2 py-1">
                {label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {businessLogic?.screens?.length ? (
        <div className="mt-3 border-t border-gray-200 pt-2">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Screens
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {businessLogic.screens.map((screen) => (
              <li
                key={screen}
                className="rounded-full border border-gray-200 bg-white px-2 py-0.5 font-sans text-[10px] text-gray-700"
              >
                {screen}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!businessLogic?.ui_labels.length && !businessLogic?.screens?.length ? (
        <p className="mt-3 border-t border-gray-200 pt-2 font-sans text-[10px] text-gray-500">
          No mapped UI label yet — add an entry in fieldDbRegistry when you wire business logic to
          this column.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[10px]"
          onClick={() => copyText(`${table}.${column.name}`, 'table.column')}
        >
          <Copy className="mr-1 h-3 w-3" />
          table.column
        </Button>
        {bindings[0] ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px]"
            onClick={() =>
              copyText(
                `curl -X ${bindings[0].method} "${window.location.origin}${bindings[0].path}"`,
                'curl sample',
              )
            }
          >
            <ExternalLink className="mr-1 h-3 w-3" />
            Copy curl
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function ModelCard({
  model,
  columnFilter,
  onOpenMapping,
  canManageMappings,
}: {
  model: SchemaModelRecord
  columnFilter: ColumnFilter
  onOpenMapping: (
    mode: 'create' | 'edit',
    col: SchemaColumnRecord,
    table: string,
  ) => void
  canManageMappings: boolean
}) {
  const [open, setOpen] = useState(false)
  const [detailCol, setDetailCol] = useState<string | null>(null)

  const visibleColumns = useMemo(
    () => model.columns.filter((c) => columnMatchesFilter(model.table, c, columnFilter)),
    [model.columns, model.table, columnFilter],
  )

  const activeColumn = visibleColumns.find((c) => c.name === detailCol)

  if (columnFilter !== 'all' && visibleColumns.length === 0) return null

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{model.table}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {model.domain}
            </span>
            {model.api_exposed_columns != null && model.api_exposed_columns > 0 ? (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                {model.api_exposed_columns} API cols
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Model <span className="font-mono">{model.model}</span>
            {' · '}
            {columnFilter === 'all' ? model.column_count : visibleColumns.length} columns
            {columnFilter !== 'all' ? ` (filtered)` : ''}
            {' · '}
            module {model.module || '—'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            copyText(model.table, 'table name')
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </button>

      {open ? (
        <CardContent className="border-t border-border px-4 pb-4 pt-3">
          {activeColumn ? (
            <div className="mb-3">
              <ColumnDetailPanel
                table={model.table}
                column={activeColumn}
                onClose={() => setDetailCol(null)}
              />
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Column</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Nullable</th>
                  <th className="px-3 py-2 font-medium">Keys</th>
                  <th className="min-w-[120px] px-3 py-2 font-medium">API</th>
                  <th className="min-w-[120px] px-3 py-2 font-medium">Business logic</th>
                  <th className="w-24 px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleColumns.map((col) => {
                  const logic = lookupColumnBusinessLogic(model.table, col.name)
                  const apis = col.api_bindings ?? []
                  return (
                    <tr key={col.name} className="border-t border-border/80 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono font-medium text-foreground">{col.name}</td>
                      <td className="break-all px-3 py-2 text-muted-foreground">{col.type}</td>
                      <td className="px-3 py-2">{col.nullable ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2 text-[10px] text-muted-foreground">
                        {col.primary_key ? (
                          <span className="font-medium text-amber-700">PK </span>
                        ) : null}
                        {col.unique ? <span className="font-medium text-blue-700">UQ </span> : null}
                        {col.foreign_keys.length > 0 ? (
                          <span className="block font-mono">FK → {col.foreign_keys.join(', ')}</span>
                        ) : (
                          !col.primary_key && !col.unique ? '—' : null
                        )}
                      </td>
                      <td className="px-3 py-2 font-sans text-[10px]">
                        {apis.length ? (
                          <span title={apis.map((a) => `${a.method} ${a.path}`).join('\n')}>
                            <span className="font-medium text-emerald-700">
                              {apis.length} endpoint{apis.length === 1 ? '' : 's'}
                            </span>
                            <span className="mt-0.5 block text-gray-500">
                              {apis
                                .slice(0, 2)
                                .map((a) => `${a.method} ${a.direction}`)
                                .join(' · ')}
                            </span>
                          </span>
                        ) : (
                          <span className="text-amber-600">Not exposed</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-sans text-[10px] text-muted-foreground">
                        {columnHasUi(model.table, col) ? (
                          <span
                            title={[
                              col.user_mapping?.ui_label,
                              ...(logic?.ui_labels ?? []),
                              ...(logic?.screens ?? []),
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          >
                            {col.user_mapping ? (
                              <span className="font-medium text-violet-700">User mapped</span>
                            ) : null}
                            {logic?.ui_labels.length ? (
                              <span className={col.user_mapping ? 'mt-0.5 block' : ''}>
                                {logic.ui_labels.length} label{logic.ui_labels.length === 1 ? '' : 's'}
                              </span>
                            ) : null}
                            {logic?.screens?.length ? (
                              <span className="mt-0.5 block text-gray-500 line-clamp-1">
                                {logic.screens.join(', ')}
                              </span>
                            ) : null}
                            {logic?.note ? (
                              <span className="mt-0.5 block text-gray-500 line-clamp-2">{logic.note}</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {canManageMappings ? (
                            <button
                              type="button"
                              title={col.user_mapping ? 'Edit mapping' : 'Add mapping'}
                              onClick={() =>
                                onOpenMapping(col.user_mapping ? 'edit' : 'create', col, model.table)
                              }
                              className="rounded p-1 text-violet-600 hover:bg-violet-50 hover:text-violet-800"
                            >
                              {col.user_mapping ? (
                                <Pencil className="h-3.5 w-3.5" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            title="Full details"
                            onClick={() => setDetailCol((c) => (c === col.name ? null : col.name))}
                            className={cn(
                              'rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground',
                              detailCol === col.name && 'bg-muted text-foreground',
                            )}
                          >
                            <Wrench className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Copy column name"
                            onClick={() => copyText(col.name, 'column name')}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          {apis[0] ? (
                            <button
                              type="button"
                              title="Copy API path"
                              onClick={() => copyText(apis[0].path, 'API path')}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}

export default function ModelsPage() {
  const canManageMappings = useIsVendorAdmin()
  const [search, setSearch] = useState('')
  const [domain, setDomain] = useState('all')
  const [columnFilter, setColumnFilter] = useState<ColumnFilter>('all')
  const [mappingModal, setMappingModal] = useState<{
    open: boolean
    mode: 'create' | 'edit'
    initial?: Partial<{
      id: string
      table_name: string
      column_name: string
      ui_label: string
      help_short: string
      help_full: string
      screens: string
      note: string
    }>
  }>({ open: false, mode: 'create' })

  const openMappingEditor = (
    mode: 'create' | 'edit',
    col: SchemaColumnRecord,
    table: string,
  ) => {
    if (mode === 'edit' && col.user_mapping) {
      setMappingModal({
        open: true,
        mode: 'edit',
        initial: mappingRecordToForm(col.user_mapping),
      })
      return
    }
    const pretty = col.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    setMappingModal({
      open: true,
      mode: 'create',
      initial: {
        table_name: table,
        column_name: col.name,
        ui_label: pretty,
        help_short: '',
        help_full: '',
        screens: '',
        note: '',
      },
    })
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['schema-models'],
    queryFn: () => vendorApi.listSchemaModels(),
    staleTime: 5 * 60_000,
  })

  const errorMessage = useMemo(() => {
    if (!error) return 'Could not load models.'
    const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    if (typeof detail === 'string') return detail
    return 'Could not load models. Check that the backend is running and migrations are up to date.'
  }, [error])

  const domains = useMemo(() => {
    const set = new Set((data?.models ?? []).map((m) => m.domain))
    return ['all', ...Array.from(set).sort()]
  }, [data?.models])

  const wiringStats = useMemo(() => {
    let noUi = 0
    let noApi = 0
    let needsWiring = 0
    for (const m of data?.models ?? []) {
      for (const c of m.columns) {
        const hasUi = columnHasUi(m.table, c)
        const hasApi = Boolean(c.api_bindings?.length)
        if (!hasUi) noUi++
        if (!hasApi) noApi++
        if (!hasUi && !hasApi && !c.primary_key) needsWiring++
      }
    }
    return { noUi, noApi, needsWiring }
  }, [data?.models])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.models ?? []).filter((m) => {
      if (domain !== 'all' && m.domain !== domain) return false
      if (!q) return true
      if (m.table.includes(q) || m.model.toLowerCase().includes(q) || m.domain.toLowerCase().includes(q)) {
        return true
      }
      return m.columns.some(
        (c) =>
          c.name.includes(q) ||
          c.type.toLowerCase().includes(q) ||
          (c.api_bindings ?? []).some((a) => a.path.includes(q) || a.schema.toLowerCase().includes(q)),
      )
    })
  }, [data?.models, domain, search])

  const exportJson = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      models: filtered.map((m) => ({
        ...m,
        columns: m.columns.filter((c) => columnMatchesFilter(m.table, c, columnFilter)),
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kiterp-models-catalog.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported catalog JSON')
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Database className="h-7 w-7 text-primary" />
            Models
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Browse tables and columns, bind vendor APIs, and add UI field mappings with the + button — no
            code edits required for labels and help. Add the matching Label on your form to activate
            hover, F1, and wrench details.
          </p>
        </div>
        {data ? (
          <div className="flex shrink-0 flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border bg-muted/40 px-3 py-1">
              {data.model_count} models
            </span>
            <span className="rounded-full border border-border bg-muted/40 px-3 py-1">
              {data.column_count} columns
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
              {data.api_bound_columns ?? 0} API-bound
            </span>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-violet-800">
              {data.user_mapped_columns ?? 0} user mapped
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
              {wiringStats.needsWiring} need wiring
            </span>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Search & filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search table, model, column, API path, or type…"
                className="pl-9"
              />
            </div>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-52"
            >
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d === 'all' ? 'All business domains' : d}
                </option>
              ))}
            </select>
            <select
              value={columnFilter}
              onChange={(e) => setColumnFilter(e.target.value as ColumnFilter)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-52"
            >
              <option value="all">All columns</option>
              <option value="needs_wiring">Needs wiring (no UI + no API)</option>
              <option value="no_ui">No UI label mapping</option>
              <option value="no_api">Not exposed in API</option>
            </select>
            <Button type="button" variant="outline" className="shrink-0" onClick={exportJson}>
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
          </div>
          {columnFilter !== 'all' ? (
            <p className="text-xs text-muted-foreground">
              Column filter active — tables with no matching columns are hidden. Use &quot;Needs wiring&quot;
              to find new columns that still need UI labels and API schemas.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading schema catalog…
        </div>
      ) : null}

      {isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            {!canManageMappings ? (
              <p className="text-xs text-muted-foreground">
                Viewing models is available to all staff. Only owner or admin can add field mappings (+).
              </p>
            ) : null}
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !isError ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Showing {filtered.length} of {data?.model_count ?? 0} tables
          </p>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No models match your search.</p>
          ) : (
            filtered.map((model) => (
              <ModelCard
                key={`${model.table}-${model.model}`}
                model={model}
                columnFilter={columnFilter}
                onOpenMapping={openMappingEditor}
                canManageMappings={canManageMappings}
              />
            ))
          )}
        </div>
      ) : null}

      <FieldMappingModal
        open={mappingModal.open}
        mode={mappingModal.mode}
        initial={mappingModal.initial}
        onClose={() => setMappingModal((m) => ({ ...m, open: false }))}
      />
    </div>
  )
}
