import { useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LOCATION_TYPES, useAm, useAmMutation, useAssetPerms, type Row } from './api'
import { Check, DataTable, Dialog, Field, Loading, LocationSelect, PageHeader, Pill, Sel, StoreSelect, TextArea, Tabs, optList, titleCase } from './ui'

type Tab = 'categories' | 'locations'

export default function AssetSettings() {
  const [tab, setTab] = useState<Tab>('categories')
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Asset Settings" subtitle="Categories decide what an asset is. Locations decide where it lives." />
      <Tabs tabs={[{ id: 'categories', label: 'Categories' }, { id: 'locations', label: 'Locations' }]} value={tab} onChange={setTab} />
      {tab === 'categories' ? <Categories /> : <Locations />}
    </div>
  )
}

/* ── categories ─────────────────────────────────────────────────────────────── */
function Categories() {
  const perms = useAssetPerms()
  const { data = [], isLoading } = useAm<Row[]>('/categories')
  const [dlg, setDlg] = useState<null | 'new' | Row>(null)
  const del = useAmMutation({ success: 'Category removed' })
  return (
    <div className="space-y-3">
      {perms.manage ? <div className="flex justify-end"><Button onClick={() => setDlg('new')}><Plus className="h-4 w-4" /> New category</Button></div> : null}
      {isLoading ? <Loading /> : (
        <DataTable rows={data} empty="No categories yet. Add one before registering assets."
          cols={[
            { key: 'name', header: 'Category', render: (c) => <span className="font-medium">{c.name}</span> },
            { key: 'code', header: 'Code' },
            { key: 'flags', header: 'Flags', render: (c) => (
              <span className="flex flex-wrap gap-1">
                {c.is_it_asset ? <Pill tone="blue">IT</Pill> : null}
                {c.is_capitalizable ? <Pill tone="green">Capitalise</Pill> : null}
                {c.requires_serial ? <Pill>Serial</Pill> : null}
                {!c.is_active ? <Pill tone="red">Inactive</Pill> : null}
              </span>) },
            { key: 'default_useful_life_years', header: 'Life (yrs)' },
            { key: 'default_depreciation_method', header: 'Depreciation', render: (c) => titleCase(c.default_depreciation_method) },
            { key: 'act', header: '', render: (c) => perms.manage ? (
              <span className="flex gap-1">
                <Button size="xs" variant="outline" onClick={() => setDlg(c)}>Edit</Button>
                <Button size="xs" variant="ghost" onClick={() => { if (window.confirm(`Delete ${c.name}?`)) del.mutate({ method: 'delete', path: `/categories/${c.id}` }) }}>Delete</Button>
              </span>) : null },
          ]} />
      )}
      {dlg ? <CategoryDialog cat={dlg === 'new' ? undefined : dlg} onClose={() => setDlg(null)} /> : null}
    </div>
  )
}

