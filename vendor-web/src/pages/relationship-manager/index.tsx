import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, Phone, UsersRound, MessageSquarePlus, Send, UserRound } from 'lucide-react'
import {
  relationshipManagerApi,
  type VendorRmQueryRow,
} from '@/api/relationshipManager'
import { useAuthStore } from '@/stores/authStore'
import { cn, formFieldBorderClassName, formFieldFocusClassName } from '@/lib/utils'

const rmKeys = {
  summary: ['relationship-manager'] as const,
  queries: ['relationship-manager', 'queries'] as const,
}

function statusBadge(status: string) {
  return cn(
    'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize',
    status === 'closed' && 'bg-muted text-muted-foreground',
    status === 'in_progress' && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    status !== 'closed' && status !== 'in_progress' && 'bg-info/15 text-info',
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
}

export default function RelationshipManagerPage() {
  const qc = useQueryClient()
  const accessToken = useAuthStore((s) => s.accessToken)
  const sessionReady = Boolean(accessToken)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: rmKeys.summary,
    queryFn: () => relationshipManagerApi.getMine(),
    enabled: sessionReady,
  })

  const { data: queries, isLoading: loadingQueries } = useQuery({
    queryKey: rmKeys.queries,
    queryFn: () => relationshipManagerApi.listQueries(),
    enabled: sessionReady,
  })

  const createMut = useMutation({
    mutationFn: () =>
      relationshipManagerApi.createQuery({
        subject: subject.trim(),
        body: body.trim(),
      }),
    onSuccess: () => {
      setSubject('')
      setBody('')
      qc.invalidateQueries({ queryKey: rmKeys.queries })
    },
  })

  const assigned = Boolean(summary?.assigned && summary?.manager)
  const manager = assigned ? summary?.manager : null
  const subjectReady = subject.trim().length >= 3
  const bodyReady = body.trim().length >= 10
  const canSubmit = assigned && subjectReady && bodyReady && !createMut.isPending

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 lg:h-[calc(100dvh-7.75rem)] lg:overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UsersRound className="h-4 w-4" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Relationship Manager</h1>
        {!loadingSummary && (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
              assigned ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
            )}
          >
            {assigned ? 'Assigned' : 'Unassigned'}
          </span>
        )}
        <p className="w-full text-xs text-muted-foreground sm:w-auto sm:text-sm">
          Your main contact for account questions.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:col-start-1 lg:row-start-1">
          <div className="border-b border-border/70 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">Your manager</h2>
          </div>
          {loadingSummary ? (
            <div className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
              <div className="space-y-2">
                <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
                <div className="h-3 w-36 animate-pulse rounded-full bg-muted" />
              </div>
            </div>
          ) : !manager ? (
            <div className="flex items-start gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <UserRound className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">No manager assigned</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  A relationship manager has not been assigned yet. Please reach out to platform support.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                  {initials(manager.full_name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{manager.full_name}</p>
                  <p className="text-xs text-muted-foreground">Account contact</p>
                </div>
              </div>
              <div className="space-y-2">
                {manager.email && (
                  <a
                    href={`mailto:${manager.email}`}
                    className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{manager.email}</span>
                  </a>
                )}
                {manager.phone && (
                  <a
                    href={`tel:${manager.phone}`}
                    className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{manager.phone}</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-4 py-2.5">
            <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">New message</h2>
            {!loadingSummary && !assigned && (
              <span className="ml-auto truncate text-xs text-muted-foreground">Assign a manager before you can send queries.</span>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
            <div className="shrink-0 space-y-1.5">
              <Label htmlFor="rm-subject">Subject</Label>
              <Input
                id="rm-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Short summary"
                maxLength={255}
                disabled={!assigned}
                className="rounded-xl"
              />
              {assigned && subject.trim().length > 0 && !subjectReady && (
                <p className="text-xs text-muted-foreground">Use at least 3 characters.</p>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1.5">
              <Label htmlFor="rm-body" className="shrink-0">Message</Label>
              <textarea
                id="rm-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={!assigned}
                className={cn(
                  'min-h-[7rem] w-full resize-none rounded-xl bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0 lg:flex-1',
                  formFieldBorderClassName,
                  formFieldFocusClassName,
                )}
                placeholder="Describe your question."
              />
              {assigned && body.trim().length > 0 && !bodyReady && (
                <p className="shrink-0 text-xs text-muted-foreground">Use at least 10 characters.</p>
              )}
            </div>
            {createMut.isError && (
              <p className="shrink-0 text-sm text-destructive">
                {(createMut.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                  'Could not send message.'}
              </p>
            )}
            <div className="flex shrink-0 justify-end">
              <Button type="button" className="rounded-full" disabled={!canSubmit} onClick={() => createMut.mutate()}>
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send to manager
              </Button>
            </div>
          </div>
        </section>

        <section className="flex min-h-48 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:col-start-1 lg:row-start-2 lg:min-h-0">
          <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-foreground">Previous messages</h2>
            {!!queries?.length && (
              <span className="text-xs tabular-nums text-muted-foreground">{queries.length}</span>
            )}
          </div>
          {loadingQueries ? (
            <div className="flex flex-1 items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !queries?.length ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-4 text-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Mail className="h-4 w-4" />
              </span>
              <p className="mt-2 text-sm font-medium text-foreground">No messages yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Questions you send will show up here.</p>
            </div>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {queries.map((q: VendorRmQueryRow, index) => (
                <li
                  key={q.id}
                  className={cn('px-4 py-3', index > 0 && 'border-t border-border/70')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{q.subject}</p>
                    <span className={statusBadge(q.status)}>{q.status.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{q.body}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {q.created_at ? new Date(q.created_at).toLocaleString() : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
