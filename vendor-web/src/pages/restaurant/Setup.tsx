import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Clock, Copy, ExternalLink, Loader2, Pencil, Plus, QrCode, Trash2, X } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { useMyVendor } from '@/hooks/useVendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { askConfirm } from '@/components/common/ConfirmProvider'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { Select } from '@/components/ui/select'

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
    <li className="px-3 py-1.5 text-sm">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="h-8 w-20 text-sm"
            placeholder="Label"
          />
          <Select
            value={zoneId}
            onChange={setZoneId}
            className="h-8 w-[140px] text-sm"
            placeholder="— No zone —"
            options={[
              { value: '', label: '— No zone —' },
              ...zones.map((z) => ({ value: z.id, label: z.name })),
            ]}
          />
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground">Seats</label>
            <Input
              type="number"
              min={1}
              max={99}
              value={capacity}
              onChange={e => setCapacity(e.target.value)}
              className="h-8 w-14 text-sm"
            />
          </div>
          <Button size="sm" className="h-8 gap-1 px-2" disabled={!label.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
          </Button>
          <button type="button" onClick={() => { setEditing(false); setLabel(table.label); setCapacity(String(table.capacity)); setZoneId(table.zone_id ?? '') }}
            className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate">
            <span className="font-semibold">{table.label}</span>
            <span className="ml-2 text-muted-foreground">{table.zone_name || '—'}</span>
            <span className="ml-2 text-muted-foreground">{table.capacity} seats</span>
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" className="p-1 text-muted-foreground hover:text-primary" onClick={() => setEditing(true)} title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="p-1 text-muted-foreground hover:text-red-500" onClick={onDelete} title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
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
    <div className="mx-auto flex max-w-6xl flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" asChild>
          <Link to="/restaurant/floor" aria-label="Back to floor">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-foreground sm:text-xl">Restaurant Setup</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Zones, tables, QR codes — menu under Dine-in Menu.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 shrink-0" asChild>
          <Link to="/restaurant/menu">Dine-in Menu</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
        {/* Zones */}
        <section className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
          <h2 className="text-sm font-semibold text-foreground">Zones</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-[8rem]">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Zone name *
              </label>
              <Input
                placeholder="e.g. Patio, Indoor"
                value={zoneName}
                onChange={e => setZoneName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && zoneName.trim()) createZone.mutate() }}
                className="h-8 w-full text-sm"
              />
            </div>
            <div className="w-[7rem] shrink-0">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Floor
              </label>
              <Input
                placeholder="Ground, 1st…"
                value={zoneFloor}
                onChange={e => setZoneFloor(e.target.value)}
                className="h-8 w-full text-sm"
              />
            </div>
            <Button
              size="sm"
              className="h-8 gap-1 shrink-0"
              disabled={!zoneName.trim() || createZone.isPending}
              onClick={() => createZone.mutate()}
            >
              {createZone.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add
            </Button>
          </div>
          {zonesQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <ul className="max-h-[min(40vh,16rem)] min-h-[5.5rem] flex-1 divide-y overflow-y-auto rounded-lg border border-border">
              {zones.map(z => (
                <li key={z.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    {z.name}
                    {z.floor && (
                      <span className="ml-1.5 text-xs font-medium text-muted-foreground">· {z.floor}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 p-1 text-muted-foreground hover:text-red-500"
                    onClick={async () => {
                      if (await askConfirm(`Delete zone "${z.name}"? All tables in it will lose their zone.`)) {
                        delZone.mutate(z.id)
                      }
                    }}
                    title="Delete zone"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {!zones.length && (
                <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No zones — tables can be added without one.
                </li>
              )}
            </ul>
          )}
        </section>

        {/* Tables */}
        <section className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
          <h2 className="text-sm font-semibold text-foreground">Tables</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-[5.5rem] shrink-0">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Label *
              </label>
              <Input
                placeholder="T1, A3…"
                value={tableLabel}
                onChange={e => setTableLabel(e.target.value)}
                className="h-8 w-full text-sm"
              />
            </div>
            <div className="w-14 shrink-0">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Seats
              </label>
              <Input
                type="number"
                min={1}
                max={99}
                value={tableCapacity}
                onChange={e => setTableCapacity(e.target.value)}
                className="h-8 w-full text-sm"
              />
            </div>
            <div className="min-w-0 flex-1 basis-[7rem]">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Zone
              </label>
              <Select
                value={tableZone}
                onChange={setTableZone}
                wrapperClassName="w-full min-w-0"
                className="h-8 w-full text-sm"
                placeholder="— None —"
                options={[
                  { value: '', label: '— None —' },
                  ...zones.map((z) => ({ value: z.id, label: z.name })),
                ]}
              />
            </div>
            <Button
              size="sm"
              className="h-8 gap-1 shrink-0"
              disabled={!tableLabel.trim() || createTable.isPending}
              onClick={() => createTable.mutate()}
            >
              {createTable.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add
            </Button>
          </div>
          {tablesQ.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <ul className="max-h-[min(40vh,16rem)] min-h-[5.5rem] flex-1 divide-y overflow-y-auto rounded-lg border border-border">
              {tables.map(t => (
                <TableEditRow
                  key={t.id}
                  table={t as TableRow}
                  zones={zones}
                  vendorSlug={vendorSlug}
                  onDelete={async () => {
                    if (await askConfirm(`Delete table "${t.label}"?`)) delTable.mutate(t.id)
                  }}
                />
              ))}
              {!tables.length && (
                <li className="px-3 py-4 text-center text-xs text-muted-foreground">No tables yet.</li>
              )}
            </ul>
          )}
        </section>
      </div>

      {/* Dining timer — compact strip */}
      <section className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Dining Timer</h2>
              {!timerEditing && rid && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    savedTimerCfg.enabled
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {savedTimerCfg.enabled ? 'On' : 'Off'}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Countdown on Floor cards — amber near end, red when over.
            </p>
          </div>
          {rid && hasSavedTimer && !timerEditing && (
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={startTimerEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>

        {!rid ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Select a restaurant outlet to configure its dining timer.
          </p>
        ) : outletQ.isLoading ? (
          <Loader2 className="mt-3 h-5 w-5 animate-spin text-muted-foreground" />
        ) : !timerEditing ? (
          savedTimerCfg.enabled ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Target</p>
                <p className="text-sm font-semibold text-foreground">{savedTimerCfg.target_minutes} min</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Warning</p>
                <p className="text-sm font-semibold text-foreground">{savedTimerCfg.warn_minutes} min left</p>
              </div>
              <div className="col-span-2 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:col-span-1">
                <span className="font-medium text-primary">green</span>
                <span>→</span>
                <span className="font-medium text-amber-600">amber</span>
                <span>→</span>
                <span className="font-medium text-red-600">red</span>
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Timer off — occupied tables won&apos;t show a countdown.
            </p>
          )
        ) : (
          <div className="mt-3 space-y-3">
            <label className="flex cursor-pointer select-none items-center gap-3">
              <div
                role="switch"
                aria-checked={timerEnabled}
                onClick={() => setTimerEnabled(v => !v)}
                className={`relative h-6 w-11 cursor-pointer rounded-full border-2 transition-colors ${
                  timerEnabled
                    ? 'border-transparent bg-primary'
                    : 'border-border bg-muted'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow ring-1 ring-black/5 transition-transform ${
                    timerEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
              <span className="text-sm font-medium text-foreground">
                {timerEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>

            <div
              className={`grid grid-cols-2 gap-3 transition-opacity ${
                timerEnabled ? 'opacity-100' : 'pointer-events-none opacity-40'
              }`}
            >
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Target (min)
                </label>
                <Input
                  type="number"
                  min={1}
                  max={480}
                  value={targetMinutes}
                  onChange={e => setTargetMinutes(e.target.value)}
                  className="h-8 w-full max-w-[8rem] text-sm"
                  disabled={!timerEnabled}
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Warn at (min left)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={parseInt(targetMinutes) - 1 || 59}
                  value={warnMinutes}
                  onChange={e => setWarnMinutes(e.target.value)}
                  className="h-8 w-full max-w-[8rem] text-sm"
                  disabled={!timerEnabled}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="h-8 gap-1.5"
                disabled={saveTimer.isPending}
                onClick={() => saveTimer.mutate()}
              >
                {saveTimer.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save
              </Button>
              {hasSavedTimer && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={saveTimer.isPending}
                  onClick={cancelTimerEdit}
                >
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
