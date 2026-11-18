import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CONDITIONS, useAm, useAmMutation, useAssetPerms, type Row } from './api'
import {
  CategorySelect, Check, ErrorNote, Field, Loading, LocationSelect, PageHeader, Panel, Sel, StoreSelect, TextArea,
  optList,
} from './ui'

type Form = {
  name: string; category_id: string; condition: string; serial_number: string; barcode: string
  manufacturer: string; model: string; description: string; acquisition_date: string
  acquisition_cost: string; salvage_value: string; supplier_name: string; purchase_ref: string
  location_id: string; store_id: string; is_reservable: boolean; meter_reading: string; meter_unit: string; notes: string
}

const EMPTY: Form = {
  name: '', category_id: '', condition: 'new', serial_number: '', barcode: '', manufacturer: '', model: '',
  description: '', acquisition_date: '', acquisition_cost: '', salvage_value: '', supplier_name: '', purchase_ref: '',
  location_id: '', store_id: '', is_reservable: false, meter_reading: '', meter_unit: '', notes: '',
}

const IT_HINTS = ['IP address', 'MAC address', 'Operating system', 'RAM', 'Storage', 'Processor']

export default function AssetForm() {
  const nav = useNavigate()
  const { assetId } = useParams()
  const editing = Boolean(assetId)
  const perms = useAssetPerms()
  const [f, setF] = useState<Form>(EMPTY)
  const [attrs, setAttrs] = useState<{ k: string; v: string }[]>([])
  const [quantity, setQuantity] = useState('1')
  const [serials, setSerials] = useState('')
  const [capitalize, setCapitalize] = useState(false)
  const [cap, setCap] = useState({ fin_category_id: '', useful_life_years: '', depreciation_method: '', post_gl: true })

  const { data: asset, isLoading, error } = useAm<Row>(`/${assetId}`, undefined, { enabled: editing })
  const { data: cats = [] } = useAm<Row[]>('/categories')
  const { data: finCats = [] } = useAm<Row[]>('/pickers/fin-categories', undefined, { enabled: perms.finance && !editing })

  useEffect(() => {
    if (!asset) return
    setF({
      name: asset.name ?? '', category_id: asset.category_id ?? '', condition: asset.condition ?? 'good',
      serial_number: asset.serial_number ?? '', barcode: asset.barcode ?? '', manufacturer: asset.manufacturer ?? '',
      model: asset.model ?? '', description: asset.description ?? '', acquisition_date: asset.acquisition_date ?? '',
      acquisition_cost: asset.acquisition_cost != null ? String(asset.acquisition_cost) : '',
      salvage_value: asset.salvage_value != null ? String(asset.salvage_value) : '',
      supplier_name: asset.supplier_name ?? '', purchase_ref: asset.purchase_ref ?? '',
      location_id: asset.location_id ?? '', store_id: asset.store_id ?? '', is_reservable: !!asset.is_reservable,
      meter_reading: asset.meter_reading != null ? String(asset.meter_reading) : '', meter_unit: asset.meter_unit ?? '',
      notes: asset.notes ?? '',
    })
    setAttrs(Object.entries((asset.attributes as Record<string, unknown>) ?? {}).map(([k, v]) => ({ k, v: String(v ?? '') })))
  }, [asset])

  const category = useMemo(() => cats.find((c) => c.id === f.category_id), [cats, f.category_id])
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }))

  const save = useAmMutation({
    success: editing ? 'Asset updated' : 'Asset registered',
    onSuccess: (r) => {
      if (editing) nav(`/assets/register/${assetId}`)
      else if (r?.items) nav('/assets/register')
      else nav(`/assets/register/${r?.id}`)
    },
  })

  const submit = () => {
    if (!f.name.trim()) return toast.error('Give the asset a name')
    const attributes: Record<string, string> = {}
    attrs.forEach(({ k, v }) => { if (k.trim()) attributes[k.trim()] = v })
    const body: Record<string, unknown> = {
      name: f.name.trim(), category_id: f.category_id || null, condition: f.condition,
      serial_number: f.serial_number || null, barcode: f.barcode || null, manufacturer: f.manufacturer || null,
      model: f.model || null, description: f.description || null, acquisition_date: f.acquisition_date || null,
      acquisition_cost: f.acquisition_cost === '' ? 0 : Number(f.acquisition_cost),
      salvage_value: f.salvage_value === '' ? 0 : Number(f.salvage_value),
      supplier_name: f.supplier_name || null, purchase_ref: f.purchase_ref || null,
      location_id: f.location_id || null, store_id: f.store_id || null, is_reservable: f.is_reservable,
      meter_reading: f.meter_reading === '' ? null : Number(f.meter_reading), meter_unit: f.meter_unit || null,
      notes: f.notes || null, attributes,
    }
    if (editing) return save.mutate({ method: 'put', path: `/${assetId}`, body })
    const list = serials.split('\n').map((s) => s.trim()).filter(Boolean)
    if (list.length) body.serial_numbers = list
    else body.quantity = Math.max(1, Number(quantity) || 1)
    if (capitalize) {
      if (!(Number(f.acquisition_cost) > 0)) return toast.error('Enter the acquisition cost to capitalise')
      body.capitalize = {
        fin_category_id: cap.fin_category_id || undefined,
        useful_life_years: cap.useful_life_years ? Number(cap.useful_life_years) : undefined,
        depreciation_method: cap.depreciation_method || undefined, post_gl: cap.post_gl,
      }
    }
    save.mutate({ path: '', body })
  }

  if (editing && isLoading) return <Loading />
  if (editing && error) return <ErrorNote error={error} />

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title={editing ? `Edit ${asset?.asset_tag ?? 'asset'}` : 'Register asset'}
        subtitle={editing ? undefined : 'The asset tag is generated automatically and printed on the QR label.'} />

      <Panel title="Identity">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2"><Input value={f.name} maxLength={200} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Category"><CategorySelect value={f.category_id} onChange={(v) => set('category_id', v)} blank="No category" /></Field>
          <Field label="Condition"><Sel value={f.condition} onChange={(v) => set('condition', v)} options={optList(CONDITIONS)} /></Field>
          <Field label="Manufacturer"><Input value={f.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} /></Field>
          <Field label="Model"><Input value={f.model} onChange={(e) => set('model', e.target.value)} /></Field>
          {editing || (Number(quantity) <= 1 && !serials.trim()) ? (
            <Field label="Serial number" required={!!category?.requires_serial}><Input value={f.serial_number} onChange={(e) => set('serial_number', e.target.value)} /></Field>
          ) : null}
          <Field label="Barcode (existing, optional)" hint="A manufacturer or legacy barcode. It can be scanned too."><Input value={f.barcode} onChange={(e) => set('barcode', e.target.value)} /></Field>
          <Field label="Description" className="sm:col-span-2"><TextArea value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        </div>
        {!editing ? (
          <div className="mt-3 grid gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2">
            <Field label="Quantity" hint="Registers that many identical units, each with its own tag.">
              <Input type="number" min={1} max={500} value={quantity} disabled={!!serials.trim()} onChange={(e) => setQuantity(e.target.value)} />
            </Field>
            <Field label="Or paste serial numbers (one per line)" hint="One asset is created per serial.">
              <TextArea value={serials} onChange={(e) => setSerials(e.target.value)} placeholder={'SN-001\nSN-002'} />
            </Field>
          </div>
        ) : null}
      </Panel>

      <Panel title="Acquisition">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Acquisition date"><Input type="date" value={f.acquisition_date} onChange={(e) => set('acquisition_date', e.target.value)} /></Field>
          <Field label="Cost"><Input type="number" min={0} step="0.01" value={f.acquisition_cost} onChange={(e) => set('acquisition_cost', e.target.value)} /></Field>
          <Field label="Salvage value"><Input type="number" min={0} step="0.01" value={f.salvage_value} onChange={(e) => set('salvage_value', e.target.value)} /></Field>
          <Field label="Supplier"><Input value={f.supplier_name} onChange={(e) => set('supplier_name', e.target.value)} /></Field>
          <Field label="PO / invoice reference"><Input value={f.purchase_ref} onChange={(e) => set('purchase_ref', e.target.value)} /></Field>
        </div>
        {!editing && perms.finance ? (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <Check checked={capitalize} onChange={setCapitalize} label="Also capitalise in Finance (creates the fixed asset and the acquisition journal)" />
            {capitalize ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Finance asset category" hint="Decides the GL accounts and depreciation defaults.">
                  <Sel value={cap.fin_category_id} onChange={(v) => setCap((s) => ({ ...s, fin_category_id: v }))} blank="Use the category's default"
                    options={finCats.map((c) => ({ value: c.id, label: c.name }))} />
                </Field>
                <Field label="Useful life (years)"><Input type="number" min={1} value={cap.useful_life_years} onChange={(e) => setCap((s) => ({ ...s, useful_life_years: e.target.value }))} placeholder="From category" /></Field>
                <Field label="Depreciation method">
                  <Sel value={cap.depreciation_method} onChange={(v) => setCap((s) => ({ ...s, depreciation_method: v }))} blank="From category"
                    options={[{ value: 'straight_line', label: 'Straight line' }, { value: 'wdv', label: 'Written down value' }, { value: 'units_of_production', label: 'Units of production' }]} />
                </Field>
                <div className="flex items-end"><Check checked={cap.post_gl} onChange={(v) => setCap((s) => ({ ...s, post_gl: v }))} label="Post the acquisition journal now" /></div>
              </div>
            ) : <p className="text-xs text-muted-foreground">You can also capitalise later from the asset page.</p>}
          </div>
        ) : null}
      </Panel>

      <Panel title="Where">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Location"><LocationSelect value={f.location_id} onChange={(v) => set('location_id', v)} blank="No location" /></Field>
          <Field label="Store / branch"><StoreSelect value={f.store_id} onChange={(v) => set('store_id', v)} blank="No store" /></Field>
        </div>
      </Panel>

      <Panel title="Usage">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-end sm:col-span-3"><Check checked={f.is_reservable} onChange={(v) => set('is_reservable', v)} label="Shared asset: staff can book it for a time slot (meeting room, pool car, projector)" /></div>
          <Field label="Meter reading" hint="Odometer or hour counter, for meter-based maintenance."><Input type="number" min={0} value={f.meter_reading} onChange={(e) => set('meter_reading', e.target.value)} /></Field>
          <Field label="Meter unit"><Input value={f.meter_unit} maxLength={20} placeholder="km, hours…" onChange={(e) => set('meter_unit', e.target.value)} /></Field>
        </div>
      </Panel>

      <Panel title="Specifications" actions={<Button variant="outline" size="sm" onClick={() => setAttrs((a) => [...a, { k: '', v: '' }])}><Plus className="h-4 w-4" /> Add</Button>}>
        {category?.is_it_asset && attrs.length === 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {IT_HINTS.map((h) => <Button key={h} variant="soft" size="xs" onClick={() => setAttrs((a) => [...a, { k: h, v: '' }])}>+ {h}</Button>)}
          </div>
        ) : null}
        {attrs.length ? (
          <div className="space-y-2">
            {attrs.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                <Input placeholder="Name" value={row.k} onChange={(e) => setAttrs((a) => a.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
                <Input placeholder="Value" value={row.v} onChange={(e) => setAttrs((a) => a.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
                <Button variant="ghost" size="icon" onClick={() => setAttrs((a) => a.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">Free-form details such as colour, capacity or IP address.</p>}
        <Field label="Notes" className="mt-4"><TextArea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </Panel>

      <div className="flex justify-end gap-2 pb-6">
        <Button variant="cancel" onClick={() => nav(editing ? `/assets/register/${assetId}` : '/assets/register')}>Cancel</Button>
        <Button onClick={submit} disabled={save.isPending}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Register'}</Button>
      </div>
    </div>
  )
}
