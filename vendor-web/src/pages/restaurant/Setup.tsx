import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Copy, ExternalLink, Loader2, Pencil, Plus, QrCode, Trash2, X } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { useMyVendor } from '@/hooks/useVendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'

function getTableQRUrl(vendorSlug: string, qrToken: string) {
  return `${getCustomerStorefrontBaseUrl(vendorSlug)}/table/${qrToken}`
}

function TableQRSection({ table, vendorSlug }: { table: { id: string; label: string; qr_token?: string | null }; vendorSlug?: string }) {
  const qc = useQueryClient()
  const genQR = useMutation({
    mutationFn: () => vendorApi.restaurantGenerateQR(table.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] }); toast.success('QR token generated') },
    onError: () => toast.error('Could not generate QR'),
  })

  const qrUrl = table.qr_token && vendorSlug ? getTableQRUrl(vendorSlug, table.qr_token) : null

  return (
    <div className="mt-1 flex items-center gap-2 flex-wrap">
      {qrUrl ? (
        <>
          <a
            href={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrUrl)}`}
            target="_blank" rel="noreferrer"
            className="block w-10 h-10 border rounded overflow-hidden shrink-0 hover:opacity-80"
            title="Click to open full-size QR code (right-click → Save to print)"
          >
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qrUrl)}`}
              alt="QR"
              className="w-full h-full"
            />
          </a>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(qrUrl); toast.success('URL copied') }}
            className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1"
          >
            <Copy className="w-3 h-3" /> Copy URL
          </button>
          <a
            href={qrUrl}
            target="_blank" rel="noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-0.5"
          >
            <ExternalLink className="w-3 h-3" /> Test menu
          </a>
        </>
      ) : (
        <button
          type="button"
          onClick={() => genQR.mutate()}
          disabled={genQR.isPending}
          className="text-xs text-gray-400 hover:text-primary flex items-center gap-1"
        >
          {genQR.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <QrCode className="w-3 h-3" />}
          Generate QR
        </button>
      )}
    </div>
  )
}

interface TableRow {
  id: string
  label: string
  zone_id?: string | null
  zone_name?: string | null
  capacity: number
  sort_order: number
  is_active: boolean
  qr_token?: string | null
}

function TableEditRow({ table, zones, vendorSlug, onDelete }: {
  table: TableRow
  zones: Array<{ id: string; name: string }>
  vendorSlug?: string
  onDelete: () => void
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(table.label)
  const [capacity, setCapacity] = useState(String(table.capacity))
  const [zoneId, setZoneId] = useState(table.zone_id ?? '')

  const save = useMutation({
    mutationFn: () => vendorApi.restaurantPatchTable(table.id, {
      label: label.trim(),
      capacity: parseInt(capacity) || 4,
      zone_id: zoneId || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] })
      setEditing(false)
      toast.success('Table updated')
    },
    onError: () => toast.error('Could not update table'),
  })

  return (
    <li className="px-3 py-2 text-sm">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="h-8 text-sm w-20"
            placeholder="Label"
          />
          <select
            value={zoneId}
            onChange={e => setZoneId(e.target.value)}
            className="h-8 text-sm border rounded-md px-2 bg-white"
          >
            <option value="">— No zone —</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-400">Seats</label>
            <Input
              type="number"
              min={1}
              max={99}
              value={capacity}
              onChange={e => setCapacity(e.target.value)}
              className="h-8 text-sm w-16"
            />
          </div>
          <Button size="sm" className="h-8 px-2 gap-1" disabled={!label.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
          </Button>
          <button type="button" onClick={() => { setEditing(false); setLabel(table.label); setCapacity(String(table.capacity)); setZoneId(table.zone_id ?? '') }}
            className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span>
            <span className="font-semibold">{table.label}</span>
            <span className="text-gray-400 ml-2">{table.zone_name || '—'}</span>
            <span className="text-gray-400 ml-2">{table.capacity} seats</span>
          </span>
          <div className="flex items-center gap-1">
            <button type="button" className="text-gray-400 hover:text-primary p-1" onClick={() => setEditing(true)} title="Edit">
              <Pencil className="w-4 h-4" />
            </button>
            <button type="button" className="text-gray-400 hover:text-red-500 p-1" onClick={onDelete} title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <TableQRSection table={table} vendorSlug={vendorSlug} />
    </li>
  )
}

