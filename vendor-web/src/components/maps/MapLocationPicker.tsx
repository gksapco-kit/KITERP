import { useCallback, useEffect, useState } from 'react'
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { geocodeAddress, reverseGeocode } from '@/lib/mapGeocoding'
import { MapPinPicker } from '@/components/maps/MapPinPicker'

export type MapLocationValue = {
  address: string
  lat: number | null
  lng: number | null
}

const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 }

function roundCoord(n: number): number {
  return parseFloat(n.toFixed(6))
}

function readCoord(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    const n = parseFloat(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function readMapBlockCoord(raw: unknown): number | null {
  return readCoord(raw)
}

export function MapLocationPicker({
  address,
  lat,
  lng,
  defaultCenter,
  onChange,
  onPreview,
  height = '220px',
}: {
  address: string
  lat: number | null | undefined
  lng: number | null | undefined
  defaultCenter?: { lat: number; lng: number }
  onChange: (value: MapLocationValue) => void
  onPreview?: (value: MapLocationValue) => void
  height?: string
}) {
  const resolvedLat = readCoord(lat)
  const resolvedLng = readCoord(lng)
  const hasPin = resolvedLat != null && resolvedLng != null
  const center = defaultCenter ?? DEFAULT_CENTER
  const mapLat = resolvedLat ?? center.lat
  const mapLng = resolvedLng ?? center.lng

  const [localAddress, setLocalAddress] = useState(address)
  const [latInput, setLatInput] = useState(resolvedLat != null ? String(resolvedLat) : '')
  const [lngInput, setLngInput] = useState(resolvedLng != null ? String(resolvedLng) : '')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    setLocalAddress(address)
    setLatInput(resolvedLat != null ? String(resolvedLat) : '')
    setLngInput(resolvedLng != null ? String(resolvedLng) : '')
  }, [address, resolvedLat, resolvedLng])
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emit = useCallback((next: MapLocationValue, preview = false) => {
    if (preview) onPreview?.(next)
    else onChange(next)
  }, [onChange, onPreview])

  const syncInputs = (nextLat: number | null, nextLng: number | null, nextAddress: string) => {
    setLatInput(nextLat != null ? String(nextLat) : '')
    setLngInput(nextLng != null ? String(nextLng) : '')
    setLocalAddress(nextAddress)
  }

  const applyCoords = async (nextLat: number, nextLng: number, nextAddress?: string) => {
    const latR = roundCoord(nextLat)
    const lngR = roundCoord(nextLng)
    let addressOut = nextAddress ?? localAddress
    if (!nextAddress) {
      try {
        const reversed = await reverseGeocode(latR, lngR)
        if (reversed) addressOut = reversed
      } catch {
        /* keep existing address */
      }
    }
    syncInputs(latR, lngR, addressOut)
    emit({ address: addressOut, lat: latR, lng: lngR })
  }

  const handleMapClick = (clickLat: number, clickLng: number) => {
    setError(null)
    void applyCoords(clickLat, clickLng)
  }

  const handleAddressSearch = async () => {
    const q = localAddress.trim()
    if (!q) {
      setError('Enter an address or lat, lng coordinates.')
      return
    }
    setError(null)
    setSearching(true)
    try {
      const hit = await geocodeAddress(q)
      if (!hit) {
        setError('Could not find that location. Try a fuller address or enter lat, lng.')
        return
      }
      syncInputs(hit.lat, hit.lng, hit.displayName)
      emit({ address: hit.displayName, lat: hit.lat, lng: hit.lng })
    } catch {
      setError('Address lookup failed. Check your connection and try again.')
    } finally {
      setSearching(false)
    }
  }

  const handleLatLngCommit = () => {
    const nextLat = parseFloat(latInput)
    const nextLng = parseFloat(lngInput)
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
      setError('Enter valid latitude and longitude values.')
      return
    }
    if (nextLat < -90 || nextLat > 90 || nextLng < -180 || nextLng > 180) {
      setError('Latitude must be between -90 and 90; longitude between -180 and 180.')
      return
    }
    setError(null)
    void applyCoords(nextLat, nextLng)
  }

  const useMyLocation = () => {
    setError(null)
    if (!navigator.geolocation) {
      setError('Location is not supported on this device.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        void applyCoords(pos.coords.latitude, pos.coords.longitude)
        setLocating(false)
      },
      err => {
        setLocating(false)
        setError(err.message || 'Could not detect your location.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground leading-snug">
        Enter the address, then click Find (or click the map / enter lat &amp; lng) so the storefront pin matches that location.
      </p>

      <MapPinPicker
        lat={mapLat}
        lng={mapLng}
        hasPin={hasPin}
        onMapClick={handleMapClick}
        height={height}
      />

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Address</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={localAddress}
              onChange={e => {
                const val = e.target.value
                setLocalAddress(val)
                // Changing the address invalidates the previous pin until Find / map click / lat-lng.
                if (val.trim() !== (address ?? '').trim()) {
                  setLatInput('')
                  setLngInput('')
                  onPreview?.({ address: val, lat: null, lng: null })
                } else {
                  onPreview?.({ address: val, lat: resolvedLat, lng: resolvedLng })
                }
              }}
              onBlur={() => {
                const trimmed = localAddress.trim()
                if (trimmed !== (address ?? '').trim()) {
                  emit({ address: trimmed, lat: null, lng: null })
                } else {
                  emit({ address: trimmed, lat: resolvedLat, lng: resolvedLng })
                }
              }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleAddressSearch() } }}
              placeholder="Street address, landmark, or 19.0760, 72.8777"
              className="h-9 pl-8 text-xs"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5 px-2.5 text-xs"
            disabled={searching}
            onClick={() => void handleAddressSearch()}
          >
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Find
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Latitude</Label>
          <Input
            type="number"
            step="any"
            value={latInput}
            onChange={e => setLatInput(e.target.value)}
            onBlur={handleLatLngCommit}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLatLngCommit() } }}
            placeholder="e.g. 19.0760"
            className="h-9 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-600">Longitude</Label>
          <Input
            type="number"
            step="any"
            value={lngInput}
            onChange={e => setLngInput(e.target.value)}
            onBlur={handleLatLngCommit}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleLatLngCommit() } }}
            placeholder="e.g. 72.8777"
            className="h-9 text-xs"
          />
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        disabled={locating}
        onClick={useMyLocation}
      >
        {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
        Use my location
      </Button>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
