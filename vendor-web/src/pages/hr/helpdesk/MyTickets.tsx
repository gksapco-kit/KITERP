import { onModalBackdropClick } from '@/lib/utils'
import { InlineFieldLabel } from '@/components/common/InlineFieldLabel'
import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Link } from 'react-router-dom'
import { LifeBuoy, Plus, X, ExternalLink } from 'lucide-react'
import { useMyTickets, useCreateTicket } from '@/hooks/useVendor'
import type { HelpdeskTicket } from '@/types'

const STATUS: Record<string, { label: string; color: string }> = {
  open:        { label: 'Open',        color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  waiting:     { label: 'Waiting',     color: 'bg-primary/12 text-primary' },
  resolved:    { label: 'Resolved',    color: 'bg-green-100 text-green-700' },
  closed:      { label: 'Closed',      color: 'bg-gray-200 text-gray-700' },
}

export default function MyTicketsPage() {
  const { data: tickets = [], isLoading } = useMyTickets()
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Helpdesk</h1>
          <p className="text-sm text-gray-500 mt-1">Raise IT, HR, Payroll Or Grievance Tickets</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (tickets as HelpdeskTicket[]).length === 0 ? (
          <div className="p-12 text-center">
            <LifeBuoy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No tickets yet.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {(tickets as HelpdeskTicket[]).map(t => {
              const st = STATUS[t.status] ?? STATUS.open
              return (
                <li key={t.id} className="p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-500">{t.ticket_number}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                        <span className="text-xs uppercase text-gray-500">{t.priority}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">{t.subject}</p>
                      <p className="text-xs text-gray-500">{new Date(t.created_at).toLocaleString()}
                        {t.category && <> · {t.category}</>}</p>
                    </div>
                    <Link to={`/hr/helpdesk/${t.id}`}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline shrink-0">
                      <ExternalLink className="w-3 h-3" /> Open
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {showNew && <NewTicketModal onClose={() => setShowNew(false)} />}
    </div>
  )
}

function NewTicketModal({
 onClose }: { onClose: () => void }) {
  const create = useCreateTicket()
  const [form, setForm] = useState({
    subject: '', description: '', category: 'it',
    priority: 'normal' as HelpdeskTicket['priority'], is_anonymous: false,
  })
  const submit = () => {
    if (!form.subject.trim()) return
    create.mutate(form as unknown as Record<string, unknown>, { onSuccess: onClose })
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Raise Ticket</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Subject *">
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="it">IT</option>
                <option value="hr">HR</option>
                <option value="payroll">Payroll</option>
                <option value="facilities">Facilities</option>
                <option value="grievance">Grievance</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Priority">
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value as HelpdeskTicket['priority'] })}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea className="w-full border rounded px-3 py-2 text-sm" rows={5} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </Field>
          {form.category === 'grievance' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_anonymous}
                onChange={e => setForm({ ...form, is_anonymous: e.target.checked })} />
              Submit anonymously
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg text-gray-700">Cancel</button>
          <button onClick={submit} disabled={!form.subject.trim() || create.isPending}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
            Submit ticket
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <InlineFieldLabel label={label} className="block text-xs font-medium text-gray-700 mb-1" />
      {children}
    </div>
  )
}