export default function RestaurantSetupPage() {
  const qc = useQueryClient()
  const [zoneName, setZoneName] = useState('')
  const [tableLabel, setTableLabel] = useState('')
  const [tableZone, setTableZone] = useState<string>('')
  const [tableCapacity, setTableCapacity] = useState('4')

  const vendorQ = useMyVendor()
  const vendorSlug = vendorQ.data?.slug as string | undefined

  const zonesQ = useQuery({
    queryKey: ['restaurant', 'zones'],
    queryFn: () => vendorApi.restaurantListZones(),
  })
  const tablesQ = useQuery({
    queryKey: ['restaurant', 'tables'],
    queryFn: () => vendorApi.restaurantListTables(),
  })

  const createZone = useMutation({
    mutationFn: () => vendorApi.restaurantCreateZone({ name: zoneName.trim(), sort_order: (zonesQ.data?.items.length ?? 0) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'zones'] })
      setZoneName('')
      toast.success('Zone added')
    },
    onError: () => toast.error('Could not add zone'),
  })

  const delZone = useMutation({
    mutationFn: (id: string) => vendorApi.restaurantDeleteZone(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant'] })
      toast.success('Zone removed')
    },
    onError: () => toast.error('Could not remove zone'),
  })

  const createTable = useMutation({
    mutationFn: () =>
      vendorApi.restaurantCreateTable({
        label: tableLabel.trim(),
        zone_id: tableZone || undefined,
        capacity: parseInt(tableCapacity) || 4,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] })
      setTableLabel('')
      toast.success('Table added')
    },
    onError: () => toast.error('Could not add table'),
  })

  const delTable = useMutation({
    mutationFn: (id: string) => vendorApi.restaurantDeleteTable(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'tables'] })
      toast.success('Table removed')
    },
    onError: () => toast.error('Could not remove table'),
  })

  const zones = zonesQ.data?.items ?? []
  const tables = tablesQ.data?.items ?? []

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/restaurant/floor"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900">Restaurant Setup</h1>
          <p className="text-sm text-gray-500">Manage zones, tables, and QR codes. Configure menu items under Dine-in Menu.</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/restaurant/menu">Dine-in Menu</Link>
        </Button>
      </div>

      {/* Zones */}
      <section className="rounded-xl border bg-white p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Zones</h2>
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="e.g. Patio, Indoor, Rooftop"
            value={zoneName}
            onChange={e => setZoneName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && zoneName.trim()) createZone.mutate() }}
            className="max-w-xs h-9 text-sm"
          />
          <Button size="sm" disabled={!zoneName.trim() || createZone.isPending} onClick={() => createZone.mutate()}>
            {createZone.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add zone</>}
          </Button>
        </div>
        {zonesQ.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : (
          <ul className="divide-y rounded-lg border">
            {zones.map(z => (
              <li key={z.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{z.name}</span>
                <button
                  type="button"
                  className="text-gray-400 hover:text-red-500 p-1"
                  onClick={() => { if (confirm(`Delete zone "${z.name}"? All tables in it will lose their zone.`)) delZone.mutate(z.id) }}
                  title="Delete zone"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
            {!zones.length && (
              <li className="px-3 py-6 text-center text-gray-400 text-sm">
                No zones — tables can be added without a zone.
              </li>
            )}
          </ul>
        )}
      </section>

      {/* Tables */}
      <section className="rounded-xl border bg-white p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Tables</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs uppercase text-gray-400 font-semibold block mb-1">Label *</label>
            <Input
              placeholder="T1, A3, Bar-1…"
              value={tableLabel}
              onChange={e => setTableLabel(e.target.value)}
              className="h-9 text-sm w-28"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-gray-400 font-semibold block mb-1">Seats</label>
            <Input
              type="number"
              min={1}
              max={99}
              value={tableCapacity}
              onChange={e => setTableCapacity(e.target.value)}
              className="h-9 text-sm w-16"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-gray-400 font-semibold block mb-1">Zone</label>
            <select
              value={tableZone}
              onChange={e => setTableZone(e.target.value)}
              className="h-9 text-sm border rounded-md px-2 bg-white min-w-[140px]"
            >
              <option value="">— None —</option>
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </div>
          <Button size="sm" disabled={!tableLabel.trim() || createTable.isPending} onClick={() => createTable.mutate()}>
            {createTable.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add table</>}
          </Button>
        </div>
        {tablesQ.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : (
          <ul className="divide-y rounded-lg border">
            {tables.map(t => (
              <TableEditRow
                key={t.id}
                table={t as TableRow}
                zones={zones}
                vendorSlug={vendorSlug}
                onDelete={() => { if (confirm(`Delete table "${t.label}"?`)) delTable.mutate(t.id) }}
              />
            ))}
            {!tables.length && (
              <li className="px-3 py-6 text-center text-gray-400 text-sm">No tables yet.</li>
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
