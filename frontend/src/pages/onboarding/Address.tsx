import { useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'

const LocationPicker = lazy(() => import('@/components/common/LocationPicker'))

const schema = z.object({
  street_address: z.string().min(5, 'Address must be at least 5 characters'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postal_code: z.string().min(4, 'Postal code is required'),
  country: z.string().default('India'),
  primary_email: z.string().email('Invalid email'),
  primary_phone: z.string().min(10, 'Phone must be at least 10 digits'),
  owner_name: z.string().min(2, 'Owner name is required'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  service_radius_km: z.number().int().min(1).max(500).default(10),
})

type FormData = z.infer<typeof schema>

export default function OnboardingAddress() {
  const navigate = useNavigate()
  const [lat, setLat] = useState<number | undefined>(undefined)
  const [lng, setLng] = useState<number | undefined>(undefined)
  const [radius, setRadius] = useState(10)

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: 'India', service_radius_km: 10 },
  })

  const onLocationChange = (newLat: number, newLng: number) => {
    setLat(newLat)
    setLng(newLng)
    setValue('latitude', newLat)
    setValue('longitude', newLng)
  }

  const onRadiusChange = (newRadius: number) => {
    setRadius(newRadius)
    setValue('service_radius_km', newRadius)
  }

  const onSubmit = (data: FormData) => {
    sessionStorage.setItem('onboarding_address', JSON.stringify(data))
    navigate('/onboarding/documents')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Business Address and Contact</h2>
        <p className="text-sm text-gray-600 mt-1">
          Where is your business located? Set your location and the radius within
          which you provide services or deliver products.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Owner / Contact */}
        <div>
          <Label htmlFor="owner_name">Owner Name</Label>
          <Input id="owner_name" {...register('owner_name')} className="mt-1" placeholder="Full name" />
          {errors.owner_name && <p className="mt-1 text-sm text-red-500">{errors.owner_name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="primary_email">Email</Label>
            <Input id="primary_email" type="email" {...register('primary_email')} className="mt-1" />
            {errors.primary_email && <p className="mt-1 text-sm text-red-500">{errors.primary_email.message}</p>}
          </div>
          <div>
            <Label htmlFor="primary_phone">Phone</Label>
            <Controller
              name="primary_phone"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  id="primary_phone"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  defaultCountryIso="IN"
                  autoComplete="tel"
                  name="primary_phone"
                  className="mt-1"
                />
              )}
            />
            {errors.primary_phone && <p className="mt-1 text-sm text-red-500">{errors.primary_phone.message}</p>}
          </div>
        </div>

        {/* Address fields */}
        <div>
          <Label htmlFor="street_address">Street Address</Label>
          <Input id="street_address" {...register('street_address')} className="mt-1" />
          {errors.street_address && <p className="mt-1 text-sm text-red-500">{errors.street_address.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register('city')} className="mt-1" />
            {errors.city && <p className="mt-1 text-sm text-red-500">{errors.city.message}</p>}
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input id="state" {...register('state')} className="mt-1" />
            {errors.state && <p className="mt-1 text-sm text-red-500">{errors.state.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="postal_code">Postal Code</Label>
            <Input id="postal_code" {...register('postal_code')} className="mt-1" />
            {errors.postal_code && <p className="mt-1 text-sm text-red-500">{errors.postal_code.message}</p>}
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Input id="country" {...register('country')} className="mt-1" disabled />
          </div>
        </div>

        {/* Map picker with service radius */}
        <div className="space-y-2">
          <Label className="text-base font-medium">Pin Your Location &amp; Service Radius</Label>
          <Suspense
            fallback={
              <div className="flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200" style={{ height: '360px' }}>
                <p className="text-gray-500 text-sm">Loading map...</p>
              </div>
            }
          >
            <LocationPicker
              latitude={lat}
              longitude={lng}
              radiusKm={radius}
              onLocationChange={onLocationChange}
              onRadiusChange={onRadiusChange}
              showRadius
              height="360px"
            />
          </Suspense>
          {(!lat || !lng) && (
            <p className="text-xs text-amber-600">
              Tip: Click on the map or use &quot;Use My Location&quot; to pin your business location.
            </p>
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={() => navigate('/onboarding/subdomain')}>
            Back
          </Button>
          <Button type="submit">Continue</Button>
        </div>
      </form>
    </div>
  )
}
