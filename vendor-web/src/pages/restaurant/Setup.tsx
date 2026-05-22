import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function RestaurantSetupPage() {
  const qc = useQueryClient()
  const [zoneName, setZoneName] = useState('')
  const [tableLabel, setTableLabel] = useState('')
  const [tableZone, setTableZone] = useState<string>('')

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
        capacity: 4,
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
        <div>
          <h1 className="text-xl font-bold text-gray-900">Restaurant Setup</h1>
          <p className="text-sm text-gray-500">Zones group tables for your floor plan.</p>
        </div>
      </div>

      <section className="rounded-xl border bg-white p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Zones</h2>
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="e.g. Patio, Indoor" value={zoneName} onChange={e => setZoneName(e.target.value)} className="max-w-xs h-9 text-sm" />
          <Button size="sm" disabled={!zoneName.trim() || createZone.isPending} onClick={() => createZone.mutate()}>
            {createZone.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add zone</>}
          </Button>
        </div>
        {zonesQ.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : (
          <ul className="divide-y rounded-lg border">
            {zones.map(z => (
              <li key={z.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{z.name}</span>
                <button type="button" className="text-gray-400 hover:text-red-500 p-1" onClick={() => delZone.mutate(z.id)} title="Delete zone">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
            {!zones.length && <li className="px-3 py-6 text-center text-gray-400 text-sm">No zones — tables can still be added without a zone.</li>}
          </ul>
        )}
      </section>

      <section className="rounded-xl border bg-white p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Tables</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-[10px] uppercase text-gray-400 font-semibold block mb-1">Label</label>
            <Input placeholder="T1, B12…" value={tableLabel} onChange={e => setTableLabel(e.target.value)} className="h-9 text-sm w-32" />
          </div>
          <div>
            <label className="text-[10px] uppercase text-gray-400 font-semibold block mb-1">Zone</label>
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
              <li key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  <span className="font-semibold">{t.label}</span>
                  <span className="text-gray-400 ml-2">{t.zone_name || '—'}</span>
                  <span className="text-gray-400 ml-2">{t.capacity} seats</span>
                </span>
                <button type="button" className="text-gray-400 hover:text-red-500 p-1" onClick={() => delTable.mutate(t.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
            {!tables.length && <li className="px-3 py-6 text-center text-gray-400 text-sm">No tables yet.</li>}
          </ul>
        )}
      </section>
    </div>
  )
}
