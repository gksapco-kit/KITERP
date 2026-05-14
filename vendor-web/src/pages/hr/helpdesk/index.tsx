import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LifeBuoy, ExternalLink } from 'lucide-react'
import { useHRTickets } from '@/hooks/useVendor'
import type { HelpdeskTicket } from '@/types'

const STATUS: Record<string, { label: string; color: string }> = {
  open:        { label: 'Open',        color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  waiting:     { label: 'Waiting',     color: 'bg-primary/12 text-primary' },
  resolved:    { label: 'Resolved',    color: 'bg-green-100 text-green-700' },
  closed:      { label: 'Closed',      color: 'bg-gray-200 text-gray-700' },
}

const PRIORITY: Record<string, string> = {
  low: 'text-gray-500', normal: 'text-blue-600', high: 'text-orange-600', urgent: 'text-red-600',
}

export default function HelpdeskPage() {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { data: tickets = [], isLoading } = useHRTickets(statusFilter ? { status: statusFilter } : undefined)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Helpdesk &amp; Grievances</h1>
          <p className="text-sm text-gray-500 mt-1">Track and resolve employee tickets</p>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (tickets as HelpdeskTicket[]).length === 0 ? (
          <div className="p-12 text-center">
            <LifeBuoy className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No tickets match the filter.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>{['Ticket #', 'Subject', 'Category', 'Employee', 'Priority', 'Status', 'Created', ''].map(h =>
                <th key={h} className="text-left py-2 px-4 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(tickets as HelpdeskTicket[]).map(t => {
                const st = STATUS[t.status] ?? STATUS.open
                return (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 text-sm font-mono text-gray-700">{t.ticket_number ?? '—'}</td>
                    <td className="py-2 px-4 text-sm font-medium text-gray-900 line-clamp-1">{t.subject}</td>
                    <td className="py-2 px-4 text-xs text-gray-500">{t.category ?? '—'}</td>
                    <td className="py-2 px-4 text-xs font-mono text-gray-500">
                      {t.is_anonymous ? <span className="italic">Anonymous</span> : t.employee_id.slice(0, 8)}
                    </td>
                    <td className={`py-2 px-4 text-xs font-medium uppercase ${PRIORITY[t.priority] ?? ''}`}>
                      {t.priority}
                    </td>
                    <td className="py-2 px-4">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="py-2 px-4 text-xs text-gray-500">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="py-2 px-4">
                      <Link to={`/hr/helpdesk/${t.id}`}
                        className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Open
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
