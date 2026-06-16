import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Copy, Loader2, Search, Table2 } from 'lucide-react'
import {
  vendorApi,
  type TableDataCellMatch,
  type TableDataFindHit,
} from '@/api/vendor'
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
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const isVendorAdmin = useIsVendorAdmin()
  const vendor = useVendorStore((s) => s.vendor)
  const [idSearch, setIdSearch] = useState('')
  const [submittedId, setSubmittedId] = useState('')

  const openBrowse = (table: string, filterQ?: string) => {
    const params = new URLSearchParams({ table })
    if (filterQ?.trim()) params.set('q', filterQ.trim())
    navigate(`/system/browse-table?${params.toString()}`)
  }

  const {
    data: findResult,
    isLoading: findLoading,
    isError: findError,
    error: findErr,
  } = useQuery({
    queryKey: ['vendor-table-data-find', submittedId],
    queryFn: () => vendorApi.findTableDataValue(submittedId),
    enabled: isAuthenticated && isVendorAdmin && submittedId.length >= 2,
    retry: false,
  })

  const findErrorMsg = useMemo(() => {
    const detail = (findErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail
    return typeof detail === 'string' ? detail : 'Could not search tables.'
  }, [findErr])

  const runIdSearch = () => {
    const v = idSearch.trim()
    if (v.length < 2) {
      toast.error('Enter at least 2 characters (e.g. a UUID)')
      return
    }
    setSubmittedId(v)
  }

  const cellMatches = useMemo(() => {
    if (!findResult) return []
    if (findResult.matches?.length) return findResult.matches
    return findResult.hits.flatMap((h) => h.cell_matches ?? [])
  }, [findResult])

  if (!isVendorAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Table2 className="h-7 w-7 text-primary" />
          Table Data
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Search your business data and see which table and column a value belongs to. To view full table
          records, use{' '}
          <Link to="/system/browse-table" className="font-medium text-primary hover:underline">
            Browse table
          </Link>
          . Only data for{' '}
          <span className="font-medium text-foreground">
            {vendor?.display_name || vendor?.business_name || 'your business'}
          </span>{' '}
          is shown.
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
                No rows found for this value. Try{' '}
                <Link to="/system/browse-table" className="font-medium text-primary hover:underline">
                  browsing a specific table
                </Link>
                .
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
    </div>
  )
}