function CategoryDialog({ cat, onClose }: { cat?: Row; onClose: () => void }) {
  const perms = useAssetPerms()
  const { data: finCats = [] } = useAm<Row[]>('/pickers/fin-categories', undefined, { enabled: perms.finance })
  const [f, setF] = useState({
    name: cat?.name ?? '', code: cat?.code ?? '', parent_id: cat?.parent_id ?? '', description: cat?.description ?? '',
    is_it_asset: !!cat?.is_it_asset, is_capitalizable: cat?.is_capitalizable ?? true, requires_serial: !!cat?.requires_serial,
    fin_category_id: cat?.fin_category_id ?? '', default_useful_life_years: cat?.default_useful_life_years != null ? String(cat.default_useful_life_years) : '',
    default_depreciation_method: cat?.default_depreciation_method ?? '', is_active: cat?.is_active ?? true,
  })
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }))
  const { data: all = [] } = useAm<Row[]>('/categories')
  const m = useAmMutation({ success: cat ? 'Category updated' : 'Category added', onSuccess: onClose })
  const submit = () => {
    if (!f.name.trim()) return toast.error('Category name is required')
    m.mutate({
      method: cat ? 'put' : 'post', path: cat ? `/categories/${cat.id}` : '/categories',
      body: {
        name: f.name.trim(), code: f.code || null, parent_id: f.parent_id || null, description: f.description || null,
        is_it_asset: f.is_it_asset, is_capitalizable: f.is_capitalizable, requires_serial: f.requires_serial,
        is_active: f.is_active,
        // Finance mapping is only editable by finance users; others must not overwrite it.
        ...(perms.finance ? {
          fin_category_id: f.fin_category_id || null,
          default_useful_life_years: f.default_useful_life_years === '' ? null : Number(f.default_useful_life_years),
          default_depreciation_method: f.default_depreciation_method || null,
        } : {}),
      },
    })
  }
  return (
    <Dialog title={cat ? 'Edit category' : 'New category'} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button><Button disabled={m.isPending} onClick={submit}>{m.isPending ? 'Saving…' : 'Save'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Code"><Input value={f.code} maxLength={20} onChange={(e) => set('code', e.target.value)} /></Field>
        <Field label="Parent category" className="sm:col-span-2">
          <Sel value={f.parent_id} onChange={(v) => set('parent_id', v)} blank="None (top level)" options={all.filter((c) => c.id !== cat?.id).map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
      </div>
      <Field label="Description"><TextArea value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Check checked={f.is_it_asset} onChange={(v) => set('is_it_asset', v)} label="IT asset" />
        <Check checked={f.is_capitalizable} onChange={(v) => set('is_capitalizable', v)} label="Capitalise in Finance" />
        <Check checked={f.requires_serial} onChange={(v) => set('requires_serial', v)} label="Serial number required" />
        <Check checked={f.is_active} onChange={(v) => set('is_active', v)} label="Active" />
      </div>
      {perms.finance ? (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="text-sm font-semibold">Finance link</div>
          <Field label="Finance asset category" hint="Sets the GL accounts and depreciation used when an asset is capitalised.">
            <Sel value={f.fin_category_id} onChange={(v) => set('fin_category_id', v)} blank="Not linked" options={finCats.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Default useful life (years)"><Input type="number" min={0} value={f.default_useful_life_years} onChange={(e) => set('default_useful_life_years', e.target.value)} /></Field>
            <Field label="Depreciation method"><Sel value={f.default_depreciation_method} onChange={(v) => set('default_depreciation_method', v)} blank="Use Finance default" options={[{ value: 'straight_line', label: 'Straight line' }, { value: 'wdv', label: 'Written-down value' }]} /></Field>
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}

/* ── locations ──────────────────────────────────────────────────────────────── */
function Locations() {
  const perms = useAssetPerms()
  const { data = [], isLoading } = useAm<Row[]>('/locations')
  const [dlg, setDlg] = useState<null | 'new' | Row>(null)
  const del = useAmMutation({ success: 'Location removed' })
  return (
    <div className="space-y-3">
      {perms.manage ? <div className="flex justify-end"><Button onClick={() => setDlg('new')}><Plus className="h-4 w-4" /> New location</Button></div> : null}
      {isLoading ? <Loading /> : (
        <DataTable rows={data} empty="No locations yet."
          cols={[
            { key: 'path', header: 'Location', render: (l) => <span className="font-medium">{l.path || l.name}</span> },
            { key: 'code', header: 'Code' },
            { key: 'location_type', header: 'Type', render: (l) => titleCase(l.location_type) },
            { key: 'asset_count', header: 'Assets', className: 'text-right' },
            { key: 'is_active', header: 'Status', render: (l) => (l.is_active ? <Pill tone="green">Active</Pill> : <Pill>Inactive</Pill>) },
            { key: 'act', header: '', render: (l) => perms.manage ? (
              <span className="flex gap-1">
                <Button size="xs" variant="outline" onClick={() => setDlg(l)}>Edit</Button>
                <Button size="xs" variant="ghost" onClick={() => { if (window.confirm(`Delete ${l.name}?`)) del.mutate({ method: 'delete', path: `/locations/${l.id}` }) }}>Delete</Button>
              </span>) : null },
          ]} />
      )}
      {dlg ? <LocationDialog loc={dlg === 'new' ? undefined : dlg} onClose={() => setDlg(null)} /> : null}
    </div>
  )
}

function LocationDialog({ loc, onClose }: { loc?: Row; onClose: () => void }) {
  const [f, setF] = useState({
    name: loc?.name ?? '', code: loc?.code ?? '', parent_id: loc?.parent_id ?? '', location_type: loc?.location_type ?? 'room',
    store_id: loc?.store_id ?? '', address: loc?.address ?? '', is_active: loc?.is_active ?? true,
  })
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }))
  const m = useAmMutation({ success: loc ? 'Location updated' : 'Location added', onSuccess: onClose })
  const submit = () => {
    if (!f.name.trim()) return toast.error('Location name is required')
    m.mutate({
      method: loc ? 'put' : 'post', path: loc ? `/locations/${loc.id}` : '/locations',
      body: { name: f.name.trim(), code: f.code || null, parent_id: f.parent_id || null, location_type: f.location_type, store_id: f.store_id || null, address: f.address || null, is_active: f.is_active },
    })
  }
  return (
    <Dialog title={loc ? 'Edit location' : 'New location'} onClose={onClose}
      footer={<><Button variant="cancel" onClick={onClose}>Cancel</Button><Button disabled={m.isPending} onClick={submit}>{m.isPending ? 'Saving…' : 'Save'}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Code"><Input value={f.code} maxLength={20} onChange={(e) => set('code', e.target.value)} /></Field>
        <Field label="Type"><Sel value={f.location_type} onChange={(v) => set('location_type', v)} options={optList(LOCATION_TYPES)} /></Field>
        <Field label="Inside"><LocationSelect value={f.parent_id} onChange={(v) => set('parent_id', v)} blank="Top level" /></Field>
        <Field label="Linked store" hint="Optional link to an inventory store." className="sm:col-span-2"><StoreSelect value={f.store_id} onChange={(v) => set('store_id', v)} blank="None" /></Field>
      </div>
      <Field label="Address"><TextArea value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
      <Check checked={f.is_active} onChange={(v) => set('is_active', v)} label="Active" />
    </Dialog>
  )
}
