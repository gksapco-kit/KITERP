import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Copy, Database, Loader2, Search, Table2 } from 'lucide-react'
import {
  schemaApi,
  type SchemaModelRecord,
  type TableDataCellMatch,
  type TableDataFindHit,
  type TableDataRows,
} from '@/api/schema.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

function copyText(text: string, label: string) {
  void navigator.clipboard.writeText(text)
  toast.success(`Copied ${label}`)
}

function formatCell(val: unknown): string {
  if (val == null) return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function RowPreview({ row, columns }: { row: Record<string, unknown>; columns?: string[] }) {
  const keys = columns?.length
    ? columns.filter((k) => k in row).slice(0, 8)
    : Object.keys(row).slice(0, 8)
  return (
    <dl className="grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
      {keys.map((k) => (
        <div key={k} className="flex gap-2">
          <dt className="shrink-0 font-mono text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-all font-mono text-foreground">{formatCell(row[k])}</dd>
        </div>
      ))}
    </dl>
  )
}

function MatchesTable({
  matches,
  onBrowse,
}: {
  matches: TableDataCellMatch[]
  onBrowse: (table: string) => void
}) {
  if (matches.length === 0) return null
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[520px] text-left text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Table</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Column</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m, i) => (
            <tr key={`${m.table}-${m.column}-${i}`} className="border-t border-border/80 hover:bg-muted/20">
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => onBrowse(m.table)}
                  className="font-mono font-medium text-primary hover:underline"
                >
                  {m.table}
                </button>
                {m.domain ? (
                  <p className="text-[10px] text-muted-foreground">{m.domain}</p>
                ) : null}
              </td>
              <td className="px-3 py-2 font-mono text-foreground">{m.column}</td>
              <td className="max-w-[320px] px-3 py-2">
                <button
                  type="button"
                  className="block w-full truncate text-left font-mono text-[11px] hover:text-primary"
                  title={m.value}
                  onClick={() => copyText(m.value, m.column)}
                >
                  {m.value}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FindHitCard({
  hit,
  onBrowse,
}: {
  hit: TableDataFindHit
  onBrowse: (table: string) => void
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <button
            type="button"
            onClick={() => onBrowse(hit.table)}
            className="font-mono text-sm font-semibold text-primary hover:underline"
          >
            {hit.table}
          </button>
          <p className="text-xs text-muted-foreground">{hit.domain}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800">
            {hit.row_count} row{hit.row_count === 1 ? '' : 's'}
          </span>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => onBrowse(hit.table)}>
            Browse table
          </Button>
        </div>
      </div>
      <CardContent className="space-y-3 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Matched columns:{' '}
          <span className="font-mono text-foreground">{hit.matched_columns.join(', ')}</span>
        </p>
        {hit.rows.map((row, i) => (
          <div key={i} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <RowPreview row={row} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function TableDataPage() {
  const { user, isAuthenticated } = useAuthStore()
  const [idSearch, setIdSearch] = useState('')
  const [submittedId, setSubmittedId] = useState('')
  const [tableFilter, setTableFilter] = useState('')
  const [browseTable, setBrowseTable] = useState('')
  const [browseQ, setBrowseQ] = useState('')
  const [browsePage, setBrowsePage] = useState(1)

  const { data: catalog } = useQuery({
    queryKey: ['admin-schema-models'],
    queryFn: () => schemaApi.listModels(),
    staleTime: 5 * 60_000,
  })

  const {
    data: findResult,
    isLoading: findLoading,
    isError: findError,
    error: findErr,
  } = useQuery({
    queryKey: ['admin-table-data-find', submittedId],
    queryFn: () => schemaApi.findTableDataValue(submittedId),
    enabled: isAuthenticated && isSuperuserAdmin(user) && submittedId.length >= 2,
    retry: false,
  })

  const {
    data: browseResult,
    isLoading: browseLoading,
    isError: browseError,
    error: browseErr,
  } = useQuery({
    queryKey: ['admin-table-data-browse', browseTable, browseQ, browsePage],
    queryFn: () =>
      schemaApi.browseTableData(browseTable, {
        q: browseQ.trim() || undefined,
        page: browsePage,
        page_size: 50,
      }),
    enabled: isAuthenticated && isSuperuserAdmin(user) && Boolean(browseTable),
    retry: false,
  })

  const tables = useMemo(() => catalog?.models ?? [], [catalog?.models])

  const tableOptions = useMemo(() => {
    const q = tableFilter.trim().toLowerCase()
    const filtered = tables.filter((m: SchemaModelRecord) => {
      if (!q || q === 'all') return true
      return (
        m.table.includes(q) ||
        m.domain.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q)
      )
    })
    return [...filtered].sort((a, b) => a.table.localeCompare(b.table))
  }, [tables, tableFilter])

  const findErrorMsg = useMemo(() => {
    const detail = (findErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    return typeof detail === 'string' ? detail : 'Could not search tables.'
  }, [findErr])

  const browseErrorMsg = useMemo(() => {
    const detail = (browseErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    return typeof detail === 'string' ? detail : 'Could not load table rows.'
  }, [browseErr])

  const runIdSearch = () => {
    const v = idSearch.trim()
    if (v.length < 2) {
      toast.error('Enter at least 2 characters (e.g. a UUID)')
      return
    }
    setSubmittedId(v)
    setBrowseTable('')
  }

  const openBrowse = (table: string, filterQ?: string) => {
    setBrowseTable(table)
    setBrowseQ(filterQ ?? '')
    setBrowsePage(1)
  }

  const cellMatches = useMemo(() => {
    if (!findResult) return []
    if (findResult.matches?.length) return findResult.matches
    return findResult.hits.flatMap((h) => h.cell_matches ?? [])
  }, [findResult])

  const browseColumns = browseResult?.columns ?? []
  const totalPages = browseResult ? Math.max(1, Math.ceil(browseResult.total / browseResult.page_size)) : 1

  if (!isSuperuserAdmin(user)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Table2 className="h-7 w-7 text-primary" />
          Table Data
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Search the database for any value and see which table and column it belongs to. Or pick a table
          to view its records.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Find by ID or text</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={idSearch}
              onChange={(e) => setIdSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runIdSearch()}
              placeholder="UUID, email, name, or any text…"
              className="pl-9 font-mono text-sm"
            />
          </div>
          <Button type="button" onClick={runIdSearch} disabled={findLoading}>
            {findLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Find in all tables
          </Button>
        </CardContent>
      </Card>

      {submittedId ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {findLoading ? (
              'Scanning tables…'
            ) : findResult ? (
              <>
                Search <span className="font-mono text-foreground">{findResult.query}</span> (
                {findResult.search_mode}) — {findResult.match_count ?? findResult.hit_count} match
                {(findResult.match_count ?? findResult.hit_count) === 1 ? '' : 'es'} in{' '}
                {findResult.hit_count} table
                {findResult.hit_count === 1 ? '' : 's'}, {findResult.tables_scanned} scanned
              </>
            ) : null}
          </p>

          {findError ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">{findErrorMsg}</CardContent>
            </Card>
          ) : null}

          {!findLoading && !findError && findResult?.hit_count === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No rows found for this value. Try browsing a specific table below.
              </CardContent>
            </Card>
          ) : null}

          {!findLoading && !findError && cellMatches.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Matches — table, column, and value</CardTitle>
              </CardHeader>
              <CardContent>
                <MatchesTable
                  matches={cellMatches}
                  onBrowse={(table) => openBrowse(table, submittedId)}
                />
              </CardContent>
            </Card>
          ) : null}

          {findResult?.hits.map((hit) => (
            <FindHitCard key={hit.table} hit={hit} onBrowse={(table) => openBrowse(table, submittedId)} />
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            Browse table
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="flex flex-1 flex-col gap-2 sm:flex-row">
              <Input
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                placeholder="Filter by name (leave empty for all)…"
                className="sm:max-w-xs"
              />
              <select
                value={browseTable}
                onChange={(e) => {
                  setBrowseTable(e.target.value)
                  setBrowseQ('')
                  setBrowsePage(1)
                }}
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm"
              >
                <option value="">Select a table…</option>
                {tableOptions.map((m) => (
                  <option key={m.table} value={m.table}>
                    {m.table} — {m.domain}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 gap-2">
              <Input
                value={browseQ}
                onChange={(e) => {
                  setBrowseQ(e.target.value)
                  setBrowsePage(1)
                }}
                onKeyDown={(e) => e.key === 'Enter' && browseTable && setBrowsePage(1)}
                placeholder="Search within table (UUID or text)…"
                className="font-mono text-sm"
                disabled={!browseTable}
              />
            </div>
          </div>
          {tables.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {tableOptions.length} of {tables.length} tables
              {tableFilter.trim() && tableFilter.trim().toLowerCase() !== 'all'
                ? ` matching "${tableFilter.trim()}"`
                : ''}
            </p>
          ) : null}

          {browseTable && browseLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading {browseTable}…
            </div>
          ) : null}

          {browseError ? (
            <p className="text-sm text-muted-foreground">{browseErrorMsg}</p>
          ) : null}

          {browseTable && !browseLoading && !browseError && !browseResult ? (
            <p className="text-sm text-muted-foreground">No data returned for {browseTable}.</p>
          ) : null}

          {browseResult && !browseLoading ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  <span className="font-mono font-medium text-foreground">{browseResult.table}</span>
                  {' · '}
                  {browseResult.total} row{browseResult.total === 1 ? '' : 's'}
                  {browseQ.trim() ? ` matching "${browseQ.trim()}"` : ''}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={browsePage <= 1}
                    onClick={() => setBrowsePage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2">
                    Page {browsePage} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={browsePage >= totalPages}
                    onClick={() => setBrowsePage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[600px] text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      {browseColumns.map((col) => (
                        <th key={col} className="whitespace-nowrap px-3 py-2 font-medium">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {browseResult.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={Math.max(1, browseColumns.length)}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          No rows{browseQ.trim() ? ` matching "${browseQ.trim()}"` : ''}
                        </td>
                      </tr>
                    ) : (
                      browseResult.rows.map((row, ri) => (
                        <tr key={ri} className="border-t border-border/80 hover:bg-muted/20">
                          {browseColumns.map((col) => (
                            <td
                              key={col}
                              className="max-w-[200px] truncate px-3 py-2 font-mono text-[11px] text-foreground"
                              title={formatCell(row[col])}
                            >
                              <button
                                type="button"
                                className={cn(
                                  'text-left hover:text-primary',
                                  String(row[col]) === submittedId && 'font-semibold text-primary',
                                )}
                                onClick={() => {
                                  const v = formatCell(row[col])
                                  if (v !== '—') copyText(v, col)
                                }}
                              >
                                {formatCell(row[col])}
                              </button>
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
