import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const COVERAGE_CIRCLE = {
  color: '#16a34a',
  fillColor: '#22c55e',
  fillOpacity: 0.22,
  weight: 2,
} as const

/** Bounding box for a geodesic circle without attaching it to the map. */
function circleBounds(lat: number, lng: number, radiusM: number): L.LatLngBoundsExpression {
  const earthRadius = 6378137
  const latRad = (lat * Math.PI) / 180
  const latOffset = (radiusM / earthRadius) * (180 / Math.PI)
  const lngOffset = (radiusM / (earthRadius * Math.cos(latRad))) * (180 / Math.PI)
  return [
    [lat - latOffset, lng - lngOffset],
    [lat + latOffset, lng + lngOffset],
  ]
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function FocusPin({
  lat,
  lng,
  radiusKm,
  active,
}: {
  lat: number
  lng: number
  radiusKm: number
  active: boolean
}) {
  const map = useMap()
  const prevPin = useRef('')

  useEffect(() => {
    if (!active) return
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    if (key === prevPin.current) return
    prevPin.current = key

    const bounds = circleBounds(lat, lng, Math.max(radiusKm, 1) * 1000)
    map.whenReady(() => {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14, animate: true })
    })
  }, [lat, lng, radiusKm, active, map])

  return null
}

export function CoverageRadiusMap({
  lat,
  lng,
  radiusKm,
  hasPin,
  onMapClick,
  height = '18rem',
}: {
  lat: number
  lng: number
  radiusKm: number
  hasPin: boolean
  onMapClick: (lat: number, lng: number) => void
  height?: string
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ height, width: '100%' }}>
      <MapContainer
        center={[lat, lng]}
        zoom={hasPin ? 11 : 4}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasPin && (
          <>
            <Marker position={[lat, lng]} />
            <Circle
              center={[lat, lng]}
              radius={radiusKm * 1000}
              pathOptions={COVERAGE_CIRCLE}
            />
            <FocusPin lat={lat} lng={lng} radiusKm={radiusKm} active={hasPin} />
          </>
        )}
        <MapClickHandler onClick={onMapClick} />
      </MapContainer>
    </div>
  )
}
