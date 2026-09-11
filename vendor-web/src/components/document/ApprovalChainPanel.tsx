/**
 * Shared approval chain display used across PR, PO, Invoice, Return, and STO detail views.
 *
 * Renders the sorted approval steps with status dots, current-step highlight,
 * actioned-at timestamps, and approver comments.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentStatusBadge, PROCUREMENT_APPROVAL_STATUS_MAP } from './DocumentStatusBadge'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApprovalStep {
  id: string
  level: number
  approver_id?: string | null
  approver_name?: string | null
  status: string
  comments?: string | null
  remarks?: string | null
  actioned_at?: string | null
  created_at?: string | null
}

interface ApprovalChainPanelProps {
  approvals: ApprovalStep[]
  /** The ID of the current user's vendor_user membership — used to highlight "this is your turn". */
  myMembershipId?: string | null
  /** Message the submitter left for approvers. */
  approverMessage?: string | null
  /** Compact variant omits the card wrapper — useful inside slide-overs. */
  compact?: boolean
  className?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: string | null | undefined) {
  if (!d) return null
  return new Date(d).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

const DOT: Record<string, string> = {
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  pending:  'bg-amber-400',
  skipped:  'bg-gray-300 dark:bg-gray-600',
}

// ── Component ─────────────────────────────────────────────────────────────────

function ApprovalChainContent({
  approvals,
  myMembershipId,
  approverMessage,
}: Omit<ApprovalChainPanelProps, 'compact' | 'className'>) {
  const sorted = [...approvals].sort((a, b) => a.level - b.level)
  const pendingStep = sorted.find((s) => s.status === 'pending')
  const isMyTurn =
    !!pendingStep &&
    myMembershipId != null &&
    (!pendingStep.approver_id || pendingStep.approver_id === myMembershipId)

  return (
    <div className="space-y-3">
      {approverMessage && (
        <div className="rounded-md border border-blue-100 bg-blue-50/70 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/25">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300">
            Message for approver
          </p>
          <p className="mt-1 whitespace-pre-wrap text-xs text-blue-950 dark:text-blue-100">
            {approverMessage}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((step) => {
          const isCurrent = step.status === 'pending' && step.level === pendingStep?.level
          return (
            <div
              key={step.id}
              className={cn(
                'rounded-lg border px-3 py-2',
                isCurrent
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                  : 'border-border',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className={cn(
                    'mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full',
                    DOT[step.status] ?? 'bg-gray-200',
                  )}
                />
                <span className="text-xs font-semibold text-muted-foreground">
                  Level {step.level}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs font-medium">{step.approver_name || '—'}</span>
                {isCurrent && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    {isMyTurn ? 'Your turn' : 'Awaiting'}
                  </span>
                )}
                <DocumentStatusBadge
                  status={step.status}
                  map={PROCUREMENT_APPROVAL_STATUS_MAP}
                  className="ml-auto capitalize"
                />
              </div>

              {(step.comments || step.remarks || step.actioned_at) && (
                <div className="mt-2 space-y-1">
                  {step.actioned_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Actioned {fmt(step.actioned_at)}
                      {step.created_at && ` · Assigned ${fmt(step.created_at)}`}
                    </p>
                  )}
                  {(step.comments || step.remarks) && (
                    <p className="text-xs italic text-muted-foreground">
                      "{step.comments || step.remarks}"
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {pendingStep && !isMyTurn && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Awaiting{' '}
          <span className="font-semibold">
            {pendingStep.approver_name || 'designated approver'}
          </span>{' '}
          (Level {pendingStep.level})
        </p>
      )}
    </div>
  )
}

export function ApprovalChainPanel({
  approvals,
  myMembershipId,
  approverMessage,
  compact = false,
  className,
}: ApprovalChainPanelProps) {
  if (!approvals || approvals.length === 0) return null

  const content = (
    <ApprovalChainContent
      approvals={approvals}
      myMembershipId={myMembershipId}
      approverMessage={approverMessage}
    />
  )

  if (compact) {
    return (
      <div className={className}>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Approval Chain
        </p>
        {content}
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="border-b px-4 py-2.5">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4" /> Approval Chain
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 py-3">
        {content}
      </CardContent>
    </Card>
  )
}
