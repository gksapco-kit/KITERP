/**
 * HR → Field Tracking
 * Live map of on-duty employees + per-employee day timeline.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MapPin, Building2, UserRound, RefreshCw, Users, Battery, Clock, ChevronRight, X,
  ToggleLeft, ToggleRight, Route, Navigation, Play, Pause,
  Crosshair, Signal, SignalZero, Radio, Timer, Gauge,
} from 'lucide-react'
import { useHRTrackingLive, useHRTrackingTrail, useHRToggleTracking, useHREmployees, useStores } from '@/hooks/useVendor'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { employeeDisplayName } from '@/lib/hrEmployeeDisplay'
import { cn, mediaUrl, onModalBackdropClick } from '@/lib/utils'
import { dialogOverlayClass, dialogPanelClass, dialogHeaderClass, dialogBodyClass, dialogFooterClass } from '@/lib/modalUi'
import type { EmployeeProfile } from '@/types'
import 'leaflet/dist/leaflet.css'

// ── Types ─────────────────────────────────────────────────────────────────────
interface LiveEmployee {
  employee_id: string
  employee_code: string
  full_name: string
  last_lat: number | null
  last_lng: number | null
  last_seen_at: string | null
  tracking_enabled: boolean
}

interface TrailPoint {
  lat: number
  lng: number
  accuracy: number | null
  speed: number | null
  heading: number | null
  battery: number | null
  source: string
  recorded_at: string
}

type SignalStatus = 'live' | 'recent' | 'stale' | 'none'

interface TimelineEvent {
  kind: 'start' | 'stop' | 'move' | 'latest'
  index: number
  point: TrailPoint
  label: string
  detail: string
  dwellMins?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeSince(iso: string | null): string {
  if (!iso) return 'Unknown'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatClockSec(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(mins: number): string {
  if (mins < 1) return '<1 min'
  if (mins < 60) return `${Math.round(mins)} min`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

function batteryColor(pct: number | null): string {
  if (pct === null) return 'text-muted-foreground'
  if (pct <= 20) return 'text-red-500'
  if (pct <= 50) return 'text-orange-500'
  return 'text-emerald-600'
}

function signalStatus(emp: LiveEmployee): SignalStatus {
  if (emp.last_lat == null || emp.last_lng == null) return 'none'
  if (!emp.last_seen_at) return 'stale'
  const mins = (Date.now() - new Date(emp.last_seen_at).getTime()) / 60_000
  if (mins < 3) return 'live'
  if (mins < 15) return 'recent'
  return 'stale'
}

const SIGNAL_META: Record<SignalStatus, { label: string; className: string; dot: string }> = {
  live: {
    label: 'Live',
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  recent: {
    label: 'Recent',
    className: 'text-primary bg-primary/10 border-primary/25',
    dot: 'bg-primary',
  },
  stale: {
    label: 'Last seen',
    className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/15 dark:border-amber-500/30',
    dot: 'bg-amber-500',
  },
  none: {
    label: 'No signal',
    className: 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-500/15 dark:border-red-500/30',
    dot: 'bg-red-400',
  },
}

const COLORS = [
  '#0d9488', '#2563eb', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#9333ea', '#dc2626',
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name.slice(0, 2) || '?').toUpperCase()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

function trailDistanceKm(trail: TrailPoint[]): number {
  let total = 0
  for (let i = 1; i < trail.length; i++) total += haversineKm(trail[i - 1], trail[i])
  return total
}

function speedKmh(point: TrailPoint): number | null {
  if (point.speed == null) return null
  return point.speed * 3.6
}

function localDayBounds() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { from_dt: start.toISOString(), to_dt: end.toISOString() }
}

function buildTimelineEvents(trail: TrailPoint[]): TimelineEvent[] {
  if (!trail.length) return []
  const MOVE_KM = 0.08
  const STOP_MIN = 4
  const events: TimelineEvent[] = []

  let clusterStart = 0
  for (let i = 1; i <= trail.length; i++) {
    const moved = i === trail.length || haversineKm(trail[clusterStart], trail[i]) >= MOVE_KM
    if (!moved) continue

    const last = trail[i - 1]
    const dwellMins = (new Date(last.recorded_at).getTime() - new Date(trail[clusterStart].recorded_at).getTime()) / 60_000
    const isStop = i - 1 > clusterStart && dwellMins >= STOP_MIN

    if (isStop) {
      events.push({
        kind: clusterStart === 0 ? 'start' : 'stop',
        index: clusterStart,
        point: trail[clusterStart],
        label: clusterStart === 0 ? 'Started here' : 'Stopped',
        detail: formatDuration(dwellMins),
        dwellMins,
      })
    } else {
      for (const k of [clusterStart, i - 1]) {
        if (events.some((e) => e.index === k)) continue
        const point = trail[k]
        const kmh = speedKmh(point)
        const isFirst = k === 0
        const isLast = k === trail.length - 1
        events.push({
          kind: isFirst ? 'start' : isLast ? 'latest' : 'move',
          index: k,
          point,
          label: isFirst ? 'Day started' : isLast ? 'Latest position' : 'On the move',
          detail: kmh != null ? `${kmh.toFixed(1)} km/h` : '',
        })
      }
    }
    clusterStart = i
  }

  const lastIdx = trail.length - 1
  if (!events.some((e) => e.index === lastIdx)) {
    events.push({
      kind: 'latest',
      index: lastIdx,
      point: trail[lastIdx],
      label: 'Latest position',
      detail: '',
    })
  }

  return events.sort((a, b) => a.index - b.index)
}

function employeeAvatarUrl(emp: EmployeeProfile): string | undefined {
  return emp.vendor_user?.user?.avatar_url || undefined
}

function employeeEntityLabel(
  emp: EmployeeProfile,
  storeNameById: Record<string, string>,
): string {
  if (emp.store_id && storeNameById[emp.store_id]) return storeNameById[emp.store_id]
  return ''
}

function employeeLocationLabel(emp: EmployeeProfile): string {
  const tagged = emp.tagged_to_label?.trim()
  if (tagged) return tagged
  const addr = emp.current_address
  if (addr) {
    const line = [addr.city, addr.state].filter(Boolean).join(', ')
    if (line) return line
  }
  return ''
}

function employeeManagerLabel(emp: EmployeeProfile): string {
  return emp.manager ? employeeDisplayName(emp.manager) : ''
}

function EmployeeAvatar({ name, src, size = 'md' }: { name: string; src?: string | null; size?: 'sm' | 'md' }) {
  return (
    <div
      className={cn(
        'rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold shrink-0 overflow-hidden',
        size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-10 h-10 text-sm',
      )}
    >
      {src ? (
        <img src={mediaUrl(src)} alt="" className="w-full h-full object-cover" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  )
}

function SignalBadge({ status, lastSeen }: { status: SignalStatus; lastSeen: string | null }) {
  const meta = SIGNAL_META[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', meta.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot, status === 'live' && 'kt-pulse-dot')} />
      {status === 'none' ? meta.label : status === 'live' ? 'Live' : timeSince(lastSeen)}
    </span>
  )
}

// ── Lazy Leaflet map ──────────────────────────────────────────────────────────
function LeafletMap({
  employees,
  trail,
  selectedId,
  activePing,
  recenterToken,
  onSelect,
}: {
  employees: LiveEmployee[]
  trail: TrailPoint[]
  selectedId: string | null
  activePing: TrailPoint | null
  recenterToken: number
  onSelect: (id: string) => void
}) {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<Record<string, any>>({})
  const layersRef = useRef<{ line?: any; under?: any; start?: any; focus?: any; accuracy?: any }>({})
  const leafletRef = useRef<any>(null)
  const fittedKeyRef = useRef('')
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    let cancelled = false

    import('leaflet').then((mod) => {
      if (cancelled || !mapContainerRef.current) return
      const L = mod.default
      leafletRef.current = L

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapContainerRef.current, {
        center: [20.5937, 78.9629],
        zoom: 5,
        zoomControl: true,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)
      mapRef.current = map
      requestAnimationFrame(() => map.invalidateSize())
      setMapReady(true)
    })

    return () => {
      cancelled = true
      setMapReady(false)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const el = mapContainerRef.current
    if (!map || !el) return
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    map.invalidateSize()
    return () => ro.disconnect()
  }, [mapReady])

  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return

    Object.keys(markersRef.current).forEach((id) => {
      if (!employees.find((e) => e.employee_id === id)) {
        markersRef.current[id].remove()
        delete markersRef.current[id]
      }
    })

    const bounds: [number, number][] = []

    employees.forEach((emp, idx) => {
      if (emp.last_lat == null || emp.last_lng == null) return
      const color = COLORS[idx % COLORS.length]
      const isSelected = emp.employee_id === selectedId
      const status = signalStatus(emp)
      const live = status === 'live'
      const size = isSelected ? 36 : 30
      const label = escapeHtml(emp.full_name || emp.employee_code || 'Employee')
      const meta = status === 'none' ? 'No signal' : timeSince(emp.last_seen_at)
      const letters = escapeHtml(initials(emp.full_name || emp.employee_code || '?'))

      const icon = L.divIcon({
        className: 'kt-emp-marker',
        html: `
          <div class="kt-marker ${isSelected ? 'is-selected' : ''} ${live ? 'is-live' : ''}">
            ${live ? `<span class="kt-marker-ring" style="border-color:${color}"></span>` : ''}
            <span class="kt-marker-dot" style="width:${size}px;height:${size}px;background:${color};">
              ${letters}
            </span>
            <span class="kt-marker-label">
              <strong>${label}</strong>
              <em>${escapeHtml(meta)}</em>
            </span>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })

      const latlng: [number, number] = [emp.last_lat, emp.last_lng]
      bounds.push(latlng)

      if (markersRef.current[emp.employee_id]) {
        markersRef.current[emp.employee_id].setLatLng(latlng).setIcon(icon)
      } else {
        markersRef.current[emp.employee_id] = L.marker(latlng, { icon, zIndexOffset: isSelected ? 600 : 200 })
          .addTo(map)
          .on('click', () => onSelect(emp.employee_id))
      }
      markersRef.current[emp.employee_id].setZIndexOffset(isSelected ? 600 : 200)
    })

    if (bounds.length && !selectedId) {
      const key = `all:${bounds.length}`
      if (fittedKeyRef.current !== key) {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 })
        fittedKeyRef.current = key
      }
    }
  }, [employees, selectedId, onSelect, mapReady])

  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return

    const clearLayer = (key: 'line' | 'under' | 'start' | 'focus' | 'accuracy') => {
      if (layersRef.current[key]) {
        layersRef.current[key].remove()
        layersRef.current[key] = undefined
      }
    }

    ;(['line', 'under', 'start', 'focus', 'accuracy'] as const).forEach(clearLayer)

    const selected = employees.find((e) => e.employee_id === selectedId)
    if (selected?.last_lat != null && selected.last_lng != null) {
      layersRef.current.accuracy = L.circle([selected.last_lat, selected.last_lng], {
        radius: 40,
        color: '#0d9488',
        weight: 1,
        fillColor: '#64C3A0',
        fillOpacity: 0.12,
      }).addTo(map)
    }

    if (trail.length >= 2) {
      const latlngs = trail.map((p) => [p.lat, p.lng] as [number, number])
      layersRef.current.under = L.polyline(latlngs, {
        color: '#ffffff',
        weight: 8,
        opacity: 0.85,
      }).addTo(map)
      layersRef.current.line = L.polyline(latlngs, {
        color: '#0f766e',
        weight: 4,
        opacity: 0.95,
      }).addTo(map)

      const start = trail[0]
      layersRef.current.start = L.marker([start.lat, start.lng], {
        icon: L.divIcon({
          className: 'kt-emp-marker',
          html: `<div class="kt-trail-chip kt-trail-start">Start · ${escapeHtml(formatClock(start.recorded_at))}</div>`,
          iconSize: [96, 24],
          iconAnchor: [48, 28],
        }),
        zIndexOffset: 400,
      }).addTo(map)

      const key = `trail:${selectedId}:${trail.length >= 2 ? 'yes' : 'no'}`
      if (fittedKeyRef.current !== key) {
        map.fitBounds(layersRef.current.line.getBounds(), { padding: [56, 56], maxZoom: 16 })
        fittedKeyRef.current = key
      }
    } else if (selected?.last_lat != null && selected.last_lng != null) {
      const key = `emp:${selectedId}`
      if (fittedKeyRef.current !== key) {
        map.flyTo([selected.last_lat, selected.last_lng], 16, { duration: 0.55 })
        fittedKeyRef.current = key
      }
    }
  }, [trail, selectedId, employees, mapReady])

  useEffect(() => {
    if (!recenterToken) return
    const map = mapRef.current
    const selected = employees.find((e) => e.employee_id === selectedId)
    if (!map || selected?.last_lat == null || selected.last_lng == null) return
    map.flyTo([selected.last_lat, selected.last_lng], 16, { duration: 0.45 })
  }, [recenterToken, selectedId, employees])

  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return
    if (layersRef.current.focus) {
      layersRef.current.focus.remove()
      layersRef.current.focus = undefined
    }
    if (!activePing) return
    layersRef.current.focus = L.marker([activePing.lat, activePing.lng], {
      icon: L.divIcon({
        className: 'kt-emp-marker',
        html: `<div class="kt-focus-pin"><span></span></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      zIndexOffset: 800,
    }).addTo(map)
    map.panTo([activePing.lat, activePing.lng], { animate: true, duration: 0.35 })
  }, [activePing, mapReady])

  return <div ref={mapContainerRef} className="absolute inset-0 bg-muted/40" />
}

// ── Employee card (sidebar) ───────────────────────────────────────────────────
function EmployeeCard({
  emp,
  colorIndex,
  selected,
  onClick,
}: {
  emp: LiveEmployee
  colorIndex: number
  selected: boolean
  onClick: () => void
}) {
  const color = COLORS[colorIndex % COLORS.length]
  const status = signalStatus(emp)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border px-3 py-2.5 transition-all',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border hover:bg-muted/50 hover:border-primary/30',
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="relative mt-0.5 shrink-0">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
            style={{ background: color }}
          >
            {initials(emp.full_name || emp.employee_code || '?')}
          </span>
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
              SIGNAL_META[status].dot,
              status === 'live' && 'kt-pulse-dot',
            )}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{emp.full_name}</p>
            <ChevronRight className={cn('mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', selected && 'rotate-90 text-primary')} />
          </div>
          <p className="text-[11px] text-muted-foreground">{emp.employee_code}</p>
          <div className="mt-1.5">
            <SignalBadge status={status} lastSeen={emp.last_seen_at} />
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Timeline panel ────────────────────────────────────────────────────────────
function TimelinePanel({
  employee,
  trail,
  isLoading,
  activeIndex,
  playing,
  onSelectPing,
  onTogglePlay,
  onClose,
}: {
  employee: LiveEmployee
  trail: TrailPoint[]
  isLoading: boolean
  activeIndex: number | null
  playing: boolean
  onSelectPing: (index: number) => void
  onTogglePlay: () => void
  onClose: () => void
}) {
  const events = useMemo(() => buildTimelineEvents(trail), [trail])
  const distanceKm = useMemo(() => trailDistanceKm(trail), [trail])
  const durationMins = useMemo(() => {
    if (trail.length < 2) return 0
    return (new Date(trail[trail.length - 1].recorded_at).getTime() - new Date(trail[0].recorded_at).getTime()) / 60_000
  }, [trail])
  const avgKmh = durationMins > 0 ? (distanceKm / (durationMins / 60)) : null
  const latest = trail[trail.length - 1]
  const active = activeIndex != null ? trail[activeIndex] : latest

  return (
    <div className="flex h-[17.5rem] shrink-0 flex-col border-t border-border bg-card md:h-[18.5rem]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Route className="h-4 w-4 text-primary" />
            Today’s timeline
            <span className="truncate font-normal text-muted-foreground">· {employee.full_name}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            {trail.length ? ` · ${trail.length} pings` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={trail.length < 2}
            onClick={onTogglePlay}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? 'Pause' : 'Replay'}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close timeline">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-border px-4 py-2 sm:grid-cols-4">
        <StatChip icon={Navigation} label="Distance" value={trail.length ? `${distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}` : '—'} />
        <StatChip icon={Timer} label="On route" value={trail.length >= 2 ? formatDuration(durationMins) : '—'} />
        <StatChip icon={Gauge} label="Avg speed" value={avgKmh != null && Number.isFinite(avgKmh) ? `${avgKmh.toFixed(1)} km/h` : '—'} />
        <StatChip
          icon={Battery}
          label="Battery"
          value={latest?.battery != null ? `${latest.battery}%` : '—'}
          valueClass={batteryColor(latest?.battery ?? null)}
        />
      </div>

      {trail.length > 1 && (
        <div className="px-4 pt-2">
          <input
            type="range"
            min={0}
            max={trail.length - 1}
            value={activeIndex ?? trail.length - 1}
            onChange={(e) => onSelectPing(Number(e.target.value))}
            className="kt-timeline-range w-full"
            aria-label="Scrub timeline"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{formatClock(trail[0].recorded_at)}</span>
            <span className="font-medium text-foreground">{active ? formatClockSec(active.recorded_at) : ''}</span>
            <span>{formatClock(trail[trail.length - 1].recorded_at)}</span>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {isLoading ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading today’s movement…</p>
        ) : trail.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No movement recorded yet</p>
            <p className="text-xs text-muted-foreground">Pings appear here after the employee’s device sends a GPS update.</p>
          </div>
        ) : (
          <ol className="relative space-y-0 pl-2">
            {events.map((event, i) => {
              const isActive = (activeIndex ?? trail.length - 1) === event.index
              return (
                <li key={`${event.kind}-${event.index}`}>
                  <button
                    type="button"
                    onClick={() => onSelectPing(event.index)}
                    className={cn(
                      'relative flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                      isActive ? 'bg-primary/10' : 'hover:bg-muted/60',
                    )}
                  >
                    <span className="relative mt-0.5 flex w-4 shrink-0 flex-col items-center">
                      {i < events.length - 1 && (
                        <span className="absolute top-4 bottom-[-12px] w-px bg-border" />
                      )}
                      <span
                        className={cn(
                          'relative z-[1] h-3 w-3 rounded-full border-2 border-background shadow-sm',
                          event.kind === 'stop' && 'bg-amber-500',
                          event.kind === 'start' && 'bg-emerald-500',
                          event.kind === 'latest' && 'bg-primary',
                          event.kind === 'move' && 'bg-sky-500',
                          isActive && 'ring-2 ring-primary/40',
                        )}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">{event.label}</span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {formatClock(event.point.recorded_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        {event.detail && <span>{event.detail}</span>}
                        {event.point.accuracy != null && <span>±{event.point.accuracy.toFixed(0)} m</span>}
                        {event.point.source && <span className="capitalize">{event.point.source}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}

function StatChip({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: typeof Clock
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/40 px-2.5 py-1.5">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className={cn('truncate text-sm font-semibold text-foreground', valueClass)}>{value}</p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FieldTrackingPage() {
  const { data: liveData, isLoading, refetch, isFetching, dataUpdatedAt } = useHRTrackingLive(30_000)
  const { data: allEmpsData } = useHREmployees({ limit: 200, status: 'active' })
  const { data: storesData } = useStores()
  const toggleTracking = useHRToggleTracking()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showTrail, setShowTrail] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [activePingIndex, setActivePingIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [recenterToken, setRecenterToken] = useState(0)
  const dayKey = new Date().toDateString()

  const liveEmployees: LiveEmployee[] = liveData?.items ?? []
  const allEmployees: EmployeeProfile[] = allEmpsData?.items ?? []
  const selected = liveEmployees.find((e) => e.employee_id === selectedId) ?? null
  const dayBounds = useMemo(() => localDayBounds(), [dayKey])

  const storeNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const store of storesData?.stores ?? []) {
      if (store.id && store.name) map[store.id] = store.name
    }
    return map
  }, [storesData?.stores])

  const { data: trailData, isLoading: trailLoading } = useHRTrackingTrail(
    selectedId,
    dayBounds,
    { refetchInterval: selectedId ? 30_000 : false },
  )
  const trail: TrailPoint[] = trailData?.trail ?? []

  const liveCount = liveEmployees.filter((e) => signalStatus(e) === 'live').length
  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => {
      if (prev === id) {
        setShowTrail(false)
        setActivePingIndex(null)
        setPlaying(false)
        return null
      }
      setShowTrail(true)
      setActivePingIndex(null)
      setPlaying(false)
      return id
    })
  }, [])

  useEffect(() => {
    if (!playing || trail.length < 2) return
    const startAt = activePingIndex == null ? 0 : activePingIndex
    setActivePingIndex(startAt)
    const timer = window.setInterval(() => {
      setActivePingIndex((prev) => {
        const next = (prev ?? 0) + 1
        if (next >= trail.length) {
          setPlaying(false)
          return trail.length - 1
        }
        return next
      })
    }, 700)
    return () => window.clearInterval(timer)
  }, [playing, trail.length])

  const activePing = activePingIndex != null ? trail[activePingIndex] ?? null : null

  function recenterSelected() {
    if (selected?.last_lat == null || selected.last_lng == null) return
    setPlaying(false)
    setActivePingIndex(null)
    setRecenterToken((n) => n + 1)
  }

  return (
    <div className="flex h-[calc(100dvh-7.25rem)] min-h-[36rem] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <style>{`
        .kt-pulse-dot { box-shadow: 0 0 0 0 currentColor; animation: kt-pulse 1.8s ease-out infinite; }
        @keyframes kt-pulse {
          0% { box-shadow: 0 0 0 0 rgba(16,185,129,.55); }
          70% { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
        .kt-emp-marker { background: transparent; border: 0; }
        .kt-marker { position: relative; display: flex; flex-direction: column; align-items: center; }
        .kt-marker-ring {
          position: absolute; inset: -8px; border-radius: 999px; border: 2px solid;
          animation: kt-ring 1.8s ease-out infinite; opacity: .7;
        }
        @keyframes kt-ring {
          0% { transform: scale(.7); opacity: .7; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        .kt-marker-dot {
          display: flex; align-items: center; justify-content: center;
          border-radius: 999px; color: #fff; font-size: 11px; font-weight: 700;
          border: 2px solid #fff; box-shadow: 0 4px 12px rgba(15,23,42,.28);
        }
        .kt-marker.is-selected .kt-marker-dot { box-shadow: 0 0 0 3px rgba(13,148,136,.35), 0 6px 16px rgba(15,23,42,.3); }
        .kt-marker-label {
          margin-top: 4px; min-width: 72px; max-width: 140px; padding: 3px 7px;
          border-radius: 8px; background: #fff; box-shadow: 0 2px 10px rgba(15,23,42,.16);
          text-align: center; line-height: 1.15;
        }
        .kt-marker-label strong {
          display: block; font-size: 10px; font-weight: 700; color: #111827;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .kt-marker-label em { display: block; font-style: normal; font-size: 9px; color: #6b7280; }
        .kt-trail-chip {
          font-size: 10px; font-weight: 700; color: #065f46; background: #ecfdf5;
          border: 1px solid #a7f3d0; border-radius: 999px; padding: 2px 8px; white-space: nowrap;
          box-shadow: 0 2px 8px rgba(15,23,42,.12);
        }
        .kt-focus-pin span {
          display: block; width: 16px; height: 16px; border-radius: 999px;
          background: #0f766e; border: 3px solid #fff; box-shadow: 0 0 0 4px rgba(15,118,110,.25);
        }
        .kt-timeline-range { accent-color: hsl(var(--primary)); height: 4px; cursor: pointer; }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <MapPin className="h-5 w-5 text-primary" /> Field Tracking
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Live GPS positions and today’s movement for on-duty employees
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Radio className="h-3 w-3" />
            {liveCount} live
          </span>
          <span className="text-xs text-muted-foreground">Updated {lastUpdated}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowManage(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90"
          >
            <Users className="h-3.5 w-3.5" /> Manage
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[17.5rem] shrink-0 flex-col overflow-hidden border-r border-border bg-background">
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              On duty · {liveEmployees.length}
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading crew…</div>
            ) : liveEmployees.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <SignalZero className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Nobody on the map yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Clocked-in employees with tracking enabled appear here.
                </p>
              </div>
            ) : (
              liveEmployees.map((emp, idx) => (
                <EmployeeCard
                  key={emp.employee_id}
                  emp={emp}
                  colorIndex={idx}
                  selected={selectedId === emp.employee_id}
                  onClick={() => handleSelect(emp.employee_id)}
                />
              ))
            )}
          </div>
        </aside>

        <div className="relative isolate z-0 flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <LeafletMap
              employees={liveEmployees}
              trail={showTrail && selectedId ? trail : []}
              selectedId={selectedId}
              activePing={showTrail ? activePing : null}
              recenterToken={recenterToken}
              onSelect={handleSelect}
            />

            {selected && (
              <div className="absolute left-3 top-3 z-[500] w-[min(20rem,calc(100%-1.5rem))] rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
                <div className="flex items-start gap-2.5">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: COLORS[Math.max(0, liveEmployees.findIndex((e) => e.employee_id === selected.employee_id)) % COLORS.length] }}
                  >
                    {initials(selected.full_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{selected.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">{selected.employee_code}</p>
                      </div>
                      <SignalBadge status={signalStatus(selected)} lastSeen={selected.last_seen_at} />
                    </div>
                    {selected.last_lat != null && selected.last_lng != null ? (
                      <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                        {selected.last_lat.toFixed(5)}, {selected.last_lng.toFixed(5)}
                      </p>
                    ) : (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-red-600">
                        <Signal className="h-3 w-3" /> Waiting for the first GPS ping
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  <button
                    type="button"
                    onClick={recenterSelected}
                    disabled={selected.last_lat == null}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
                  >
                    <Crosshair className="h-3.5 w-3.5" /> Recenter
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowTrail((v) => !v); setPlaying(false) }}
                    className={cn(
                      'inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium',
                      showTrail ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20',
                    )}
                  >
                    <Route className="h-3.5 w-3.5" />
                    {showTrail ? 'Hide timeline' : 'Timeline'}
                  </button>
                </div>
              </div>
            )}

            {!selected && !isLoading && liveEmployees.every((e) => e.last_lat == null) && liveEmployees.length > 0 && (
              <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center p-6">
                <div className="rounded-xl border border-border bg-card/95 px-5 py-4 text-center shadow-lg">
                  <SignalZero className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">On duty, but no GPS yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Last-known pins appear as soon as a device reports a location.</p>
                </div>
              </div>
            )}
          </div>

          {showTrail && selected && (
            <TimelinePanel
              employee={selected}
              trail={trail}
              isLoading={trailLoading}
              activeIndex={activePingIndex}
              playing={playing}
              onSelectPing={(index) => { setActivePingIndex(index); setPlaying(false) }}
              onTogglePlay={() => {
                if (playing) {
                  setPlaying(false)
                  return
                }
                if (activePingIndex != null && activePingIndex >= trail.length - 1) setActivePingIndex(0)
                setPlaying(true)
              }}
              onClose={() => { setShowTrail(false); setPlaying(false); setActivePingIndex(null) }}
            />
          )}
        </div>
      </div>

      {showManage && (
        <ManageTrackingModal
          employees={allEmployees}
          storeNameById={storeNameById}
          pending={toggleTracking.isPending}
          onToggle={(employeeId, enabled) => toggleTracking.mutate({ employeeId, enabled })}
          onClose={() => setShowManage(false)}
        />
      )}
    </div>
  )
}

function ManageTrackingModal({
  employees,
  storeNameById,
  pending,
  onToggle,
  onClose,
}: {
  employees: EmployeeProfile[]
  storeNameById: Record<string, string>
  pending: boolean
  onToggle: (employeeId: string, enabled: boolean) => void
  onClose: () => void
}) {
  useEscapeToClose(onClose)

  return (
    <div data-kiterp-modal className={cn(dialogOverlayClass, 'z-[1100]')} onClick={onModalBackdropClick(onClose)}>
      <div className={cn(dialogPanelClass, 'max-w-2xl')}>
        <div className={cn(dialogHeaderClass, 'flex items-center justify-between')}>
          <h2 className="font-semibold">Manage Location Tracking</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={cn(dialogBodyClass, '!px-0 !py-0')}>
          {employees.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No employees found.</p>
          ) : (
            <div className="divide-y">
              {employees.map((emp) => {
                const name = employeeDisplayName(emp)
                const code = emp.employee_code_custom || emp.employee_code
                const designation = emp.designation?.name?.trim() || ''
                const entity = employeeEntityLabel(emp, storeNameById)
                const location = employeeLocationLabel(emp)
                const manager = employeeManagerLabel(emp)
                const trackingOn = Boolean((emp as EmployeeProfile & { tracking_enabled?: boolean }).tracking_enabled)
                return (
                  <div key={emp.id} className="flex items-center gap-3 px-5 py-3">
                    <EmployeeAvatar name={name} src={employeeAvatarUrl(emp)} />
                    <div className="min-w-0 flex-1 grid grid-cols-3 gap-x-4 gap-y-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {name}
                        {code ? <span className="ml-1.5 font-normal text-muted-foreground">{code}</span> : null}
                      </p>
                      <p className="truncate text-sm text-foreground">{designation || 'No designation'}</p>
                      <p className="flex items-center gap-1 truncate text-sm text-foreground">
                        <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{manager || 'No manager'}</span>
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{entity || 'No entity'}</span>
                      </p>
                      <p className="col-span-2 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{location || 'No location assigned'}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => onToggle(emp.id, !trackingOn)}
                      className="shrink-0"
                      title={trackingOn ? 'Disable tracking' : 'Enable tracking'}
                    >
                      {trackingOn ? (
                        <ToggleRight className="h-8 w-8 text-primary" />
                      ) : (
                        <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className={cn(dialogFooterClass, 'justify-start text-xs text-muted-foreground')}>
          Employees are notified when tracking is enabled. Location is only collected while clocked in.
        </div>
      </div>
    </div>
  )
}
