import { useState, lazy, Suspense, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useVendorStore } from '@/stores/vendorStore'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff, isSuperuserAdmin } from '@/lib/platformAccess'
import { useUpdateVendor } from '@/hooks/useVendor'
import { adminApi } from '@/api/admin.api'
import { toast } from 'sonner'
import { MapPin, Save, Eye, EyeOff, Key, Loader2, ExternalLink } from 'lucide-react'

const LocationPicker = lazy(() => import('@/components/common/LocationPicker'))

export default function Settings() {
  const { vendor, setVendor } = useVendorStore()
  const { user } = useAuthStore()
  const updateVendor = useUpdateVendor()
  const isAdmin = isSuperuserAdmin(user)
  if (isPlatformStaff(user) && !isSuperuserAdmin(user)) {
    return <Navigate to="/dashboard" replace />
  }

  const [editingLocation, setEditingLocation] = useState(false)
  const [lat, setLat] = useState<number | undefined>(vendor?.latitude ?? undefined)
  const [lng, setLng] = useState<number | undefined>(vendor?.longitude ?? undefined)
  const [radius, setRadius] = useState(vendor?.service_radius_km ?? 10)

  // API Integrations state (admin only)
  const [gstApiKey, setGstApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    adminApi.getPlatformSettings().then(s => {
      setGstApiKey(s.gst_api_key || '')
    }).catch(() => {/* silently ignore if endpoint not ready */})
  }, [isAdmin])

  const handleSaveApiKey = async () => {
    setSavingKey(true)
    try {
      await adminApi.updatePlatformSettings({ gst_api_key: gstApiKey || null })
      toast.success('API key saved successfully')
    } catch {
      toast.error('Failed to save API key')
    } finally {
      setSavingKey(false)
    }
  }

  const handleTestApiKey = async () => {
    if (!gstApiKey) return
    setSavingKey(true)
    try {
      // First save, then test via vendor gst-lookup (uses platform key as fallback)
      await adminApi.updatePlatformSettings({ gst_api_key: gstApiKey })
      toast.success('Key saved. Test it by entering a GSTIN when adding a party in vendor-web.')
    } catch {
      toast.error('Failed to save key for testing')
    } finally {
      setSavingKey(false)
    }
  }

  const handleSaveLocation = async () => {
    if (!lat || !lng) {
      toast.error('Please select a location on the map')
      return
    }
    try {
      const updated = await updateVendor.mutateAsync({
        latitude: lat,
        longitude: lng,
        service_radius_km: radius,
      })
      setVendor(updated)
      setEditingLocation(false)
      toast.success('Location and service radius updated')
    } catch {
      toast.error('Failed to update location')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your store settings</p>
      </div>

      <div className="grid gap-6">
        {/* API Integrations — admin only */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-indigo-600" />
                API Integrations
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Platform-wide API keys used across all vendor stores.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* GSTINCheck */}
              <div className="border rounded-lg p-4 space-y-3 bg-indigo-50/30">
                <div>
                  <p className="text-sm font-semibold text-gray-800">GSTINCheck API Key</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Enables auto-fetch of party name &amp; address when a GSTIN is entered in any vendor store.{' '}
                    <a
                      href="https://gstincheck.co.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline inline-flex items-center gap-0.5"
                    >
                      Get 20 free lookups
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      value={gstApiKey}
                      onChange={e => setGstApiKey(e.target.value)}
                      placeholder="Paste GSTINCheck API key here"
                      className="pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestApiKey}
                    disabled={savingKey || !gstApiKey}
                    className="whitespace-nowrap"
                  >
                    {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Test & Save'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveApiKey}
                    disabled={savingKey}
                    className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700"
                  >
                    {savingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (
                      <><Save className="w-3.5 h-3.5 mr-1" />Save</>
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  {gstApiKey ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                      <span className="text-green-700">Key configured — GSTIN lookups active for all vendors</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      <span className="text-amber-700">No key — only offline PAN &amp; state extraction available</span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Store Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <dt className="text-gray-500">Business Name</dt>
              <dd className="font-medium">{vendor?.business_name}</dd>
              <dt className="text-gray-500">Display Name</dt>
              <dd className="font-medium">{vendor?.display_name}</dd>
              <dt className="text-gray-500">Store URL</dt>
              <dd className="font-medium">https://{vendor?.subdomain}.kiterp.com</dd>
              <dt className="text-gray-500">Status</dt>
              <dd className="font-medium capitalize">{vendor?.status}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium">{vendor?.primary_email}</dd>
              <dt className="text-gray-500">Phone</dt>
              <dd className="font-medium">{vendor?.primary_phone}</dd>
              <dt className="text-gray-500">Address</dt>
              <dd className="font-medium">
                {vendor?.street_address}, {vendor?.city}, {vendor?.state}
              </dd>
            </dl>
          </CardContent>
        </Card>

        {/* Location & Service Radius */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Location &amp; Service Radius
            </CardTitle>
            {!editingLocation && (
              <Button variant="outline" size="sm" onClick={() => setEditingLocation(true)}>
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!editingLocation ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <dt className="text-gray-500">Latitude</dt>
                <dd className="font-medium">{vendor?.latitude ?? 'Not set'}</dd>
                <dt className="text-gray-500">Longitude</dt>
                <dd className="font-medium">{vendor?.longitude ?? 'Not set'}</dd>
                <dt className="text-gray-500">Service Radius</dt>
                <dd className="font-medium">{vendor?.service_radius_km ?? 10} km</dd>
                <dt className="text-gray-500">Coverage Area</dt>
                <dd className="font-medium">
                  {vendor?.latitude && vendor?.longitude
                    ? `Customers within ${vendor.service_radius_km ?? 10} km of your location can discover you`
                    : 'Set your location to enable distance-based discovery'}
                </dd>
              </dl>
            ) : (
              <div className="space-y-4">
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height: '400px' }}>
                      <p className="text-gray-500 text-sm">Loading map...</p>
                    </div>
                  }
                >
                  <LocationPicker
                    latitude={lat}
                    longitude={lng}
                    radiusKm={radius}
                    onLocationChange={(newLat, newLng) => {
                      setLat(newLat)
                      setLng(newLng)
                    }}
                    onRadiusChange={setRadius}
                    showRadius
                    height="400px"
                  />
                </Suspense>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="cancel"
                    onClick={() => {
                      setEditingLocation(false)
                      setLat(vendor?.latitude ?? undefined)
                      setLng(vendor?.longitude ?? undefined)
                      setRadius(vendor?.service_radius_km ?? 10)
                    }}
                  >Cancel</Button>
                  <Button
                    onClick={handleSaveLocation}
                    disabled={updateVendor.isPending}
                    className="flex items-center gap-1.5"
                  >
                    <Save className="h-4 w-4" />
                    {updateVendor.isPending ? 'Saving...' : 'Save Location'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
