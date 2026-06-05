import { useState } from 'react'
import { Loader2, MapPin, Navigation, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export type QuoteLocationValue = {
  address?: string
  lat?: number
  lng?: number
}

export function parseQuoteLocation(raw: string): QuoteLocationValue {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as QuoteLocationValue
    if (parsed && (parsed.address || (parsed.lat != null && parsed.lng != null))) return parsed
  } catch {
    /* plain address string */
  }
  return { address: raw.trim() }
}

export function serializeQuoteLocation(value: QuoteLocationValue): string {
  if (value.lat != null && value.lng != null) {
    return JSON.stringify({
      address: value.address?.trim() || '',
      lat: value.lat,
      lng: value.lng,
    })
  }
  return value.address?.trim() || ''
}

export function quoteLocationIsEmpty(raw: string): boolean {
  const v = parseQuoteLocation(raw)
  return !v.address?.trim() && (v.lat == null || v.lng == null)
}

function mapsSearchUrl(value: QuoteLocationValue): string {
  if (value.lat != null && value.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${value.lat},${value.lng}`
  }
  if (value.address?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value.address.trim())}`
  }
  return 'https://www.google.com/maps'
}

function nativeMapsUrl(value: QuoteLocationValue): string {
  const q = value.lat != null && value.lng != null
    ? `${value.lat},${value.lng}`
    : encodeURIComponent(value.address?.trim() || '')
  const isApple = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (isApple) {
    return value.lat != null && value.lng != null
      ? `http://maps.apple.com/?ll=${value.lat},${value.lng}&q=${encodeURIComponent(value.address || 'Selected location')}`
      : `http://maps.apple.com/?q=${q}`
  }
  return value.lat != null && value.lng != null
    ? `geo:${value.lat},${value.lng}?q=${value.lat},${value.lng}`
    : `geo:0,0?q=${q}`
}

type QuoteLocationFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputClassName?: string
  disabled?: boolean
}

export function QuoteLocationField({
  value,
  onChange,
  placeholder = 'Address or landmark',
  inputClassName,
  disabled,
}: QuoteLocationFieldProps) {
  const parsed = parseQuoteLocation(value)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)

  const update = (next: QuoteLocationValue) => {
    onChange(serializeQuoteLocation(next))
  }

  const handleAddressChange = (address: string) => {
    update({
      address,
      lat: parsed.lat,
      lng: parsed.lng,
    })
  }

  const useCurrentLocation = () => {
    if (disabled) return
    setLocError(null)
    if (!navigator.geolocation) {
      setLocError('Location is not supported on this device.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6))
        const lng = parseFloat(pos.coords.longitude.toFixed(6))
        update({
          address: parsed.address || `${lat}, ${lng}`,
          lat,
          lng,
        })
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        setLocError(err.message || 'Could not detect your location.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  const openMaps = () => {
    const url = nativeMapsUrl(parsed)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const openMapsSearch = () => {
    window.open(mapsSearchUrl(parsed), '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          type="text"
          value={parsed.address || ''}
          onChange={(e) => handleAddressChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`pl-9 ${inputClassName || ''}`}
        />
      </div>

      {parsed.lat != null && parsed.lng != null && (
        <p className="text-xs text-gray-500">
          Pin: {parsed.lat.toFixed(5)}, {parsed.lng.toFixed(5)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || locating}
          onClick={useCurrentLocation}
          className="h-8 gap-1.5 text-xs"
        >
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
          Use my location
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={openMaps}
          className="h-8 gap-1.5 text-xs"
        >
          <MapPin className="h-3.5 w-3.5" />
          Open Maps
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={openMapsSearch}
          className="h-8 gap-1.5 text-xs text-gray-600"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Search in Google Maps
        </Button>
      </div>

      {locError && <p className="text-xs text-red-500">{locError}</p>}
      <p className="text-xs text-gray-400">
        Pick a spot in your maps app, then paste the address here or use your current location.
      </p>
    </div>
  )
}
