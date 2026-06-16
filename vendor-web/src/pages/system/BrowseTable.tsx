import { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Database, Loader2 } from 'lucide-react'
import { vendorApi, type SchemaModelRecord } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/authStore'
import { useIsVendorAdmin } from '@/hooks/usePermissions'
import { useVendorStore } from '@/stores/vendorStore'
import { toast } from 'sonner'

function copyText(text: string, label: string) {
  void navigator.clipboard.writeText(text)
  toast.success(`Copied ${label}`)
}

function formatCell(val: unknown): string {
  if (val == null) return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

export default function BrowseTablePage() {
  const { isAuthenticated } = useAuthStore()
  const isVendorAdmin = useIsVendorAdmin()
  const vendor = useVendorStore((s) => s.vendor)
  const [searchParams, setSearchParams] = useSearchParams()

  const browseTable = searchParams.get('table') ?? ''
  const browseQ = searchParams.get('q') ?? ''
  const rawPage = Number(searchParams.get('page') ?? '1')
  const browsePage = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1

  const updateParams = (patch: { table?: string; q?: string; page?: number }) => {
    const next = new URLSearchParams(searchParams)
    if (patch.table !== undefined) {
      if (patch.table) next.set('table', patch.table)
      else next.delete('table')
    }
    if (patch.q !== undefined) {
      if (patch.q.trim()) next.set('q', patch.q.trim())
      else next.delete('q')
    }
    if (patch.page !== undefined) {
      if (patch.page > 1) next.set('page', String(patch.page))
      else next.delete('page')
    }
    setSearchParams(next, { replace: true })
  }

  const { data: catalog } = useQuery({
    queryKey: ['vendor-table-data-tables'],
    queryFn: () => vendorApi.listTableDataTables(),
    staleTime: 5 * 60_000,
    enabled: isAuthenticated && isVendorAdmin,
  })

  const {
    data: browseResult,
    isLoading: browseLoading,
    isError: browseError,
    error: browseErr,
  } = useQuery({
    queryKey: ['vendor-table-data-browse', browseTable, browseQ, browsePage],
    queryFn: () =>
      vendorApi.browseTableData(browseTable, {
        q: browseQ.trim() || undefined,
        page: browsePage,
        page_size: 50,
      }),
    enabled: isAuthenticated && isVendorAdmin && Boolean(browseTable),
    retry: false,
  })

  const tables = useMemo(() => catalog?.models ?? [], [catalog?.models])
  const tableFilter = searchParams.get('filter') ?? ''

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

  const browseErrorMsg = useMemo(() => {
    const detail = (browseErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    return typeof detail === 'string' ? detail : 'Could not load table rows.'
  }, [browseErr])

  const browseColumns = browseResult?.columns ?? []
  const totalPages = browseResult ? Math.max(1, Math.ceil(browseResult.total / browseResult.page_size)) : 1

  if (!isVendorAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="mx-auto min-w-0 w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Database className="h-7 w-7 text-primary" />
          Browse table
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Pick a database table and browse its rows for{' '}
          <span className="font-medium text-foreground">
            {vendor?.display_name || vendor?.business_name || 'your business'}
          </span>
          . Use search within a table to filter by UUID or text.
        </p>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            Select table
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label htmlFor="browse-table-filter" className="text-xs font-medium text-muted-foreground">
                Filter tables
              </label>
              <Input
                id="browse-table-filter"
                value={tableFilter}
                onChange={(e) => {
                  const next = new URLSearchParams(searchParams)
                  const v = e.target.value
                  if (v.trim()) next.set('filter', v)
                  else next.delete('filter')
                  setSearchParams(next, { replace: true })
                }}
                placeholder="Filter by name (leave empty for all)…"
                className="w-full"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <label htmlFor="browse-table-select" className="text-xs font-medium text-muted-foreground">
                Table
              </label>
              <select
                id="browse-table-select"
                value={browseTable}
                onChange={(e) => updateParams({ table: e.target.value, q: '', page: 1 })}
                className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 font-mono text-sm"
              >
                <option value="">Select a table…</option>
                {tableOptions.map((m) => (
                  <option key={m.table} value={m.table}>
                    {m.table} — {m.domain}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="min-w-0 space-y-2">
            <label htmlFor="browse-table-search" className="text-xs font-medium text-muted-foreground">
              Search within table
            </label>
            <Input
              id="browse-table-search"
              value={browseQ}
              onChange={(e) => updateParams({ q: e.target.value, page: 1 })}
              onKeyDown={(e) => e.key === 'Enter' && browseTable && updateParams({ q: browseQ, page: 1 })}
              placeholder="UUID or text…"
              className="w-full font-mono text-sm"
              disabled={!browseTable}
            />
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
                    onClick={() => updateParams({ page: browsePage - 1 })}
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
                    onClick={() => updateParams({ page: browsePage + 1 })}
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
                                className="text-left hover:text-primary"
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
