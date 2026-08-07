/**
 * CreditStatusPanel — Phase-8
 *
 * Shows customer credit position for this order:
 *   • Credit limit / outstanding / available / utilisation gauge
 *   • Status badge (ok | watch | blocked | not_checked)
 *   • "Release Credit Block" button when status is blocked
 *
 * Only shown for pay_later orders or when credit_status is set.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ShieldCheck, ShieldAlert, ShieldX, Shield,
  Loader2, CheckCircle2, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatCurrency } from '@/lib/utils'
import { vendorApi } from '@/api/vendor'
import apiClient from '@/api/client'
import type { Order } from '@/types'

interface Props {
  order: Order
  isTerminal: boolean
}

interface CreditStatus {
  order_id: string
  order_credit_status: string | null
  payment_method: string
  order_total: number
  credit_control_id: string | null
  credit_limit: number | null
  current_outstanding: number | null
  available_credit: number | null
  payment_blocked: boolean
  allowed: boolean
  reason: string
  utilization_pct: number | null
}

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; cls: string; barCls: string }> = {
  ok:          { label: 'Good Standing',  icon: <ShieldCheck className="h-4 w-4" />,  cls: 'text-emerald-600 dark:text-emerald-400', barCls: 'bg-emerald-500' },
  watch:       { label: 'Watch',          icon: <ShieldAlert className="h-4 w-4" />,  cls: 'text-amber-600 dark:text-amber-400',   barCls: 'bg-amber-500' },
  blocked:     { label: 'Blocked',        icon: <ShieldX className="h-4 w-4" />,      cls: 'text-destructive',                     barCls: 'bg-destructive' },
  not_checked: { label: 'Not Checked',    icon: <Shield className="h-4 w-4" />,       cls: 'text-muted-foreground',                barCls: 'bg-muted' },
}

// ── Release modal ────────────────────────────────────────────────────────────

function ReleaseModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      apiClient.post(`/vendors/me/orders/${orderId}/credit-release`, { reason: reason || undefined }),
    onSuccess: () => {
      toast.success('Credit block released')
      qc.invalidateQueries({ queryKey: ['order', orderId] })
      qc.invalidateQueries({ queryKey: ['credit-status', orderId] })
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not release block'
      toast.error(msg)
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Release Credit Block</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          This will allow the order to proceed to fulfilment.  Provide a reason for the audit log.
        </p>
        <div className="mb-4">
          <Label className="text-xs">Reason</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Approved by Finance Manager"
            className="h-8 text-sm mt-1"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button size="sm" variant="destructive" onClick={() => mutate()} disabled={isPending}>
            {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Release Block
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function CreditStatusPanel({ order, isTerminal }: Props) {
  const [showRelease, setShowRelease] = useState(false)

  // Only fetch for pay_later or when credit_status is already set
  const shouldFetch = order.payment_method === 'pay_later' || !!order.credit_status

  const { data: cs, isLoading } = useQuery<CreditStatus>({
    queryKey: ['credit-status', order.id],
    queryFn: async () => {
      const res = await apiClient.get(`/vendors/me/orders/${order.id}/credit-status`)
      return res.data
    },
    enabled: shouldFetch,
  })

  if (!shouldFetch) return null

  const statusKey = (cs?.order_credit_status || order.credit_status || 'not_checked') as string
  const meta = STATUS_META[statusKey] || STATUS_META.not_checked
  const isBlocked = statusKey === 'blocked' || cs?.payment_blocked

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className={cn('flex items-center gap-2', meta.cls)}>
          {meta.icon}
          <span className="text-sm font-medium">Credit</span>
          <span className="text-xs font-normal">{meta.label}</span>
        </div>
        {isBlocked && !isTerminal && (
          <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => setShowRelease(true)}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Release Block
          </Button>
        )}
      </div>

      <div className="px-4 py-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading credit position…
          </div>
        ) : cs && cs.credit_limit ? (
          <div className="space-y-2.5">
            {/* Utilisation bar */}
            {cs.utilization_pct !== null && (
              <div>
                <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                  <span>Credit utilisation</span>
                  <span className={cn('font-medium', cs.utilization_pct > 90 ? 'text-destructive' : cs.utilization_pct > 70 ? 'text-amber-600' : 'text-emerald-600')}>
                    {cs.utilization_pct}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', meta.barCls)}
                    style={{ width: `${Math.min(cs.utilization_pct, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Key figures */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Limit</p>
                <p className="text-[13px] font-semibold">{formatCurrency(cs.credit_limit ?? 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Outstanding</p>
                <p className={cn('text-[13px] font-semibold', isBlocked ? 'text-destructive' : '')}>
                  {formatCurrency(cs.current_outstanding ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Available</p>
                <p className={cn('text-[13px] font-semibold', (cs.available_credit ?? 0) < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
                  {formatCurrency(Math.max(0, cs.available_credit ?? 0))}
                </p>
              </div>
            </div>

            {/* Reason note when blocked */}
            {!cs.allowed && cs.reason && (
              <p className="text-[11px] text-destructive bg-destructive/5 rounded-md px-2.5 py-1.5">
                {cs.reason}
              </p>
            )}
          </div>
        ) : (
          /* No credit control record */
          <p className="text-xs text-muted-foreground py-1">
            {order.payment_method === 'pay_later'
              ? 'No credit control record — no limit enforced.'
              : 'Credit position not available for this order.'}
          </p>
        )}
      </div>

      {showRelease && (
        <ReleaseModal orderId={order.id} onClose={() => setShowRelease(false)} />
      )}
    </div>
  )
}
