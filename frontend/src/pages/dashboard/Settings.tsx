import { useState, lazy, Suspense, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useVendorStore } from '@/stores/vendorStore'
import { useAuthStore } from '@/stores/authStore'
import { isPlatformStaff, isSuperuserAdmin } from '@/lib/platformAccess'
import { useUpdateVendor } from '@/hooks/useVendor'
import { adminApi } from '@/api/admin.api'
import { toast } from 'sonner'
import { MapPin, Save, Eye, EyeOff, Key, Loader2, ExternalLink } from 'lucide-react'

const LocationPicker = lazy(() => import('@/components/common/LocationPicker'))

function formatAddress(vendor: {
  street_address?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
} | null | undefined) {
  if (!vendor) return 'Not set'
  const parts = [vendor.street_address, vendor.city, vendor.state, vendor.postal_code]
    .map((p) => (p || '').trim())
    .filter(Boolean)
  return parts.length ? parts.join(', ') : 'Not set'
}

export default function Settings() {
  const { vendor, setVendor } = useVendorStore()
  const { user } = useAuthStore()
  const updateVendor = useUpdateVendor()
  const isAdmin = isSuperuserAdmin(user)
  if (isPlatformStaff(user) && !isSuperuserAdmin(user)) {
    return <Navigate to="/dashboard" replace />
  }

  const [editingContact, setEditingContact] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [platformContact, setPlatformContact] = useState({
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    postal: '',
  })
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactStreet, setContactStreet] = useState('')
  const [contactCity, setContactCity] = useState('')
  const [contactState, setContactState] = useState('')
  const [contactPostal, setContactPostal] = useState('')

  const [editingLocation, setEditingLocation] = useState(false)
  const [lat, setLat] = useState<number | undefined>(vendor?.latitude ?? undefined)
  const [lng, setLng] = useState<number | undefined>(vendor?.longitude ?? undefined)
  const [radius, setRadius] = useState(vendor?.service_radius_km ?? 10)

  // API Integrations state (admin only)
  const [gstApiKey, setGstApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)

  /** Platform admins have no /vendors/me — use platform settings contact instead. */
  const usePlatformContact = isAdmin && !vendor

  const displayContact = usePlatformContact
    ? {
        email: platformContact.email,
        phone: platformContact.phone,
        street_address: platformContact.street,
        city: platformContact.city,
        state: platformContact.state,
        postal_code: platformContact.postal,
      }
    : {
        email: vendor?.primary_email || vendor?.support_email || '',
        phone: vendor?.primary_phone || vendor?.support_phone || '',
        street_address: vendor?.street_address,
        city: vendor?.city,
        state: vendor?.state,
        postal_code: vendor?.postal_code,
      }

  useEffect(() => {
    if (!isAdmin) return
    adminApi
      .getPlatformSettings()
      .then((s) => {
        setGstApiKey(s.gst_api_key || '')
        setPlatformContact({
          email: s.contact_email || '',
          phone: s.contact_phone || '',
          street: s.contact_street_address || '',
          city: s.contact_city || '',
          state: s.contact_state || '',
          postal: s.contact_postal_code || '',
        })
      })
      .catch(() => {
        /* silently ignore if endpoint not ready */
      })
  }, [isAdmin])

  useEffect(() => {
    if (editingContact) return
    if (usePlatformContact) {
      setContactEmail(platformContact.email)
      setContactPhone(platformContact.phone)
      setContactStreet(platformContact.street)
      setContactCity(platformContact.city)
      setContactState(platformContact.state)
      setContactPostal(platformContact.postal)
      return
    }
    setContactEmail(vendor?.primary_email || vendor?.support_email || '')
    setContactPhone(vendor?.primary_phone || vendor?.support_phone || '')
    setContactStreet(vendor?.street_address ?? '')
    setContactCity(vendor?.city ?? '')
    setContactState(vendor?.state ?? '')
    setContactPostal(vendor?.postal_code ?? '')
  }, [
    usePlatformContact,
    platformContact,
    vendor?.primary_email,
    vendor?.support_email,
    vendor?.primary_phone,
    vendor?.support_phone,
    vendor?.street_address,
    vendor?.city,
    vendor?.state,
    vendor?.postal_code,
    editingContact,
  ])

  const resetContactForm = () => {
    if (usePlatformContact) {
      setContactEmail(platformContact.email)
      setContactPhone(platformContact.phone)
      setContactStreet(platformContact.street)
      setContactCity(platformContact.city)
      setContactState(platformContact.state)
      setContactPostal(platformContact.postal)
    } else {
      setContactEmail(vendor?.primary_email || vendor?.support_email || '')
      setContactPhone(vendor?.primary_phone || vendor?.support_phone || '')
      setContactStreet(vendor?.street_address ?? '')
      setContactCity(vendor?.city ?? '')
      setContactState(vendor?.state ?? '')
      setContactPostal(vendor?.postal_code ?? '')
    }
    setEditingContact(false)
  }

  const handleSaveContact = async () => {
    const email = contactEmail.trim()
    const phone = contactPhone.trim()
    if (!email) {
      toast.error('Email is required')
      return
    }
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      toast.error('Phone number must have at least 10 digits')
      return
    }

    const street = contactStreet.trim()
    const city = contactCity.trim()
    const state = contactState.trim()
    const postal = contactPostal.trim()

    if (usePlatformContact) {
      setSavingContact(true)
      try {
        await adminApi.updatePlatformSettings({
          contact_email: email,
          contact_phone: phone,
          contact_street_address: street || null,
          contact_city: city || null,
          contact_state: state || null,
          contact_postal_code: postal || null,
        })
        setPlatformContact({ email, phone, street, city, state, postal })
        setEditingContact(false)
        toast.success('Contact information saved')
      } catch {
        toast.error('Failed to save contact information')
      } finally {
        setSavingContact(false)
      }
      return
    }

    if (!vendor) {
      toast.error('No store profile is linked to this account')
      return
    }

    try {
      const payload: Parameters<typeof updateVendor.mutateAsync>[0] = {
        primary_email: email,
        primary_phone: phone,
        support_email: email,
        support_phone: phone,
      }
      if (street) payload.street_address = street
      if (city) payload.city = city
      if (state) payload.state = state
      if (postal) payload.postal_code = postal

      const updated = await updateVendor.mutateAsync(payload)
      setVendor(updated)
      setEditingContact(false)
    } catch {
      // useUpdateVendor already toasts the API error
    }
  }

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
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Contact Information</CardTitle>
              {usePlatformContact && (
                <p className="text-xs text-gray-500 mt-1 font-normal">
                  Platform support contact (saved in admin settings). For a storefront site, also set
                  contact under that business in Business Accounts or vendor Settings.
                </p>
              )}
            </div>
            {!editingContact && (
              <Button variant="outline" size="sm" onClick={() => setEditingContact(true)}>
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!editingContact ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium">{displayContact.email || 'Not set'}</dd>
                <dt className="text-gray-500">Phone</dt>
                <dd className="font-medium">{displayContact.phone || 'Not set'}</dd>
                <dt className="text-gray-500">Address</dt>
                <dd className="font-medium">{formatAddress(displayContact)}</dd>
              </dl>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="business@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-phone">Phone</Label>
                    <Input
                      id="contact-phone"
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="contact-street">Street address</Label>
                    <Input
                      id="contact-street"
                      value={contactStreet}
                      onChange={(e) => setContactStreet(e.target.value)}
                      placeholder="Street address"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-city">City</Label>
                    <Input
                      id="contact-city"
                      value={contactCity}
                      onChange={(e) => setContactCity(e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-state">State</Label>
                    <Input
                      id="contact-state"
                      value={contactState}
                      onChange={(e) => setContactState(e.target.value)}
                      placeholder="State"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-postal">Postal code</Label>
                    <Input
                      id="contact-postal"
                      value={contactPostal}
                      onChange={(e) => setContactPostal(e.target.value)}
                      placeholder="Postal code"
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="cancel" onClick={resetContactForm} disabled={savingContact}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveContact}
                    disabled={savingContact || updateVendor.isPending}
                    className="flex items-center gap-1.5"
                  >
                    <Save className="h-4 w-4" />
                    {savingContact || updateVendor.isPending ? 'Saving...' : 'Save Contact'}
                  </Button>
                </div>
              </div>
            )}
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
