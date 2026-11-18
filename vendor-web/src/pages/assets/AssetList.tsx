import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, Landmark, Plus, Printer, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { extractApiError } from '@/lib/errorMessages'
import { openBlob, STATUS_LABEL, useAm, useAmMutation, useAssetPerms, type Page, type Row } from './api'
import {
  CategorySelect, DataTable, Dialog, ErrorNote, LocationSelect, PageHeader, Pager, Pill, Sel, StatusBadge,
  money, useDebounced, type Col,
} from './ui'

const SIZE = 50

export default function AssetList() {
  const nav = useNavigate()
  const perms = useAssetPerms()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [status, setStatus] = useState(sp.get('status') ?? '')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [labelOpen, setLabelOpen] = useState(false)
  const dq = useDebounced(q)

  const params = useMemo(() => ({
    q: dq || undefined, status: status || undefined, category_id: category || undefined,
    location_id: location || undefined, page, size: SIZE,
  }), [dq, status, category, location, page])
  const { data, isLoading, error } = useAm<Page>('', params)
  const importFin = useAmMutation({
    onSuccess: (r) => toast.success(`Imported ${r.created ?? 0} asset(s) from Finance${r.skipped ? `, ${r.skipped} already present` : ''}`),
  })

  const items = data?.items ?? []
  const allOnPage = items.length > 0 && items.every((a) => picked.has(a.id))
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleAll = () => setPicked((s) => {
    const n = new Set(s)
    if (allOnPage) items.forEach((a) => n.delete(a.id)); else items.forEach((a) => n.add(a.id))
    return n
  })

  const reset = (fn: () => void) => { fn(); setPage(1); const p = new URLSearchParams(sp); p.delete('status'); setSp(p, { replace: true }) }

  const cols: Col[] = [
    { key: 'sel', header: <input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select page" />,
      className: 'w-8', render: (a) => <span onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={picked.has(a.id)} onChange={() => toggle(a.id)} /></span> },
    { key: 'asset_tag', header: 'Tag', render: (a) => <span className="font-mono font-semibold">{a.asset_tag}</span> },
    { key: 'name', header: 'Asset', render: (a) => (
      <div><div className="font-medium">{a.name}</div><div className="text-xs text-muted-foreground">{[a.manufacturer, a.model].filter(Boolean).join(' ') || a.serial_number || ''}</div></div>) },
    { key: 'category_name', header: 'Category' },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge value={a.status} /> },
    { key: 'holder', header: 'Held by / location', render: (a) => a.employee_name || a.department_name || a.location_name || a.store_name || '—' },
    { key: 'acquisition_cost', header: 'Cost', className: 'text-right', render: (a) => money(a.acquisition_cost) },
    { key: 'fin', header: 'Finance', render: (a) => a.is_capitalized ? <Pill tone="green">Capitalised</Pill> : <span className="text-muted-foreground">—</span> },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Asset Register"
        subtitle="Every physical asset, with its current holder and status."
        actions={
          <>
            {picked.size ? <Button variant="outline" onClick={() => setLabelOpen(true)}><Printer className="h-4 w-4" /> Labels ({picked.size})</Button> : null}
            <Button variant="outline" onClick={() => openBlob('get', '/export.csv', { params: { q: dq, status, category_id: category, location_id: location }, filename: 'assets.csv' }).catch((e) => toast.error(extractApiError(e, 'Export failed')))}>
              <Download className="h-4 w-4" /> Export
            </Button>
            {perms.manage ? <Button variant="outline" onClick={() => nav('/assets/import')}><Upload className="h-4 w-4" /> Import</Button> : null}
            {perms.finance ? (
              <Button variant="outline" disabled={importFin.isPending} onClick={() => importFin.mutate({ path: '/finance/import' })}>
                <Landmark className="h-4 w-4" /> Import from Finance
              </Button>
            ) : null}
            {perms.manage ? <Button onClick={() => nav('/assets/register/new')}><Plus className="h-4 w-4" /> Register asset</Button> : null}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Search tag, name, serial, barcode…" value={q} onChange={(e) => reset(() => setQ(e.target.value))} />
        <Sel value={status} onChange={(v) => reset(() => setStatus(v))} blank="All statuses"
          options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        <CategorySelect value={category} onChange={(v) => reset(() => setCategory(v))} blank="All categories" />
        <LocationSelect value={location} onChange={(v) => reset(() => setLocation(v))} blank="All locations" />
      </div>

      {error ? <ErrorNote error={error} /> : (
        <>
          <DataTable cols={cols} rows={items} onRow={(a) => nav(`/assets/register/${a.id}`)}
            empty={isLoading ? 'Loading…' : 'No assets match. Register one, or import a spreadsheet.'} />
          <Pager page={page} size={SIZE} total={data?.total ?? 0} onPage={setPage} />
        </>
      )}

      {labelOpen ? <LabelDialog ids={[...picked]} onClose={() => setLabelOpen(false)} /> : null}
    </div>
  )
}

function LabelDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const [size, setSize] = useState('medium')
  const [company, setCompany] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      await openBlob('post', '/labels', { body: { asset_ids: ids, size, company: company || undefined }, inline: true })
      onClose()
    } catch (e) {
      toast.error(extractApiError(e, 'Could not build labels'))
    } finally { setBusy(false) }
  }
  return (
    <Dialog title={`Print ${ids.length} label(s)`} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button><Button onClick={go} disabled={busy}>{busy ? 'Building…' : 'Open PDF'}</Button></>}>
      <p className="text-sm text-muted-foreground">Each label carries a QR code and a barcode of the asset tag. Scanning either finds the asset.</p>
      <label className="block space-y-1"><span className="text-sm font-medium">Label size</span>
        <Sel value={size} onChange={setSize} options={[{ value: 'small', label: 'Small (50 × 25 mm)' }, { value: 'medium', label: 'Medium (70 × 35 mm)' }, { value: 'large', label: 'Large (100 × 50 mm)' }]} />
      </label>
      <label className="block space-y-1"><span className="text-sm font-medium">Company name on label (optional)</span>
        <Input value={company} maxLength={60} onChange={(e) => setCompany(e.target.value)} />
      </label>
    </Dialog>
  )
}
