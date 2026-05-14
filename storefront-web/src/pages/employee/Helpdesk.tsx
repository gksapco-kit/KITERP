import { useState } from 'react'
import { LifeBuoy, Plus, X } from 'lucide-react'
import { useESSTickets, useESSCreateTicket } from '@/hooks/useESS'

const STATUS: Record<string, { label: string; color: string }> = {
  open:        { label: 'Open',        color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  waiting:     { label: 'Waiting',     color: 'bg-primary/12 text-primary' },
  resolved:    { label: 'Resolved',    color: 'bg-green-100 text-green-700' },
  closed:      { label: 'Closed',      color: 'bg-gray-200 text-gray-700' },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  )
}

function NewTicketModal({ onClose }: { onClose: () => void }) {
  const create = useESSCreateTicket()
  const [form, setForm] = useState({
    subject: '', description: '', category: 'it',
    priority: 'normal', is_anonymous: false,
  })

  const submit = () => {
    if (!form.subject.trim()) return
    create.mutate(form as Record<string, unknown>, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">Raise a Ticket</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Subject *">
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
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
                onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea className="w-full border rounded px-3 py-2 text-sm" rows={5} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          {form.category === 'grievance' && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_anonymous}
                onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })} />
              Submit anonymously
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={submit} disabled={!form.subject.trim() || create.isPending}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            Submit ticket
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ESSHelpdeskPage() {
  const { data: tickets = [], isLoading } = useESSTickets()
  const [showNew, setShowNew] = useState(false)
  const list: any[] = (tickets as any)?.items ?? tickets

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Help Desk</h1>
          <p className="text-sm text-gray-500 mt-1">Raise IT, HR, payroll or grievance tickets</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center">
            <LifeBuoy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No tickets yet.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {list.map((t: any) => {
              const st = STATUS[t.status] ?? STATUS.open
              return (
                <li key={t.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-gray-500">{t.ticket_number}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                        <span className="text-[10px] uppercase text-gray-500">{t.priority}</span>
                        {t.category && (
                          <span className="text-[10px] uppercase text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {t.category}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-1">{t.subject}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(t.created_at).toLocaleString()}
                      </p>
                      {t.description && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{t.description}</p>
                      )}
                    </div>
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
