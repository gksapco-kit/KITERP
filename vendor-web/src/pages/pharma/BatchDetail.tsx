import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { pharmaApi } from '@/api/pharma'
import { Button } from '@/components/ui/button'
import { useHasPermission } from '@/hooks/usePermissions'
import {
  GenealogyNode,
  PharmaCard,
  PharmaConfirmDialog,
  PharmaEmpty,
  PharmaExpiryCell,
  PharmaPageHeader,
  PharmaStatusBadge,
  isUuid,
} from './pharmaShared'

export default function PharmaBatchDetailPage() {
  const { batchId = '' } = useParams()
  const canManage = useHasPermission('pharma.manage')
  const [batch, setBatch] = useState<any>(null)
  const [tree, setTree] = useState<any>(null)
  const [txns, setTxns] = useState<any[]>([])
  const [inspections, setInspections] = useState<any[]>([])
  const [serials, setSerials] = useState<any[]>([])
  const [audit, setAudit] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)

  const load = async () => {
    if (!isUuid(batchId)) {
      setError('Invalid batch id')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [batchRes, treeRes, txnRes, inspRes, serialRes, auditRes] = await Promise.all([
        pharmaApi.getBatch(batchId),
        pharmaApi.genealogy(batchId),
        pharmaApi.transactions({ batch_id: batchId, limit: 100 }),
        pharmaApi.listInspections({ goods_batch_id: batchId }),
        pharmaApi.listSerials({ goods_batch_id: batchId }),
        pharmaApi.audit({ entity_type: 'goods_batch', entity_id: batchId }),
      ])
      setBatch(batchRes)
      setTree(treeRes)
      setTxns(txnRes.transactions || [])
      setInspections(inspRes.items || [])
      setSerials(serialRes.items || [])
      setAudit(auditRes.events || [])
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load lot')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [batchId])

  const openRetest = async () => {
    try {
      await pharmaApi.openRetest(batchId)
      toast.success('Retest inspection opened')
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Retest failed')
    }
  }

  const setStatus = async (quality_status: string) => {
    try {
      await pharmaApi.updateBatchStatus(batchId, { quality_status })
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
        title={batch?.batch_number || 'Lot dossier'}
        subtitle="Single-lot view — status, movements, QC, genealogy, serials, and audit."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/pharma/batches">Back to batches</Link>
            </Button>
          </div>
        }
      />

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      {batch ? (
        <>
          <PharmaCard className="mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-semibold">{batch.batch_number}</span>
                  <PharmaStatusBadge status={batch.quality_status} />
                </div>
                <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Product</span>
                    <div>{batch.product_name || batch.product_id?.slice?.(0, 8) || '—'}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Qty available</span>
                    <div className="tabular-nums">{batch.quantity_available ?? '—'}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Expiry</span>
                    <div>
                      <PharmaExpiryCell date={batch.expiry_date} />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Mfg date</span>
                    <div>{batch.manufacturing_date || '—'}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Source</span>
                    <div className="capitalize">{batch.source_type || '—'}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Supplier batch</span>
                    <div>{batch.supplier_batch_number || '—'}</div>
                  </div>
                </div>
                {batch.notes ? <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{batch.notes}</p> : null}
              </div>
              <div className="flex flex-wrap gap-1">
                {batch.quality_status === 'unrestricted' && canManage ? (
                  <Button size="sm" onClick={openRetest}>
                    Open retest
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
                          description: `Lot ${batch.batch_number} will be moved to Quality Inspection status. Stock will be frozen until released via Inspections.`,
                          onConfirm: () => setStatus('quality_inspection'),
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
                          description: `Lot ${batch.batch_number} will be set to Blocked status. It cannot be consumed or shipped until manually unblocked.`,
                          onConfirm: () => setStatus('blocked'),
                        })
                      }
                    >
                      Block
                    </Button>
                  </>
                ) : null}
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/pharma/genealogy?batch=${batchId}`}>Genealogy</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/pharma/inspections?batch=${batchId}`}>Inspections</Link>
                </Button>
              </div>
            </div>
          </PharmaCard>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <PharmaCard>
              <h2 className="mb-2 text-sm font-semibold">Upstream</h2>
              {(tree?.upstream || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No upstream links</p>
              ) : (
                tree.upstream.map((n: any, i: number) => <GenealogyNode key={i} node={n} />)
              )}
            </PharmaCard>
            <PharmaCard>
              <h2 className="mb-2 text-sm font-semibold">Downstream</h2>
              {(tree?.downstream || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No downstream links</p>
              ) : (
                tree.downstream.map((n: any, i: number) => <GenealogyNode key={i} node={n} />)
              )}
            </PharmaCard>
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <PharmaCard>
              <h2 className="mb-2 text-sm font-semibold">Movements</h2>
              {txns.length === 0 ? <PharmaEmpty label="No movements" /> : null}
              <ul className="divide-y divide-border/60">
                {txns.map((t) => (
                  <li key={t.id} className="flex justify-between gap-2 py-2 text-xs">
                    <span>
                      <PharmaStatusBadge status={t.txn_type} />{' '}
                      <span className="text-muted-foreground">{t.source_type}</span>
                    </span>
                    <span className="tabular-nums">{t.quantity}</span>
                  </li>
                ))}
              </ul>
            </PharmaCard>
            <PharmaCard>
              <h2 className="mb-2 text-sm font-semibold">Inspections</h2>
              {inspections.length === 0 ? <PharmaEmpty label="No inspections" /> : null}
              <ul className="divide-y divide-border/60">
                {inspections.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <PharmaStatusBadge status={i.status} />
                      <span className="capitalize text-muted-foreground">{i.origin}</span>
                      {i.coa_number ? <span className="font-mono">{i.coa_number}</span> : null}
                    </div>
                    {i.status === 'released' ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/pharma/release?insp=${i.id}`}>CoA</Link>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/pharma/inspections?batch=${batchId}`}>Open</Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </PharmaCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PharmaCard>
              <h2 className="mb-2 text-sm font-semibold">Serials</h2>
              {serials.length === 0 ? <PharmaEmpty label="No serials" /> : null}
              <ul className="divide-y divide-border/60">
                {serials.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2 py-2 text-xs">
                    <span className="font-mono">{s.serial_number}</span>
                    <div className="flex gap-1">
                      <PharmaStatusBadge status={s.level} />
                      <PharmaStatusBadge status={s.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </PharmaCard>
            <PharmaCard>
              <h2 className="mb-2 text-sm font-semibold">Audit (this lot)</h2>
              {audit.length === 0 ? <PharmaEmpty label="No audit events" /> : null}
              <ul className="divide-y divide-border/60">
                {audit.map((e) => (
                  <li key={e.id} className="py-2 text-xs">
                    <div className="font-medium">{e.action}</div>
                    <div className="text-muted-foreground">{e.created_at?.slice?.(0, 19)}</div>
                  </li>
                ))}
              </ul>
            </PharmaCard>
          </div>
        </>
      ) : null}
    </div>
  )
}
