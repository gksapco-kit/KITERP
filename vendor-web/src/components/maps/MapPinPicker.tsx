import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function FocusPin({ lat, lng, active }: { lat: number; lng: number; active: boolean }) {
  const map = useMap()
  const prevPin = useRef('')

  useEffect(() => {
    if (!active) return
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    if (key === prevPin.current) return
    prevPin.current = key
    map.whenReady(() => {
      map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true })
    })
  }, [lat, lng, active, map])

  return null
}

export function MapPinPicker({
  lat,
  lng,
  hasPin,
  onMapClick,
  height = '16rem',
}: {
  lat: number
  lng: number
  hasPin: boolean
  onMapClick: (lat: number, lng: number) => void
  height?: string
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ height, width: '100%' }}>
      <MapContainer
        center={[lat, lng]}
        zoom={hasPin ? 14 : 4}
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
            <FocusPin lat={lat} lng={lng} active={hasPin} />
          </>
        )}
        <MapClickHandler onClick={onMapClick} />
      </MapContainer>
    </div>
  )
}
