import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, Crosshair, Minus, Plus } from 'lucide-react'

// Fix default marker icon (Leaflet bundling issue with Vite/Webpack)
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

/* ------------------------------------------------------------------ */
/*  Internal helpers for react-leaflet                                */
/* ------------------------------------------------------------------ */

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  const prev = useRef('')
  useEffect(() => {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`
    if (key !== prev.current) {
      map.setView([lat, lng], map.getZoom(), { animate: true })
      prev.current = key
    }
  }, [lat, lng, map])
  return null
}

function MapRefCapture({ onRef }: { onRef: (m: L.Map) => void }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (!done.current) {
      onRef(map)
      done.current = true
    }
  }, [map, onRef])
  return null
}

/* ------------------------------------------------------------------ */
/*  Public component                                                  */
/* ------------------------------------------------------------------ */

interface LocationPickerProps {
  latitude?: number | null
  longitude?: number | null
  radiusKm?: number
  onLocationChange: (lat: number, lng: number) => void
  onRadiusChange?: (radiusKm: number) => void
  showRadius?: boolean
  height?: string
}

export default function LocationPicker({
  latitude,
  longitude,
  radiusKm = 10,
  onLocationChange,
  onRadiusChange,
  showRadius = false,
  height = '350px',
}: LocationPickerProps) {
  const [lat, setLat] = useState<number>(latitude ?? 17.385)
  const [lng, setLng] = useState<number>(longitude ?? 78.4867)
  const [radius, setRadius] = useState(radiusKm)
  const [locating, setLocating] = useState(false)
  const mapInstanceRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (latitude != null) setLat(latitude)
    if (longitude != null) setLng(longitude)
  }, [latitude, longitude])

  useEffect(() => {
    setRadius(radiusKm)
  }, [radiusKm])

  const handleMapClick = useCallback(
    (clickLat: number, clickLng: number) => {
      setLat(clickLat)
      setLng(clickLng)
      onLocationChange(clickLat, clickLng)
    },
    [onLocationChange]
  )

  const handleLocateMe = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: geoLat, longitude: geoLng } = pos.coords
        setLat(geoLat)
        setLng(geoLng)
        onLocationChange(geoLat, geoLng)
        mapInstanceRef.current?.setView([geoLat, geoLng], 14)
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true }
    )
  }

  const handleRadiusChange = (newRadius: number) => {
    const clamped = Math.max(1, Math.min(500, newRadius))
    setRadius(clamped)
    onRadiusChange?.(clamped)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="h-4 w-4" />
          <span>Click on the map or use the button to set location</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleLocateMe}
          disabled={locating}
          className="flex items-center gap-1.5"
        >
          <Crosshair className="h-3.5 w-3.5" />
          {locating ? 'Locating...' : 'Use My Location'}
        </Button>
      </div>

      {/* Map container */}
      <div
        className="rounded-lg overflow-hidden border border-gray-200"
        style={{ height, width: '100%' }}
      >
        <MapContainer
          center={[lat, lng]}
          zoom={13}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[lat, lng]} />
          {showRadius && (
            <Circle
              center={[lat, lng]}
              radius={radius * 1000}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.08,
                weight: 2,
              }}
            />
          )}
          <MapClickHandler onClick={handleMapClick} />
          <RecenterMap lat={lat} lng={lng} />
          <MapRefCapture onRef={(m) => { mapInstanceRef.current = m }} />
        </MapContainer>
      </div>

      {/* Lat / Lng fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500">Latitude</Label>
          <Input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) { setLat(v); onLocationChange(v, lng) }
            }}
            className="mt-0.5 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Longitude</Label>
          <Input
            type="number"
            step="any"
            value={lng}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) { setLng(v); onLocationChange(lat, v) }
            }}
            className="mt-0.5 text-sm"
          />
        </div>
      </div>

      {/* Radius slider */}
      {showRadius && (
        <div className="space-y-2 rounded-lg border border-gray-200 p-3 bg-gray-50">
          <Label className="text-sm font-medium">Service Radius</Label>
          <div className="flex items-center gap-3">
            <Button
              type="button" variant="outline" size="sm" className="h-8 w-8 p-0"
              onClick={() => handleRadiusChange(radius - 5)}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <div className="flex items-center gap-2 flex-1">
              <input
                type="range" min={1} max={200} value={radius}
                onChange={(e) => handleRadiusChange(parseInt(e.target.value, 10))}
                className="flex-1 accent-blue-600"
              />
              <span className="text-sm font-semibold w-20 text-right">{radius} km</span>
            </div>
            <Button
              type="button" variant="outline" size="sm" className="h-8 w-8 p-0"
              onClick={() => handleRadiusChange(radius + 5)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Customers within this radius will see your products and services.
          </p>
        </div>
      )}
    </div>
  )
}
