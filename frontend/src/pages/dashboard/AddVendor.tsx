import { useState, lazy, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Navigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminApi } from '@/api/admin.api'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'
import { adminKeys } from '@/hooks/useAdmin'
import { ArrowLeft, Loader2, MapPin, UserPlus, Copy, CheckCircle2 } from 'lucide-react'

const LocationPicker = lazy(() => import('@/components/common/LocationPicker'))

const addVendorSchema = z.object({
  owner_email: z.string().email('Valid email required'),
  owner_password: z.string().min(6, 'Min 6 characters').max(128),
  owner_name: z.string().min(2, 'Min 2 characters').max(255),
  owner_phone: z.string().optional().or(z.literal('')),
  business_name: z.string().min(2, 'Min 2 characters').max(255),
  display_name: z.string().min(2, 'Min 2 characters').max(255),
  slug: z
    .string()
    .min(3, 'Min 3 characters')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens')
    .refine((v) => !v.startsWith('-') && !v.endsWith('-'), 'Cannot start or end with hyphen'),
  business_type: z.enum(['individual', 'partnership', 'llc', 'corporation', 'proprietorship']),
  offering_type: z.enum(['products', 'services', 'both']).default('both'),
  industry: z.string().min(2, 'Min 2 characters').max(100),
  description: z.string().max(2000).optional().or(z.literal('')),
  primary_phone: z.string().min(10, 'Min 10 digits').max(20),
  street_address: z.string().min(5, 'Min 5 characters').max(500),
  city: z.string().min(2, 'Min 2 characters').max(100),
  state: z.string().min(2, 'Min 2 characters').max(100),
  postal_code: z.string().min(4, 'Min 4 characters').max(20),
  country: z.string().default('India'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  service_radius_km: z.number().int().min(1).max(500).default(10),
})

type AddVendorForm = z.infer<typeof addVendorSchema>

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export default function AddVendor() {
  const { user } = useAuthStore()
  if (!isSuperuserAdmin(user)) {
    return <Navigate to="/dashboard/vendors" replace />
  }
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [lat, setLat] = useState<number | undefined>(undefined)
  const [lng, setLng] = useState<number | undefined>(undefined)
  const [radius, setRadius] = useState(10)
  const [createdResult, setCreatedResult] = useState<{
    vendor: { display_name: string; slug: string; subdomain: string }
    owner_account: { email: string; password: string; user_created: boolean }
  } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AddVendorForm>({
    resolver: zodResolver(addVendorSchema),
    defaultValues: {
      business_type: 'individual',
      offering_type: 'both',
      country: 'India',
      service_radius_km: 10,
      owner_password: generatePassword(),
    },
  })

  const handleBusinessNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    register('business_name').onChange(e)
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    setValue('slug', slug, { shouldValidate: true })
    setValue('display_name', value, { shouldValidate: true })
  }

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

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const createVendor = useMutation({
    mutationFn: (data: AddVendorForm) =>
      adminApi.createVendor({
        owner_email: data.owner_email,
        owner_password: data.owner_password,
        owner_name: data.owner_name,
        owner_phone: data.owner_phone || undefined,
        business_name: data.business_name,
        display_name: data.display_name,
        slug: data.slug,
        business_type: data.business_type,
        offering_type: data.offering_type,
        industry: data.industry,
        description: data.description || undefined,
        primary_phone: data.primary_phone,
        street_address: data.street_address,
        city: data.city,
        state: data.state,
        postal_code: data.postal_code,
        country: data.country,
        latitude: data.latitude,
        longitude: data.longitude,
        service_radius_km: data.service_radius_km ?? 10,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.vendors() })
      queryClient.invalidateQueries({ queryKey: adminKeys.vendorStats() })
      setCreatedResult(result)
      toast.success('Vendor created with owner account!')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create vendor'
      toast.error(message)
    },
  })

  const onSubmit = (data: AddVendorForm) => {
    createVendor.mutate(data)
  }

  // Success screen — show login credentials
  if (createdResult) {
    const { vendor, owner_account } = createdResult
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="text-center pt-8">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Vendor Created</h1>
          <p className="text-gray-600 mt-2">
            <strong>{vendor.display_name}</strong> has been registered successfully.
          </p>
        </div>

        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <UserPlus className="w-5 h-5" />
              Owner Login Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-green-700">
              {owner_account.user_created
                ? 'A new user account has been created. Share these credentials with the vendor owner:'
                : 'The owner already had an account. Their existing password was not changed.'}
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                  <p className="font-mono font-medium">{owner_account.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(owner_account.email, 'email')}
                  className="gap-1"
                >
                  {copiedField === 'email' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {copiedField === 'email' ? 'Copied' : 'Copy'}
                </Button>
              </div>

              {owner_account.user_created && (
                <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Password</p>
                    <p className="font-mono font-medium">{owner_account.password}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(owner_account.password, 'password')}
                    className="gap-1"
                  >
                    {copiedField === 'password' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copiedField === 'password' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}

              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Storefront</p>
                <p className="font-mono text-sm">{vendor.slug}.yourdomain.com</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => navigate('/dashboard/vendors')}>
            Back to Vendors
          </Button>
          <Button onClick={() => {
            setCreatedResult(null)
            setValue('owner_password', generatePassword())
          }}>
            Create Another Vendor
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/vendors')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Vendor</h1>
          <p className="text-gray-600 mt-1">Register a new vendor with an owner login account</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Owner Account */}
        <Card className="border-blue-200 bg-blue-50/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              Owner Login Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Create a login account for the vendor owner. They will use these credentials to access the vendor dashboard.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner_name">Owner Full Name *</Label>
                <Input id="owner_name" {...register('owner_name')} placeholder="e.g. Rahul Sharma" />
                {errors.owner_name && <p className="text-xs text-red-500">{errors.owner_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner_phone">Owner Phone</Label>
                <Input id="owner_phone" {...register('owner_phone')} placeholder="+91 9876543210" />
                {errors.owner_phone && <p className="text-xs text-red-500">{errors.owner_phone.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner_email">Login Email *</Label>
                <Input id="owner_email" type="email" {...register('owner_email')} placeholder="owner@vendor.com" />
                {errors.owner_email && <p className="text-xs text-red-500">{errors.owner_email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner_password">Login Password *</Label>
                <div className="flex gap-2">
                  <Input id="owner_password" {...register('owner_password')} className="font-mono" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={() => setValue('owner_password', generatePassword())}
                  >
                    Generate
                  </Button>
                </div>
                {errors.owner_password && <p className="text-xs text-red-500">{errors.owner_password.message}</p>}
                <p className="text-xs text-gray-500">Auto-generated. You can change it or share it with the vendor owner.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Information */}
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business_name">Business Name *</Label>
                <Input
                  id="business_name"
                  {...register('business_name')}
                  onChange={handleBusinessNameChange}
                  placeholder="e.g. Acme Technologies"
                />
                {errors.business_name && <p className="text-xs text-red-500">{errors.business_name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name *</Label>
                <Input id="display_name" {...register('display_name')} placeholder="e.g. Acme Tech" />
                {errors.display_name && <p className="text-xs text-red-500">{errors.display_name.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug *</Label>
                <Input id="slug" {...register('slug')} placeholder="e.g. acme-tech" className="lowercase" />
                {errors.slug && <p className="text-xs text-red-500">{errors.slug.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_type">Business Type *</Label>
                <select
                  id="business_type"
                  {...register('business_type')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="individual">Individual</option>
                  <option value="partnership">Partnership</option>
                  <option value="llc">LLC</option>
                  <option value="corporation">Corporation</option>
                  <option value="proprietorship">Proprietorship</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="offering_type">What Does This Vendor Offer? *</Label>
                <select
                  id="offering_type"
                  {...register('offering_type')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="both">Products & Services</option>
                  <option value="products">Products Only</option>
                  <option value="services">Services Only</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry *</Label>
                <Input id="industry" {...register('industry')} placeholder="e.g. Technology" />
                {errors.industry && <p className="text-xs text-red-500">{errors.industry.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                {...register('description')}
                rows={3}
                placeholder="Brief description of the business..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_phone">Business Phone *</Label>
                <Input id="primary_phone" {...register('primary_phone')} placeholder="+91 9876543210" />
                {errors.primary_phone && <p className="text-xs text-red-500">{errors.primary_phone.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="street_address">Street Address *</Label>
              <Input id="street_address" {...register('street_address')} placeholder="123 Business St, Suite 100" />
              {errors.street_address && <p className="text-xs text-red-500">{errors.street_address.message}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City *</Label>
                <Input id="city" {...register('city')} placeholder="Mumbai" />
                {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Input id="state" {...register('state')} placeholder="Maharashtra" />
                {errors.state && <p className="text-xs text-red-500">{errors.state.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal_code">Postal Code *</Label>
                <Input id="postal_code" {...register('postal_code')} placeholder="400001" />
                {errors.postal_code && <p className="text-xs text-red-500">{errors.postal_code.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...register('country')} placeholder="India" />
            </div>
          </CardContent>
        </Card>

        {/* Location & Service Radius */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Location & Service Radius
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Pin the vendor's location on the map and set how far they can deliver or provide services.
            </p>
            <Suspense
              fallback={
                <div className="flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200" style={{ height: '380px' }}>
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
                height="380px"
              />
            </Suspense>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/dashboard/vendors')}>
            Cancel
          </Button>
          <Button type="submit" disabled={createVendor.isPending} className="min-w-[160px]">
            {createVendor.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Vendor & Account'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
