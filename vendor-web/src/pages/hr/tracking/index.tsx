/**
 * HR → Field Tracking
 * Live map of on-duty employees + per-employee GPS trail drawer.
 * Uses react-leaflet (already installed), no API key required.
 */
import { useState, useEffect, useRef } from 'react'
import { MapPin, RefreshCw, Users, Battery, Clock, ChevronRight, X, ToggleLeft, ToggleRight, Route, Navigation } from 'lucide-react'
import { useHRTrackingLive, useHRTrackingTrail, useHRToggleTracking, useHREmployees } from '@/hooks/useVendor'
import { cn } from '@/lib/utils'

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
  battery: number | null
  source: string
  recorded_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeSince(iso: string | null): string {
  if (!iso) return 'Unknown'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}

function batteryColor(pct: number | null): string {
  if (pct === null) return 'text-gray-400'
  if (pct <= 20) return 'text-red-500'
  if (pct <= 50) return 'text-orange-500'
  return 'text-green-500'
}

const COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
  '#0891b2', '#be185d', '#65a30d', '#9333ea', '#0d9488',
]

// ── Lazy Leaflet map ──────────────────────────────────────────────────────────
function LeafletMap({
  employees,
  trail,
  selectedId,
  onSelect,
}: {
  employees: LiveEmployee[]
  trail: TrailPoint[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<Record<string, any>>({})
  const polylineRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    let L: any
    import('leaflet').then((mod) => {
      L = mod.default
      leafletRef.current = L

      // Fix default icon paths (bundler issue with Leaflet)
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapContainerRef.current!, {
        center: [20.5937, 78.9629], // India fallback
        zoom: 5,
        zoomControl: true,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)
      mapRef.current = map
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update employee markers
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return

    // Remove stale markers
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
      const size = isSelected ? 14 : 10

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:${color};border:2px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,.4);
          ${isSelected ? 'outline:3px solid ' + color + ';outline-offset:2px;' : ''}
        "></div>
        <div style="
          position:absolute;top:${size + 2}px;left:50%;transform:translateX(-50%);
          white-space:nowrap;background:white;padding:2px 6px;border-radius:4px;
          font-size:10px;font-weight:600;color:#111;box-shadow:0 1px 4px rgba(0,0,0,.2);
        ">${emp.employee_code || emp.full_name}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })

      const latlng: [number, number] = [emp.last_lat, emp.last_lng]
      bounds.push(latlng)

      if (markersRef.current[emp.employee_id]) {
        markersRef.current[emp.employee_id]
          .setLatLng(latlng)
          .setIcon(icon)
      } else {
        const marker = L.marker(latlng, { icon })
          .addTo(map)
          .on('click', () => onSelect(emp.employee_id))
        markersRef.current[emp.employee_id] = marker
      }
    })

    if (bounds.length && !selectedId) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
    }
  }, [employees, selectedId, onSelect])

  // Draw trail polyline
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return

    if (polylineRef.current) {
      polylineRef.current.remove()
      polylineRef.current = null
    }
    if (trail.length < 2) return

    const latlngs = trail.map((p) => [p.lat, p.lng] as [number, number])
    polylineRef.current = L.polyline(latlngs, {
      color: '#2563eb',
      weight: 3,
      opacity: 0.7,
      dashArray: '6 4',
    }).addTo(map)

    map.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] })
  }, [trail])

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div ref={mapContainerRef} className="w-full h-full rounded-xl" />
    </>
  )
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
  const hasLoc = emp.last_lat != null && emp.last_lng != null

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:bg-muted/50',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: color }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{emp.full_name}</p>
          <p className="text-xs text-muted-foreground">{emp.employee_code}</p>
        </div>
        {hasLoc ? (
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground">{timeSince(emp.last_seen_at)}</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground shrink-0">No signal</span>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </div>
    </button>
  )
}

