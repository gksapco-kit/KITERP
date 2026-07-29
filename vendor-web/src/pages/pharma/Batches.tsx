import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { RefreshCw, Search } from 'lucide-react'
import { pharmaApi } from '@/api/pharma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useHasPermission } from '@/hooks/usePermissions'
import {
  PharmaCard,
  PharmaConfirmDialog,
  PharmaEmpty,
  PharmaExpiryCell,
  PharmaLoading,
  PharmaPageHeader,
  PharmaProductSelect,
  PharmaStatusBadge,
  PharmaToolbar,
  isUuid,
} from './pharmaShared'

export function PharmaBatchesPage() {
  const canManage = useHasPermission('pharma.manage')
  const [batches, setBatches] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await pharmaApi.batches({
        quality_status: status || undefined,
        search: search || undefined,
        limit: 100,
      })
      setBatches(res.batches || [])
      setTotal(res.total ?? (res.batches || []).length)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to load batches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [status])

  const setBatchStatus = async (id: string, quality_status: string) => {
    try {
      await pharmaApi.updateBatchStatus(id, { quality_status })
      toast.success('Status updated')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Update failed')
    }
  }

  return (
    <div className="p-6">
      {confirm ? (
        <PharmaConfirmDialog
          open={true}
          title={confirm.title}
          description={confirm.description}
          confirmLabel="Confirm"
          destructive
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      ) : null}
      <PharmaPageHeader
        title="Batches"
        subtitle="Lot register — GR and production create lots for batch-managed products. Formal release is via Inspections."
      />
      <PharmaToolbar>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-52 pl-8"
            placeholder="Search batch #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
        </div>
        <Select
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'unrestricted', label: 'Unrestricted' },
            { value: 'quality_inspection', label: 'Quality inspection' },
            { value: 'blocked', label: 'Blocked' },
          ]}
        />
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <span className="text-xs text-muted-foreground">{total} lot(s)</span>
      </PharmaToolbar>
      <PharmaCard>
        {loading ? (
          <PharmaLoading />
        ) : batches.length === 0 ? (
          <PharmaEmpty
            label="No batches yet"
            hint="Receive batch-managed goods or complete production to create lots."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="py-2.5 pr-3 font-medium">Batch</th>
                  <th className="py-2.5 pr-3 font-medium">Product</th>
                  <th className="py-2.5 pr-3 font-medium">Status</th>
                  <th className="py-2.5 pr-3 font-medium">Qty avail</th>
                  <th className="py-2.5 pr-3 font-medium">Expiry</th>
                  <th className="py-2.5 pr-3 font-medium">Source</th>
                  <th className="py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-border/50 align-middle">
                    <td className="py-2.5 pr-3 font-mono text-xs font-medium">
                      <Link className="hover:underline" to={`/pharma/batches/${b.id}`}>
                        {b.batch_number}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">{b.product_name || '—'}</td>
                    <td className="py-2.5 pr-3">
                      <PharmaStatusBadge status={b.quality_status} />
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{b.quantity_available}</td>
                    <td className="py-2.5 pr-3">
                      <PharmaExpiryCell date={b.expiry_date} />
                    </td>
                    <td className="py-2.5 pr-3 capitalize text-muted-foreground">{b.source_type || '—'}</td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {b.quality_status === 'quality_inspection' && canManage ? (
                          <Button asChild size="sm" variant="outline">
                            <Link to="/pharma/inspections">Inspect</Link>
                          </Button>
                        ) : null}
                        {canManage ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setConfirm({
                                  title: 'Hold lot for QI?',
                                  description: `Lot ${b.batch_number} will be moved to Quality Inspection status. Stock will be frozen until released.`,
                                  onConfirm: () => setBatchStatus(b.id, 'quality_inspection'),
                                })
                              }
                            >
                              Hold QI
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setConfirm({
                                  title: 'Block this lot?',
                                  description: `Lot ${b.batch_number} will be set to Blocked. It cannot be consumed or shipped until manually unblocked.`,
                                  onConfirm: () => setBatchStatus(b.id, 'blocked'),
                                })
                              }
                            >
                              Block
                            </Button>
                          </>
                        ) : null}
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/pharma/batches/${b.id}`}>Open</Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/pharma/genealogy?batch=${b.id}`}>Trace</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PharmaCard>
    </div>
  )
}

