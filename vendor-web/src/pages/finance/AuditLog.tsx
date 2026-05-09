import { useState } from 'react'
import { useAuditLog } from '@/hooks/useFinance'
import { Shield } from 'lucide-react'

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-600',
  post: 'bg-indigo-100 text-indigo-700',
  void: 'bg-orange-100 text-orange-700',
  approve: 'bg-teal-100 text-teal-700',
  reject: 'bg-rose-100 text-rose-700',
}

export default function AuditLog() {
  const [params, setParams] = useState<Record<string, unknown>>({ limit: 100, skip: 0 })
  const [filter, setFilter] = useState({ entity_type: '', action: '' })

  const { data, isLoading } = useAuditLog({ ...params, ...filter })
  const logs = Array.isArray(data) ? data : (data?.items || [])
  const total = data?.total || logs.length

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Shield className="w-7 h-7 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <span className="text-sm text-gray-500">{total} total entries</span>
      </div>

      <div className="flex gap-3">
        <input placeholder="Entity type…" value={filter.entity_type}
          onChange={e => setFilter(f => ({ ...f, entity_type: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40" />
        <select value={filter.action} onChange={e => setFilter(f => ({ ...f, action: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Actions</option>
          {['create', 'update', 'delete', 'post', 'void', 'approve', 'reject'].map(a => (
            <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'Description'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No audit log entries.</td></tr>
            ) : logs.map((log: any) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 text-xs text-gray-600 font-mono">{log.user_id?.slice(0,8)}…</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-600 text-xs capitalize">{log.entity_type}</td>
                <td className="px-4 py-2 text-gray-500 font-mono text-xs">{log.entity_id?.slice(0,8)}…</td>
                <td className="px-4 py-2 text-gray-700 max-w-[200px] truncate text-xs">{log.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > 100 && (
          <div className="px-4 py-3 border-t bg-gray-50 flex justify-between items-center">
            <span className="text-xs text-gray-500">Showing 100 of {total} entries</span>
            <button onClick={() => setParams(p => ({ ...p, skip: Number(p.skip || 0) + 100 }))}
              className="text-xs text-indigo-600 hover:underline">Load more</button>
          </div>
        )}
      </div>
    </div>
  )
}
