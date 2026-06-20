import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { useTicket, useTicketComments, useAddTicketComment, useSaveTicket } from '@/hooks/useCrm'
import { ArrowLeft, Loader2, Lock, Send, AlertTriangle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { CrmExtrasView } from './crmExtras'

const STATUSES = ['open', 'pending', 'on_hold', 'resolved', 'closed']
const PRIORITIES = ['low', 'normal', 'high', 'urgent']

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: ticket, isLoading } = useTicket(id)
  const { data: comments } = useTicketComments(id)
  const addComment = useAddTicketComment(id || '')
  const save = useSaveTicket()
  const [body, setBody] = useState('')
  const [isInternal, setIsInternal] = useState(false)

  if (isLoading || !ticket) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
  }

  const sendComment = () => {
    if (!body.trim()) return
    addComment.mutate({ body: body.trim(), is_internal: isInternal }, { onSuccess: () => setBody('') })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/crm/tickets')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">{ticket.number}</p>
          <h1 className="text-2xl font-bold text-gray-900">{ticket.subject}</h1>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select
            className="w-28"
            value={ticket.priority === 'medium' ? 'normal' : ticket.priority}
            onChange={v => save.mutate({ id: ticket.id, data: { priority: v } })}
            options={PRIORITIES.map(p => ({ value: p, label: p }))}
          />
          <Select
            className="w-32"
            value={ticket.status}
            onChange={v => save.mutate({ id: ticket.id, data: { status: v } })}
            options={STATUSES.map(s => ({ value: s, label: s }))}
          />
          {ticket.sla_breached && <Badge variant="destructive"><AlertTriangle className="w-3 h-3" /> SLA breached</Badge>}
        </div>
      </div>

      {ticket.description && (
        <Card><CardContent className="p-5">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
        </CardContent></Card>
      )}

      <CrmExtrasView cf={ticket.custom_fields} />

      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-3 border-b">
            <h2 className="text-sm font-semibold">Conversation</h2>
          </div>
          <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
            {comments?.length ? comments.map(c => (
              <div key={c.id} className={`p-3 rounded-lg ${c.is_internal ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    {c.is_internal && <Lock className="w-3 h-3 text-amber-600" />}
                    {c.contact_id ? 'Customer' : c.is_internal ? 'Internal note' : 'Agent'}
                  </span>
                  <span>{formatDateTime(c.created_at)}</span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{c.body}</p>
              </div>
            )) : <p className="text-sm text-gray-400 text-center py-6">No comments yet.</p>}
          </div>
          <div className="border-t p-4 space-y-2">
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Reply…"
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} />
                Internal note (only visible to team)
              </label>
              <Button onClick={sendComment} disabled={!body.trim() || addComment.isPending}>
                {addComment.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
