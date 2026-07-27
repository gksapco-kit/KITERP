import { useState } from 'react'
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
import { PhoneInput } from '@/components/ui/PhoneInput'
import { adminApi } from '@/api/admin.api'
import { useAuthStore } from '@/stores/authStore'
import { canCreateBusinessAccounts } from '@/lib/platformAccess'
import { adminKeys } from '@/hooks/useAdmin'
import { ArrowLeft, Loader2, UserPlus, Copy, CheckCircle2 } from 'lucide-react'
import { ThemeSelect } from '@/components/common/ThemeSelect'

const BUSINESS_TYPE_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llc', label: 'LLC' },
  { value: 'corporation', label: 'Corporation' },
  { value: 'proprietorship', label: 'Proprietorship' },
]

const OFFERING_TYPE_OPTIONS = [
  { value: 'both', label: 'Products & Services' },
  { value: 'products', label: 'Products Only' },
  { value: 'services', label: 'Services Only' },
]

const EMAIL_OR_PHONE_MSG = 'Provide either login email or owner phone'

const addVendorSchema = z
  .object({
    owner_email: z.union([z.literal(''), z.string().email('Valid email required')]).optional(),
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
    primary_phone: z
      .string()
      .min(8, 'Enter a valid phone number with country code')
      .max(20, 'Phone number is too long')
      .regex(/^\+\d{7,19}$/, 'Enter a valid phone number with country code'),
    street_address: z.string().min(5, 'Min 5 characters').max(500),
    city: z.string().min(2, 'Min 2 characters').max(100),
    state: z.string().min(2, 'Min 2 characters').max(100),
    postal_code: z.string().min(4, 'Min 4 characters').max(20),
    country: z.string().default('India'),
  })
  .refine(
    (data) => Boolean(data.owner_email?.trim()) || Boolean(data.owner_phone?.trim()),
    { message: EMAIL_OR_PHONE_MSG, path: ['owner_email'] },
  )

type AddVendorForm = z.infer<typeof addVendorSchema>

const inputClass = 'h-9'

const fieldClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary'

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-[11px] leading-tight text-red-500">{message}</p>
}

