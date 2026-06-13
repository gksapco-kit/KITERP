import { Fragment, useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAuditLog } from '@/hooks/useCrm'
import { History, ChevronDown, ChevronRight } from 'lucide-react'
import { Pager, LoadingRow, EmptyRow } from './_shared'
import { formatDateTime } from '@/lib/utils'

export default function AuditPage() {
  const [page, setPage] = useState(1)
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const { data, isLoading } = useAuditLog({
    page, size: 25,
    entity: entity || undefined,
    action: action || undefined,
  })

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><History className="w-6 h-6 text-blue-500" /> Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Every CRUD Action Against CRM Data Is Recorded Here For Compliance.</p>
      </div>

      <Card><CardContent className="pt-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500">Entity</label>
            <Input value={entity} onChange={e => { setEntity(e.target.value); setPage(1) }} placeholder="contact, lead, deal…" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Action</label>
            <Input value={action} onChange={e => { setAction(e.target.value); setPage(1) }} placeholder="create, update, delete" />
          </div>
        </div>
      </CardContent></Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="w-8"></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>When</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Actor</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Action</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase"><TableColumnLabel>Entity</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell"><TableColumnLabel>Path</TableColumnLabel></th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell"><TableColumnLabel>IP</TableColumnLabel></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? <LoadingRow cols={7} /> : !data?.items?.length ? (
                <EmptyRow cols={7} message="No audit entries match." />
              ) : data.items.map(a => {
                const expanded = open === a.id
                return (
                  <Fragment key={a.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-2 cursor-pointer" onClick={() => setOpen(expanded ? null : a.id)}>
                        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDateTime(a.created_at)}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className="text-gray-800">{a.actor_type}</span>
                        {a.actor_id && <p className="font-mono text-gray-400 text-xs">{a.actor_id.slice(0, 8)}</p>}
                      </td>
                      <td className="px-4 py-3"><Badge variant={a.action === 'delete' ? 'destructive' : a.action === 'create' ? 'success' : 'soft'}>{a.action}</Badge></td>
                      <td className="px-4 py-3 text-xs">
                        <span className="font-medium">{a.entity}</span>
                        {a.entity_id && <p className="font-mono text-gray-400 text-xs">{a.entity_id.slice(0, 8)}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 hidden lg:table-cell font-mono">{a.request_path || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden xl:table-cell">{a.ip || '—'}</td>
                    </tr>
                    {expanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="font-semibold text-gray-700 mb-1">Before</p>
                              <pre className="bg-white border rounded-md p-2 overflow-x-auto">{JSON.stringify(a.before ?? null, null, 2)}</pre>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700 mb-1">After</p>
                              <pre className="bg-white border rounded-md p-2 overflow-x-auto">{JSON.stringify(a.after ?? null, null, 2)}</pre>
                            </div>
                          </div>
                          {a.user_agent && <p className="text-xs text-gray-400 mt-2">{a.user_agent}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} />
        </CardContent>
      </Card>
    </div>
  )
}