export function PharmaMovementsPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    pharmaApi
      .transactions({ limit: 100 })
      .then((r) => setRows(r.transactions || []))
      .catch(() => toast.error('Failed to load movements'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Lot movements"
        subtitle="Batch transaction spine — receive, issue, produce, sale, and quarantine transfers."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={load}>
              Refresh
            </Button>
          </>
        }
      />
      <PharmaCard>
        {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p> : null}
        {!loading && rows.length === 0 ? (
          <PharmaEmpty label="No lot movements yet" hint="Movements appear when lots are received, consumed, or sold." />
        ) : null}
        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="py-2.5 font-medium">When</th>
                  <th className="py-2.5 font-medium">Type</th>
                  <th className="py-2.5 font-medium">Qty</th>
                  <th className="py-2.5 font-medium">Batch #</th>
                  <th className="py-2.5 font-medium">From → To</th>
                  <th className="py-2.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-border/50">
                    <td className="py-2 text-xs text-muted-foreground">{t.created_at?.slice(0, 19) || '—'}</td>
                    <td className="py-2">
                      <PharmaStatusBadge status={t.txn_type} />
                    </td>
                    <td className="py-2 tabular-nums">{t.quantity}</td>
                    <td className="py-2 font-mono text-xs">{t.meta?.batch_number || '—'}</td>
                    <td className="py-2 font-mono text-xs text-muted-foreground">
                      {(t.from_batch_id || '—').toString().slice(0, 8)} → {(t.to_batch_id || '—').toString().slice(0, 8)}
                    </td>
                    <td className="py-2 capitalize text-muted-foreground">{t.source_type || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </PharmaCard>
    </div>
  )
}

export function PharmaFefoPage() {
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState('1')
  const [result, setResult] = useState<any>(null)
  const [running, setRunning] = useState(false)

  const run = async () => {
    if (!isUuid(productId)) {
      toast.error('Select a product first')
      return
    }
    setRunning(true)
    try {
      const res = await pharmaApi.fefo({ product_id: productId.trim(), qty: Number(qty) || 1 })
      setResult(res)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'FEFO failed')
      setResult(null)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="FEFO allocation"
        subtitle="Preview earliest-expiry-first picks from unrestricted, non-expired lots."
      />
      <PharmaCard className="mb-4">
        <PharmaToolbar>
          <PharmaProductSelect className="w-72" value={productId} onChange={setProductId} />
          <Input className="w-28" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          <Button onClick={run} disabled={running}>
            {running ? 'Calculating…' : 'Preview'}
          </Button>
        </PharmaToolbar>
      </PharmaCard>
      {result ? (
        <PharmaCard>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span>
              Needed: <strong>{result.qty_needed ?? qty}</strong>
            </span>
            <span className={Number(result.short_by) > 0 ? 'text-red-700' : 'text-emerald-700'}>
              Short by: <strong>{result.short_by ?? 0}</strong>
            </span>
          </div>
          {(result.allocations || []).length === 0 ? (
            <PharmaEmpty label="No unrestricted FEFO stock available" />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Batch</th>
                  <th className="py-2 font-medium">Allocate</th>
                  <th className="py-2 font-medium">Available</th>
                  <th className="py-2 font-medium">Expiry</th>
                </tr>
              </thead>
              <tbody>
                {(result.allocations || []).map((a: any) => (
                  <tr key={a.id || a.batch_number} className="border-b border-border/50">
                    <td className="py-2 font-mono text-xs">{a.batch_number}</td>
                    <td className="py-2 tabular-nums font-medium">{a.allocate_qty}</td>
                    <td className="py-2 tabular-nums text-muted-foreground">{a.quantity_available ?? '—'}</td>
                    <td className="py-2">
                      <PharmaExpiryCell date={a.expiry_date} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PharmaCard>
      ) : null}
    </div>
  )
}

export function PharmaQuarantinePage() {
  const [data, setData] = useState<any>({ batches: [], locations: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    pharmaApi
      .quarantine()
      .then(setData)
      .catch(() => toast.error('Failed to load quarantine'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6">
      <PharmaPageHeader
        title="Quarantine board"
        subtitle="QI / blocked lots and storage locations typed as quarantine or rejected."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/pharma/inspections">Open inspections</Link>
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <PharmaCard>
          <h2 className="mb-3 text-sm font-semibold">Held batches</h2>
          {loading ? (
            <PharmaLoading />
          ) : (data.batches || []).length === 0 ? (
            <PharmaEmpty label="No QI/blocked batches" />
          ) : null}
          {!loading ? (
          <ul className="divide-y divide-border/60">
            {(data.batches || []).map((b: any) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <div className="font-mono text-xs font-medium">{b.batch_number}</div>
                  <div className="text-xs text-muted-foreground">{b.product_name || b.product_id?.slice?.(0, 8) || '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <PharmaStatusBadge status={b.quality_status} />
                  <span className="tabular-nums text-xs text-muted-foreground">qty {b.quantity_available}</span>
                </div>
              </li>
            ))}
          </ul>
          ) : null}
        </PharmaCard>
        <PharmaCard>
          <h2 className="mb-3 text-sm font-semibold">Quarantine / rejected SLocs</h2>
          {loading ? (
            <PharmaLoading />
          ) : (data.locations || []).length === 0 ? (
            <PharmaEmpty
              label="No quarantine locations configured"
              hint="Set stock type on Inventory → Storage Locations."
            />
          ) : null}
          {!loading ? (
          <ul className="divide-y divide-border/60">
            {(data.locations || []).map((s: any) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.code || '—'}</div>
                </div>
                <PharmaStatusBadge status={s.stock_type} />
              </li>
            ))}
          </ul>
          ) : null}
        </PharmaCard>
      </div>
    </div>
  )
}