export default function AddVendor() {
  const { user } = useAuthStore()
  if (!canCreateBusinessAccounts(user)) {
    return <Navigate to="/dashboard/vendors" replace />
  }
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [createdResult, setCreatedResult] = useState<{
    vendor: { display_name: string; slug: string; subdomain: string }
    owner_account: { email: string | null; phone: string | null; password: string; user_created: boolean }
  } | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddVendorForm>({
    resolver: zodResolver(addVendorSchema),
    defaultValues: {
      business_type: 'individual',
      offering_type: 'both',
      country: 'India',
      owner_password: generatePassword(),
      owner_phone: '',
      primary_phone: '',
    },
  })

  const businessType = watch('business_type')
  const offeringType = watch('offering_type')
  const ownerPhone = watch('owner_phone')
  const primaryPhone = watch('primary_phone')

  const onInvalid = (formErrors: typeof errors) => {
    if (formErrors.owner_email?.message === EMAIL_OR_PHONE_MSG) {
      toast.error(EMAIL_OR_PHONE_MSG)
      return
    }
    const loginMsg = formErrors.owner_email?.message || formErrors.owner_phone?.message
    if (loginMsg) {
      toast.error(loginMsg)
      return
    }
    toast.error('Please fill in the required fields')
  }

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

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const createVendor = useMutation({
    mutationFn: (data: AddVendorForm) =>
      adminApi.createVendor({
        owner_email: data.owner_email?.trim() || undefined,
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
        service_radius_km: 10,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.vendors() })
      queryClient.invalidateQueries({ queryKey: adminKeys.vendorStats() })
      setCreatedResult(result)
      toast.success('Business account created with owner login!')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create business account'
      toast.error(message)
    },
  })

  if (createdResult) {
    const { vendor, owner_account } = createdResult
    return (
      <div className="mx-auto flex h-full max-w-xl flex-col justify-center gap-5 px-4 py-6">
        <div className="text-center">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
          <h1 className="text-xl font-bold text-gray-900">Business account created</h1>
          <p className="mt-1 text-sm text-gray-600">
            <strong>{vendor.display_name}</strong> has been registered successfully.
          </p>
        </div>

        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="flex items-center gap-2 text-base text-green-800">
              <UserPlus className="h-4 w-4" />
              Owner Login Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <p className="text-sm text-green-700">
              {owner_account.user_created
                ? 'Share these credentials with the vendor owner:'
                : 'The owner already had an account. Their existing password was not changed.'}
            </p>

            <div className="space-y-2">
              {(owner_account.email || owner_account.phone) && (
                <div className="flex items-center justify-between rounded-lg border bg-white p-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">
                      {owner_account.email ? 'Email' : 'Phone'}
                    </p>
                    <p className="font-mono text-sm font-medium">
                      {owner_account.email || owner_account.phone}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(owner_account.email || owner_account.phone || '', 'login')}
                    className="gap-1"
                  >
                    {copiedField === 'login' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copiedField === 'login' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}

              {owner_account.user_created && (
                <div className="flex items-center justify-between rounded-lg border bg-white p-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Password</p>
                    <p className="font-mono text-sm font-medium">{owner_account.password}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(owner_account.password, 'password')}
                    className="gap-1"
                  >
                    {copiedField === 'password' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copiedField === 'password' ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}

              <div className="rounded-lg border bg-white p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Business Front</p>
                <p className="font-mono text-sm">{vendor.slug}.yourdomain.com</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => navigate('/dashboard/vendors')}>
            Back to Business Accounts
          </Button>
          <Button
            onClick={() => {
              setCreatedResult(null)
              setValue('owner_password', generatePassword())
            }}
          >
            Create another
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 flex-col gap-3 overflow-hidden lg:h-[calc(100dvh-4rem)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => navigate('/dashboard/vendors')}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">Add business account</h1>
            <p className="hidden text-xs text-gray-500 sm:block">
              Register a business with an owner login (email or phone required)
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="cancel" size="sm" className="h-8" onClick={() => navigate('/dashboard/vendors')}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-vendor-form"
            size="sm"
            className="h-8 min-w-[140px]"
            disabled={createVendor.isPending}
          >
            {createVendor.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Creating...
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </div>
      </div>

      <form
        id="add-vendor-form"
        onSubmit={handleSubmit((data) => createVendor.mutate(data), onInvalid)}
        className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden"
      >
        {/* Owner + Business */}
        <div className="flex min-h-0 flex-col gap-3 lg:overflow-hidden">
          <Card className="border-blue-200 bg-blue-50/20 lg:min-h-0 lg:flex-1">
            <CardHeader className="space-y-0 px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <UserPlus className="h-4 w-4 text-blue-600" />
                Owner Login
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2.5 px-4 pb-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="owner_name" className="text-xs">
                  Full Name *
                </Label>
                <Input id="owner_name" className={inputClass} {...register('owner_name')} placeholder="e.g. Rahul Sharma" />
                <FieldError message={errors.owner_name?.message} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="owner_phone" className="text-xs">
                  Phone
                </Label>
                <PhoneInput
                  id="owner_phone"
                  value={ownerPhone || ''}
                  onChange={(v) => setValue('owner_phone', v, { shouldValidate: true, shouldDirty: true })}
                  defaultCountryIso="IN"
                  autoComplete="tel-national"
                  compact
                />
                <FieldError message={errors.owner_phone?.message} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="owner_email" className="text-xs">
                  Login Email
                </Label>
                <Input
                  id="owner_email"
                  type="email"
                  className={inputClass}
                  {...register('owner_email')}
                  placeholder="owner@vendor.com"
                />
                {/* Missing email/phone is toast-only; keep inline only for invalid email format */}
                <FieldError
                  message={
                    errors.owner_email?.message === EMAIL_OR_PHONE_MSG
                      ? undefined
                      : errors.owner_email?.message
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="owner_password" className="text-xs">
                  Password *
                </Label>
                <div className="flex gap-1.5">
                  <Input id="owner_password" className={`${inputClass} font-mono`} {...register('owner_password')} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 px-2.5"
                    onClick={() => setValue('owner_password', generatePassword())}
                  >
                    Generate
                  </Button>
                </div>
                <FieldError message={errors.owner_password?.message} />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:min-h-0 lg:flex-[1.4]">
            <CardHeader className="space-y-0 px-4 py-3">
              <CardTitle className="text-sm">Business Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2.5 px-4 pb-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="business_name" className="text-xs">
                  Business Name *
                </Label>
                <Input
                  id="business_name"
                  className={inputClass}
                  {...register('business_name')}
                  onChange={handleBusinessNameChange}
                  placeholder="e.g. Acme Technologies"
                />
                <FieldError message={errors.business_name?.message} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="display_name" className="text-xs">
                  Display Name *
                </Label>
                <Input id="display_name" className={inputClass} {...register('display_name')} placeholder="e.g. Acme Tech" />
                <FieldError message={errors.display_name?.message} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="slug" className="text-xs">
                  URL Slug *
                </Label>
                <Input id="slug" className={`${inputClass} lowercase`} {...register('slug')} placeholder="e.g. acme-tech" />
                <FieldError message={errors.slug?.message} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="industry" className="text-xs">
                  Industry *
                </Label>
                <Input id="industry" className={inputClass} {...register('industry')} placeholder="e.g. Technology" />
                <FieldError message={errors.industry?.message} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="business_type" className="text-xs">
                  Business Type *
                </Label>
                <ThemeSelect
                  id="business_type"
                  value={businessType}
                  onChange={(v) => setValue('business_type', v as AddVendorForm['business_type'], { shouldValidate: true })}
                  options={BUSINESS_TYPE_OPTIONS}
                  className={fieldClass}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="offering_type" className="text-xs">
                  Offering *
                </Label>
                <ThemeSelect
                  id="offering_type"
                  value={offeringType}
                  onChange={(v) => setValue('offering_type', v as AddVendorForm['offering_type'], { shouldValidate: true })}
                  options={OFFERING_TYPE_OPTIONS}
                  className={fieldClass}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="description" className="text-xs">
                  Description
                </Label>
                <Input
                  id="description"
                  className={inputClass}
                  {...register('description')}
                  placeholder="Brief description of the business..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contact + Address */}
        <Card className="lg:min-h-0 lg:overflow-hidden">
          <CardHeader className="space-y-0 px-4 py-3">
            <CardTitle className="text-sm">Contact & Address</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2.5 px-4 pb-4 sm:grid-cols-2 lg:h-[calc(100%-3rem)] lg:content-start">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="primary_phone" className="text-xs">
                Business Phone *
              </Label>
              <PhoneInput
                id="primary_phone"
                value={primaryPhone || ''}
                onChange={(v) => setValue('primary_phone', v, { shouldValidate: true, shouldDirty: true })}
                defaultCountryIso="IN"
                autoComplete="tel-national"
                compact
              />
              <FieldError message={errors.primary_phone?.message} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="street_address" className="text-xs">
                Street Address *
              </Label>
              <Input
                id="street_address"
                className={inputClass}
                {...register('street_address')}
                placeholder="123 Business St, Suite 100"
              />
              <FieldError message={errors.street_address?.message} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="city" className="text-xs">
                City *
              </Label>
              <Input id="city" className={inputClass} {...register('city')} placeholder="Mumbai" />
              <FieldError message={errors.city?.message} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state" className="text-xs">
                State *
              </Label>
              <Input id="state" className={inputClass} {...register('state')} placeholder="Maharashtra" />
              <FieldError message={errors.state?.message} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="postal_code" className="text-xs">
                Postal Code *
              </Label>
              <Input id="postal_code" className={inputClass} {...register('postal_code')} placeholder="400001" />
              <FieldError message={errors.postal_code?.message} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="country" className="text-xs">
                Country
              </Label>
              <Input id="country" className={inputClass} {...register('country')} placeholder="India" />
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
