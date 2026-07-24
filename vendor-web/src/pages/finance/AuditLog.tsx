import { useState } from 'react'
import { useAuditLog } from '@/hooks/useFinance'
import { Shield } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500/15 text-green-700 dark:text-green-300',
  update: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  delete: 'bg-red-500/15 text-red-600 dark:text-red-300',
  post: 'bg-primary/15 text-primary',
  void: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  approve: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  reject: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
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
        <Shield className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <span className="text-sm text-muted-foreground">{total} total entries</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Entity type…"
          value={filter.entity_type}
          onChange={e => setFilter(f => ({ ...f, entity_type: e.target.value }))}
          className="h-10 w-40"
        />
        <Select
          value={filter.action}
          onChange={(v) => setFilter(f => ({ ...f, action: v }))}
          options={selectOptionsWithBlank('All Actions', ['create', 'update', 'delete', 'post', 'void', 'approve', 'reject'].map(a => ({
            value: a,
            label: a.charAt(0).toUpperCase() + a.slice(1),
          })))}
          placeholder="All Actions"
          aria-label="Action filter"
          className="w-40"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              {['Timestamp', 'User', 'Action', 'Entity', 'Entity ID', 'Description'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No audit log entries.</td></tr>
            ) : logs.map((log: any) => (
              <tr key={log.id} className="hover:bg-muted/30">
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{log.user_id?.slice(0,8)}…</td>
                <td className="px-4 py-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', ACTION_COLORS[log.action] || 'bg-muted text-muted-foreground')}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs capitalize text-foreground">{log.entity_type}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{log.entity_id?.slice(0,8)}…</td>
                <td className="max-w-[200px] truncate px-4 py-2 text-xs text-foreground">{log.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > 100 && (
          <div className="flex items-center justify-between border-t border-border bg-muted/25 px-4 py-3">
            <span className="text-xs text-muted-foreground">Showing 100 of {total} entries</span>
            <button onClick={() => setParams(p => ({ ...p, skip: Number(p.skip || 0) + 100 }))}
              className="text-xs text-primary hover:underline">Load more</button>
          </div>
        )}
      </div>
    </div>
  )
}
