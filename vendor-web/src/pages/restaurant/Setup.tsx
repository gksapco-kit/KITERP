import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Clock, Copy, ExternalLink, Loader2, Pencil, Plus, QrCode, Trash2, X } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { useMyVendor } from '@/hooks/useVendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
import { useRestaurantStore } from '@/stores/restaurantStore'

interface DiningTimerConfig {
  enabled: boolean
  target_minutes: number
  warn_minutes: number
}

function parseDiningTimerConfig(raw: unknown): DiningTimerConfig {
  const cfg = (raw && typeof raw === 'object' ? raw : {}) as Partial<DiningTimerConfig>
  return {
    enabled: cfg.enabled === true,
    target_minutes: cfg.target_minutes ?? 60,
    warn_minutes: cfg.warn_minutes ?? 10,
  }
}

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
  const [zoneFloor, setZoneFloor] = useState('')
  const [tableLabel, setTableLabel] = useState('')
  const [tableZone, setTableZone] = useState<string>('')
  const [tableCapacity, setTableCapacity] = useState('4')
  const { selectedRestaurant, setSelectedRestaurant } = useRestaurantStore()
  const rid = selectedRestaurant?.id

  const vendorQ = useMyVendor()
  const vendorSlug = vendorQ.data?.slug as string | undefined

  const zonesQ = useQuery({
    queryKey: ['restaurant', 'zones', rid],
    queryFn: () => vendorApi.restaurantListZones(rid ? { restaurant_id: rid } : undefined),
  })
  const tablesQ = useQuery({
    queryKey: ['restaurant', 'tables', rid],
    queryFn: () => vendorApi.restaurantListTables(rid ? { restaurant_id: rid } : undefined),
  })
  const outletQ = useQuery({
    queryKey: ['restaurant', 'outlet', rid],
    queryFn: () => vendorApi.getRestaurant(rid!),
    enabled: !!rid,
    staleTime: 15_000,
  })

  const createZone = useMutation({
    mutationFn: () => vendorApi.restaurantCreateZone({
      name: zoneName.trim(),
      sort_order: (zonesQ.data?.items.length ?? 0),
      ...(zoneFloor.trim() ? { floor: zoneFloor.trim() } : {}),
      ...(rid ? { restaurant_id: rid } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'zones'] })
      setZoneName('')
      setZoneFloor('')
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
        ...(rid ? { restaurant_id: rid } : {}),
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

  const savedTimerCfg = parseDiningTimerConfig(
    outletQ.data?.settings?.dining_timer ?? selectedRestaurant?.settings?.dining_timer,
  )
  const hasSavedTimer =
    outletQ.data?.settings?.dining_timer != null ||
    selectedRestaurant?.settings?.dining_timer != null

  const [timerEditing, setTimerEditing] = useState(false)
  const [timerEnabled, setTimerEnabled] = useState<boolean>(savedTimerCfg.enabled)
  const [targetMinutes, setTargetMinutes] = useState<string>(String(savedTimerCfg.target_minutes))
  const [warnMinutes, setWarnMinutes] = useState<string>(String(savedTimerCfg.warn_minutes))

  useEffect(() => {
    setTimerEditing(false)
  }, [rid])

  useEffect(() => {
    if (!rid || !outletQ.isFetched) return
    setTimerEditing(outletQ.data?.settings?.dining_timer == null)
  }, [rid, outletQ.isFetched, outletQ.data?.settings?.dining_timer])

  // Sync draft fields from API when not editing
  useEffect(() => {
    if (timerEditing) return
    const cfg = parseDiningTimerConfig(
      outletQ.data?.settings?.dining_timer ?? selectedRestaurant?.settings?.dining_timer,
    )
    setTimerEnabled(cfg.enabled)
    setTargetMinutes(String(cfg.target_minutes))
    setWarnMinutes(String(cfg.warn_minutes))
  }, [rid, outletQ.data?.settings?.dining_timer, selectedRestaurant?.settings?.dining_timer, timerEditing])

  function startTimerEdit() {
    const cfg = parseDiningTimerConfig(
      outletQ.data?.settings?.dining_timer ?? selectedRestaurant?.settings?.dining_timer,
    )
    setTimerEnabled(cfg.enabled)
    setTargetMinutes(String(cfg.target_minutes))
    setWarnMinutes(String(cfg.warn_minutes))
    setTimerEditing(true)
  }

  function cancelTimerEdit() {
    const cfg = parseDiningTimerConfig(
      outletQ.data?.settings?.dining_timer ?? selectedRestaurant?.settings?.dining_timer,
    )
    setTimerEnabled(cfg.enabled)
    setTargetMinutes(String(cfg.target_minutes))
    setWarnMinutes(String(cfg.warn_minutes))
    setTimerEditing(false)
  }

  const saveTimer = useMutation({
    mutationFn: () => {
      const cfg: DiningTimerConfig = {
        enabled: timerEnabled,
        target_minutes: Math.max(1, parseInt(targetMinutes) || 60),
        warn_minutes: Math.max(0, parseInt(warnMinutes) || 10),
      }
      return vendorApi.updateRestaurant(rid!, {
        settings: {
          ...(outletQ.data?.settings ?? selectedRestaurant?.settings ?? {}),
          dining_timer: cfg,
        },
      })
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['restaurants'] })
      qc.invalidateQueries({ queryKey: ['restaurant', 'outlet', updated.id] })
      if (selectedRestaurant?.id === updated.id) {
        setSelectedRestaurant(updated)
      }
      setTimerEditing(false)
      toast.success('Dining timer settings saved')
    },
    onError: () => toast.error('Could not save dining timer settings'),
  })

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
        <div className="flex gap-2 flex-wrap items-end">
          <div>
            <label className="text-xs uppercase text-gray-400 font-semibold block mb-1">Zone name *</label>
            <Input
              placeholder="e.g. Patio, Indoor, Rooftop"
              value={zoneName}
              onChange={e => setZoneName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && zoneName.trim()) createZone.mutate() }}
              className="h-9 text-sm w-44"
            />
          </div>
          <div>
            <label className="text-xs uppercase text-gray-400 font-semibold block mb-1">Floor (optional)</label>
            <Input
              placeholder="e.g. Ground, 1st, Rooftop"
              value={zoneFloor}
              onChange={e => setZoneFloor(e.target.value)}
              className="h-9 text-sm w-36"
            />
          </div>
          <Button size="sm" disabled={!zoneName.trim() || createZone.isPending} onClick={() => createZone.mutate()}>
            {createZone.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add zone</>}
          </Button>
        </div>
        {zonesQ.isLoading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : (
          <ul className="divide-y rounded-lg border">
            {zones.map(z => (
              <li key={z.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  {z.name}
                  {z.floor && (
                    <span className="ml-2 text-xs text-gray-400 font-medium">· {z.floor}</span>
                  )}
                </span>
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

      {/* Dining timer */}
      <section className="rounded-xl border bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-gray-800">Dining Timer</h2>
          </div>
          {rid && hasSavedTimer && !timerEditing && (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={startTimerEdit}>
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          )}
        </div>
        <p className="text-sm text-gray-500">
          Show a live countdown on each occupied table card on the Floor screen. The timer turns amber when the warning threshold is reached and red when the target time is exceeded.
        </p>

        {!rid ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Select a restaurant outlet from the picker above to configure its dining timer.
          </p>
        ) : outletQ.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        ) : !timerEditing ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                savedTimerCfg.enabled
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {savedTimerCfg.enabled ? 'Enabled' : 'Disabled'}
              </span>
              {hasSavedTimer && (
                <span className="text-xs text-gray-400">Saved settings</span>
              )}
            </div>

            {savedTimerCfg.enabled ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-lg border bg-gray-50 px-3 py-2.5">
                    <p className="text-xs uppercase text-gray-400 font-semibold">Target duration</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{savedTimerCfg.target_minutes} min</p>
                  </div>
                  <div className="rounded-lg border bg-gray-50 px-3 py-2.5">
                    <p className="text-xs uppercase text-gray-400 font-semibold">Warning threshold</p>
                    <p className="text-sm font-semibold text-gray-800 mt-0.5">{savedTimerCfg.warn_minutes} min remaining</p>
                  </div>
                </div>
                <div className="flex gap-3 text-xs text-gray-500 items-start rounded-lg bg-gray-50 border px-3 py-2">
                  <Clock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <span>
                    Tables will show: <span className="text-emerald-600 font-medium">green</span> → <span className="text-amber-600 font-medium">amber</span> (at {savedTimerCfg.warn_minutes} min left) → <span className="text-red-600 font-medium">red/over</span> (past {savedTimerCfg.target_minutes} min).
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 rounded-lg border bg-gray-50 px-3 py-2">
                Dining timer is off — occupied tables on Floor will not show a countdown.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Enable toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                role="switch"
                aria-checked={timerEnabled}
                onClick={() => setTimerEnabled(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${timerEnabled ? 'bg-amber-500' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${timerEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {timerEnabled ? 'Dining timer enabled' : 'Dining timer disabled'}
              </span>
            </label>

            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity ${timerEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div>
                <label className="text-xs uppercase text-gray-400 font-semibold block mb-1">
                  Target dining duration (minutes)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={480}
                  value={targetMinutes}
                  onChange={e => setTargetMinutes(e.target.value)}
                  className="h-9 text-sm w-32"
                  disabled={!timerEnabled}
                />
                <p className="text-xs text-gray-400 mt-1">Timer turns red when exceeded. Default: 60.</p>
              </div>
              <div>
                <label className="text-xs uppercase text-gray-400 font-semibold block mb-1">
                  Warning threshold (minutes remaining)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={parseInt(targetMinutes) - 1 || 59}
                  value={warnMinutes}
                  onChange={e => setWarnMinutes(e.target.value)}
                  className="h-9 text-sm w-32"
                  disabled={!timerEnabled}
                />
                <p className="text-xs text-gray-400 mt-1">Timer turns amber at this many minutes left. Default: 10.</p>
              </div>
            </div>

            {timerEnabled && (
              <div className="flex gap-3 text-xs text-gray-500 items-start rounded-lg bg-gray-50 border px-3 py-2">
                <Clock className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <span>
                  Tables will show: <span className="text-emerald-600 font-medium">green</span> → <span className="text-amber-600 font-medium">amber</span> (at {warnMinutes || '?'} min left) → <span className="text-red-600 font-medium">red/over</span> (past {targetMinutes || '?'} min).
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={saveTimer.isPending}
                onClick={() => saveTimer.mutate()}
                className="gap-2"
              >
                {saveTimer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save timer settings
              </Button>
              {hasSavedTimer && (
                <Button type="button" size="sm" variant="outline" disabled={saveTimer.isPending} onClick={cancelTimerEdit}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
