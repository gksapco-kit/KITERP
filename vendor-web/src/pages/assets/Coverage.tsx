import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { COVERAGE_TYPES, useAm, useAmMutation, useAssetPerms, type Row } from './api'
import { CoverageDialog } from './dialogs'
import { DataTable, Loading, PageHeader, Sel, StatusBadge, fmtDate, money } from './ui'

export default function Coverage() {
  const nav = useNavigate()
  const perms = useAssetPerms()
  const [type, setType] = useState('')
  const [state, setState] = useState('')
  const [dlg, setDlg] = useState<null | 'new' | Row>(null)
  const { data = [], isLoading } = useAm<Row[]>('/coverage', { coverage_type: type || undefined, state: state || undefined })
  const del = useAmMutation({ success: 'Removed' })
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Warranty, Insurance & AMC" subtitle="Know what is covered, and get a reminder before cover runs out."
        actions={perms.manage ? <Button onClick={() => setDlg('new')}><Plus className="h-4 w-4" /> Add cover</Button> : null} />
      <div className="mb-4 grid max-w-xl gap-3 sm:grid-cols-2">
        <Sel value={type} onChange={setType} blank="All types" options={COVERAGE_TYPES.map((c) => ({ value: c, label: c === 'amc' ? 'AMC' : c[0].toUpperCase() + c.slice(1) }))} />
        <Sel value={state} onChange={setState} blank="Any state" options={[{ value: 'active', label: 'Active' }, { value: 'expiring', label: 'Expiring soon' }, { value: 'expired', label: 'Expired' }]} />
      </div>
      {isLoading ? <Loading /> : (
        <DataTable rows={data} empty="No cover recorded." onRow={(c) => nav(`/assets/register/${c.asset_id}`)}
          cols={[
            { key: 'asset', header: 'Asset', render: (c) => <span><span className="font-mono font-semibold">{c.asset_tag}</span> {c.asset_name}</span> },
            { key: 'coverage_type', header: 'Type', render: (c) => (c.coverage_type === 'amc' ? 'AMC' : c.coverage_type[0].toUpperCase() + c.coverage_type.slice(1)) },
            { key: 'provider', header: 'Provider' },
            { key: 'reference_no', header: 'Reference' },
            { key: 'end_date', header: 'Ends', render: (c) => fmtDate(c.end_date) },
            { key: 'state', header: 'State', render: (c) => <span className="inline-flex items-center gap-2"><StatusBadge value={c.state} />{c.days_left != null && c.state !== 'expired' ? <span className="text-xs text-muted-foreground">{c.days_left}d</span> : null}</span> },
            { key: 'cost', header: 'Cost', className: 'text-right', render: (c) => money(c.cost) },
            { key: 'act', header: '', render: (c) => perms.manage ? (
              <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button size="xs" variant="outline" onClick={() => setDlg(c)}>Edit</Button>
                <Button size="xs" variant="ghost" onClick={() => { if (window.confirm('Remove this cover?')) del.mutate({ method: 'delete', path: `/coverage/${c.id}` }) }}>Delete</Button>
              </span>) : null },
          ]} />
      )}
      {dlg ? <CoverageDialog coverage={dlg === 'new' ? undefined : dlg} onClose={() => setDlg(null)} /> : null}
    </div>
  )
}
