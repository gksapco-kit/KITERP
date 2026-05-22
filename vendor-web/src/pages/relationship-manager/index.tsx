import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail, Phone, UsersRound, MessageSquarePlus } from 'lucide-react'
import {
  relationshipManagerApi,
  type VendorRmQueryRow,
} from '@/api/relationshipManager'

const rmKeys = {
  summary: ['relationship-manager'] as const,
  queries: ['relationship-manager', 'queries'] as const,
}

function statusBadge(status: string) {
  const base = 'text-xs font-medium px-2 py-0.5 rounded-full capitalize'
  if (status === 'closed') return `${base} bg-gray-100 text-gray-700`
  if (status === 'in_progress') return `${base} bg-amber-100 text-amber-800`
  return `${base} bg-blue-100 text-blue-800`
}

export default function RelationshipManagerPage() {
  const qc = useQueryClient()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: rmKeys.summary,
    queryFn: () => relationshipManagerApi.getMine(),
  })

  const { data: queries, isLoading: loadingQueries } = useQuery({
    queryKey: rmKeys.queries,
    queryFn: () => relationshipManagerApi.listQueries(),
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

  const canSubmit =
    summary?.assigned &&
    subject.trim().length >= 3 &&
    body.trim().length >= 10 &&
    !createMut.isPending

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UsersRound className="w-7 h-7 text-primary" />
          Relationship Manager
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your platform relationship manager is your main contact for account questions. Send them a message below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your manager</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSummary ? (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          ) : !summary?.assigned || !summary.manager ? (
            <p className="text-sm text-muted-foreground">
              A relationship manager has not been assigned to your account yet. Please reach out to platform support.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="font-medium text-lg">{summary.manager.full_name}</p>
              {summary.manager.email && (
                <p className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4 shrink-0" />
                  <a href={`mailto:${summary.manager.email}`} className="text-primary hover:underline">
                    {summary.manager.email}
                  </a>
                </p>
              )}
              {summary.manager.phone && (
                <p className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4 shrink-0" />
                  {summary.manager.phone}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4" />
            New message
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!summary?.assigned ? (
            <p className="text-sm text-muted-foreground">Assign a manager before you can send queries.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="rm-subject">Subject</Label>
                <Input
                  id="rm-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Short summary"
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rm-body">Message</Label>
                <textarea
                  id="rm-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Describe your question (at least 10 characters)."
                />
              </div>
              {createMut.isError && (
                <p className="text-sm text-destructive">
                  {(createMut.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
                    'Could not send message.'}
                </p>
              )}
              <Button type="button" disabled={!canSubmit} onClick={() => createMut.mutate()}>
                {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send to manager
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Previous messages</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingQueries ? (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          ) : !queries?.length ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            <ul className="space-y-4">
              {queries.map((q: VendorRmQueryRow) => (
                <li key={q.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between gap-2 items-start">
                    <p className="font-medium text-sm">{q.subject}</p>
                    <span className={statusBadge(q.status)}>{q.status.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{q.body}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {q.created_at ? new Date(q.created_at).toLocaleString() : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