// ── Trail drawer ──────────────────────────────────────────────────────────────
function TrailDrawer({
  employeeId,
  onClose,
}: {
  employeeId: string
  onClose: () => void
}) {
  const today = new Date()
  const isoDate = today.toISOString().split('T')[0]
  const fromDt = `${isoDate}T00:00:00`
  const toDt = `${isoDate}T23:59:59`

  const { data, isLoading } = useHRTrackingTrail(employeeId, {
    from_dt: fromDt,
    to_dt: toDt,
  })

  const trail = data?.trail ?? []

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-background border-l shadow-xl z-10 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div>
          <p className="font-semibold text-sm">{data?.full_name || '…'}</p>
          <p className="text-xs text-muted-foreground">{data?.employee_code}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-2 border-b bg-muted/30">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Route className="w-3 h-3" /> Today's trail — {trail.length} pings
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading trail…</div>
        ) : trail.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No location data for today yet.
          </div>
        ) : (
          <div className="divide-y">
            {[...trail].reverse().map((p, i) => (
              <div key={i} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono text-foreground">
                      {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.recorded_at).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {p.battery != null && (
                      <span className={cn('text-xs flex items-center gap-0.5', batteryColor(p.battery))}>
                        <Battery className="w-3 h-3" /> {p.battery}%
                      </span>
                    )}
                    {p.speed != null && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Navigation className="w-3 h-3" /> {(p.speed * 3.6).toFixed(1)} km/h
                      </span>
                    )}
                    {p.accuracy != null && (
                      <span className="text-xs text-muted-foreground">
                        ±{p.accuracy.toFixed(0)}m
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FieldTrackingPage() {
  const { data: liveData, isLoading, refetch, dataUpdatedAt } = useHRTrackingLive(30_000)
  const { data: allEmpsData } = useHREmployees({ limit: 200, status: 'active' })
  const toggleTracking = useHRToggleTracking()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showTrail, setShowTrail] = useState(false)
  const [showManage, setShowManage] = useState(false)

  const liveEmployees: LiveEmployee[] = liveData?.items ?? []
  const allEmployees: any[] = allEmpsData?.items ?? []

  const { data: trailData } = useHRTrackingTrail(
    showTrail ? selectedId : null,
    showTrail ? undefined : undefined,
  )
  const trail: TrailPoint[] = trailData?.trail ?? []

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id))
    setShowTrail(false)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b bg-background">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" /> Field Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live GPS positions of on-duty employees
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Updated {lastUpdated}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowManage((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Users className="w-3.5 h-3.5" /> Manage
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar: live employee list */}
        <div className="w-64 border-r bg-background flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              On-Duty ({liveEmployees.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
            ) : liveEmployees.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No employees currently on duty with tracking enabled.
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

          {/* View trail button */}
          {selectedId && (
            <div className="p-2 border-t">
              <button
                type="button"
                onClick={() => setShowTrail((v) => !v)}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2 text-sm rounded-lg font-medium transition-colors',
                  showTrail
                    ? 'bg-primary text-white'
                    : 'bg-primary/10 text-primary hover:bg-primary/20',
                )}
              >
                <Route className="w-4 h-4" />
                {showTrail ? 'Hide Trail' : "Today's Trail"}
              </button>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative isolate">
          <LeafletMap
            employees={liveEmployees}
            trail={showTrail ? trail : []}
            selectedId={selectedId}
            onSelect={handleSelect}
          />

          {/* Trail drawer */}
          {showTrail && selectedId && (
            <TrailDrawer
              employeeId={selectedId}
              onClose={() => setShowTrail(false)}
            />
          )}
        </div>
      </div>

      {/* Manage tracking modal */}
      {showManage && (
        <div
          data-kiterp-modal
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowManage(false) }}
        >
          <div className="bg-background rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold">Manage Location Tracking</h2>
              <button type="button" onClick={() => setShowManage(false)} className="p-1.5 hover:bg-muted rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {allEmployees.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">No employees found.</p>
              ) : (
                <div className="divide-y">
                  {allEmployees.map((emp: any) => (
                    <div key={emp.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium">{emp.full_name}</p>
                        <p className="text-xs text-muted-foreground">{emp.employee_code}</p>
                      </div>
                      <button
                        type="button"
                        disabled={toggleTracking.isPending}
                        onClick={() =>
                          toggleTracking.mutate({
                            employeeId: emp.id,
                            enabled: !emp.tracking_enabled,
                          })
                        }
                        className="shrink-0"
                        title={emp.tracking_enabled ? 'Disable tracking' : 'Enable tracking'}
                      >
                        {emp.tracking_enabled ? (
                          <ToggleRight className="w-8 h-8 text-primary" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t text-xs text-muted-foreground">
              Employees are notified when tracking is enabled. Location is only collected while clocked in.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
