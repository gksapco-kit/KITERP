import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, GitBranch, History, Package } from 'lucide-react'
import { pharmaApi } from '@/api/pharma'
import { onClickableTableRow } from '@/lib/clickableTableRow'
import {
  fmtErr,
  PharmaCard,
  PharmaEmpty,
  PharmaPageHeader,
  PharmaStatusBadge,
} from './pharmaShared'

export default function PharmaSettingsSequenceDetailPage() {
  const navigate = useNavigate()
  const { sequenceId } = useParams<{ sequenceId: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sequenceId) return
    setLoading(true)
    pharmaApi
      .getSequence(sequenceId)
      .then((d) => {
        setData(d)
        setError('')
      })
      .catch((e: unknown) => setError(fmtErr(e, 'Failed to load')))
      .finally(() => setLoading(false))
  }, [sequenceId])

  const seq = data?.sequence
  const track = data?.track || {}
  const batches = data?.batches || []
  const workflow = data?.workflow || { transactions: [], bprs: [], inspections: [] }
  const linkedModels = data?.linked_models || []

  return (
    <div className="space-y-4 p-6">
      <div>
        <Link
          to="/pharma/settings/batch-numbering"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sequences
        </Link>
        <PharmaPageHeader
          title={seq ? `Sequence ${seq.prefix}` : 'Sequence'}
          subtitle="Track info for this prefix and batch workflow history (movements, BPR, inspections)."
        />
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {error ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {seq ? (
        <>
          {/* Track info */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Last allocated', value: seq.last_number },
              { label: 'Pad width', value: seq.pad_width },
              { label: 'Batches on track', value: track.batch_count ?? 0 },
              { label: 'Next preview', value: track.next_preview || '—' },
            ].map((k) => (
              <PharmaCard key={k.label} className="py-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {k.label}
                </div>
                <div className="mt-1 font-mono text-lg font-semibold tabular-nums">{k.value}</div>
              </PharmaCard>
            ))}
          </div>

          <PharmaCard>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <Package className="h-3.5 w-3.5 text-primary" />
              Track info
            </h2>
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <div className="text-xs text-muted-foreground">Prefix</div>
                <div className="font-mono font-semibold">{seq.prefix}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Period</div>
                <div className="font-mono">{seq.period_key || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Numbering model</div>
                <div className="mt-0.5">
                  {linkedModels.length === 0 ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      Orphan — no model matches this prefix/period
                    </span>
                  ) : (
                    <span className="flex flex-wrap gap-1.5">
                      {linkedModels.map((m: { id: string; code: string; label: string; is_active?: boolean }) => (
                        <Link
                          key={m.id}
                          to="/pharma/settings/batch-numbering"
                          className={`rounded px-1.5 py-0.5 font-mono text-xs hover:underline ${
                            m.is_active === false
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-primary/10 text-primary'
                          }`}
                          title={m.label}
                        >
                          {m.code}
                          {m.label ? ` · ${m.label}` : ''}
                        </Link>
                      ))}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Scope</div>
                <div>
                  {seq.product_id
                    ? `Product${seq.product_name ? `: ${seq.product_name}` : ''}`
                    : seq.plant_id
                      ? 'Plant-scoped'
                      : 'Vendor-wide'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Updated</div>
                <div>{seq.updated_at ? new Date(seq.updated_at).toLocaleString() : '—'}</div>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <div className="mb-1.5 text-xs text-muted-foreground">Quality status mix</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.keys(track.status_counts || {}).length === 0 ? (
                    <span className="text-xs text-muted-foreground">No batches yet</span>
                  ) : (
                    Object.entries(track.status_counts as Record<string, number>).map(([status, count]) => (
                      <span key={status} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs">
                        <PharmaStatusBadge status={status} />
                        <span className="font-semibold tabular-nums">{count}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
                <span>{track.txn_count ?? 0} movements</span>
                <span>·</span>
                <span>{track.bpr_count ?? 0} BPRs</span>
                <span>·</span>
                <span>{track.inspection_count ?? 0} inspections</span>
              </div>
            </div>
          </PharmaCard>

          {/* Batches on this sequence */}
          <PharmaCard className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Batches on this sequence</h2>
            </div>
            {batches.length === 0 ? (
              <div className="px-4 py-2">
                <PharmaEmpty label="No batches found for this prefix" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Batch #</th>
                      <th className="px-4 py-2 font-medium">Product</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Available</th>
                      <th className="px-4 py-2 font-medium">Expiry</th>
                      <th className="px-4 py-2 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {batches.map((b: any) => (
                      <tr
                        key={b.id}
                        className="cursor-pointer hover:bg-muted/50"
                        {...onClickableTableRow(() => navigate(`/pharma/batches/${b.id}`))}
                      >
                        <td className="px-4 py-2">
                          <Link
                            to={`/pharma/batches/${b.id}`}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {b.batch_number}
                          </Link>
                        </td>
                        <td className="px-4 py-2">{b.product_name || '—'}</td>
                        <td className="px-4 py-2">
                          <PharmaStatusBadge status={b.quality_status} />
                        </td>
                        <td className="px-4 py-2 tabular-nums">{b.quantity_available}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{b.expiry_date || '—'}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {b.created_at ? new Date(b.created_at).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PharmaCard>

          {/* Workflow history */}
          <div className="grid gap-4 lg:grid-cols-2">
            <PharmaCard className="overflow-hidden p-0">
              <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
                <History className="h-3.5 w-3.5 text-primary" />
                <h2 className="text-sm font-semibold">Batch workflow history</h2>
              </div>
              {(workflow.transactions || []).length === 0 ? (
                <div className="px-4 py-2">
                  <PharmaEmpty label="No movements yet" />
                </div>
              ) : (
                <ul className="max-h-80 divide-y overflow-y-auto">
                  {workflow.transactions.map((t: any) => (
                    <li key={t.id} className="px-4 py-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <PharmaStatusBadge status={t.txn_type} />
                          {t.source_type ? (
                            <span className="text-muted-foreground">{t.source_type}</span>
                          ) : null}
                        </div>
                        <span className="tabular-nums text-muted-foreground">
                          {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-foreground">
                        {t.from_batch_number || t.from_batch_id?.slice?.(0, 8) || '—'}
                        {' → '}
                        {t.to_batch_number || t.to_batch_id?.slice?.(0, 8) || '—'}
                        <span className="ml-2 text-muted-foreground">qty {t.quantity}</span>
                        {t.document_number ? (
                          <span className="ml-2 text-muted-foreground">doc {t.document_number}</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </PharmaCard>

            <div className="space-y-4">
              <PharmaCard className="overflow-hidden p-0">
                <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
                  <GitBranch className="h-3.5 w-3.5 text-primary" />
                  <h2 className="text-sm font-semibold">BPR workflow</h2>
                </div>
                {(workflow.bprs || []).length === 0 ? (
                  <div className="px-4 py-2">
                    <PharmaEmpty label="No BPRs for these batches" />
                  </div>
                ) : (
                  <ul className="max-h-40 divide-y overflow-y-auto">
                    {workflow.bprs.map((b: any) => (
                      <li key={b.id} className="flex items-center justify-between gap-2 px-4 py-2 text-xs">
                        <div>
                          <Link to="/pharma/bpr" className="font-mono font-medium text-primary hover:underline">
                            {b.batch_number}
                          </Link>
                          <div className="text-muted-foreground">
                            {b.created_at ? new Date(b.created_at).toLocaleString() : '—'}
                          </div>
                        </div>
                        <PharmaStatusBadge status={b.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </PharmaCard>

              <PharmaCard className="overflow-hidden p-0">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">Inspection / release workflow</h2>
                </div>
                {(workflow.inspections || []).length === 0 ? (
                  <div className="px-4 py-2">
                    <PharmaEmpty label="No inspections for these batches" />
                  </div>
                ) : (
                  <ul className="max-h-40 divide-y overflow-y-auto">
                    {workflow.inspections.map((i: any) => (
                      <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2 text-xs">
                        <div>
                          <Link
                            to={`/pharma/batches/${i.goods_batch_id}`}
                            className="font-mono font-medium text-primary hover:underline"
                          >
                            {i.batch_number || i.goods_batch_id?.slice?.(0, 8)}
                          </Link>
                          <div className="text-muted-foreground">
                            {i.created_at ? new Date(i.created_at).toLocaleString() : '—'}
                            {i.decision ? ` · ${i.decision}` : ''}
                          </div>
                        </div>
                        <PharmaStatusBadge status={i.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </PharmaCard>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
