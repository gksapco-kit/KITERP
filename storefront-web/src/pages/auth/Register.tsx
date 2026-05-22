import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useCustomerRegister, useCustomerLogin } from '@/hooks/useStore'
import { useVendor } from '@/contexts/VendorContext'
import { imgUrl } from '@/lib/utils'
import { Loader2, Store, ShieldCheck, Check, Eye, EyeOff, MapPin } from 'lucide-react'

const phoneRegex = /^\+?\d{10,15}$/

const schema = z.object({
  full_name: z.string().min(2, 'Enter your full name').max(255),
  email: z.string().optional().refine(
    (val) => !val || z.string().email().safeParse(val).success,
    'Enter a valid email',
  ),
  phone: z.string().optional().refine(
    (val) => !val || phoneRegex.test(val),
    'Enter a valid phone number (e.g. +919876543210)',
  ),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, { message: "Passwords don't match", path: ['confirm_password'] })
  .refine((d) => d.email || d.phone, { message: 'Either email or phone number is required', path: ['phone'] })

type FormData = z.infer<typeof schema>

export default function Register() {
  const registerMut = useCustomerRegister()
  const loginMut = useCustomerLogin()
  const { vendor, storePath } = useVendor()
  const navigate = useNavigate()
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = (data: FormData) => {
    registerMut.mutate(
      {
        full_name: data.full_name,
        email: data.email || undefined,
        password: data.password,
        phone: data.phone || undefined,
      },
      {
        onSuccess: () => {
          const loginId = data.email || data.phone || ''
          loginMut.mutate(
            { login: loginId, password: data.password },
            { onSuccess: () => navigate(storePath('/')) },
          )
        },
      }
    )
  }

  const isLoading = registerMut.isPending || loginMut.isPending

  const themeConfig = vendor?.theme_config as Record<string, unknown> | undefined
  const styleConfig = themeConfig?.style as Record<string, unknown> | undefined
  const primaryColor: string = (styleConfig?.primary_color as string) || '#4F46E5'

  const location = [vendor?.city, vendor?.state].filter(Boolean).join(', ')

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10 bg-gray-50">
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-gray-200 flex flex-col md:flex-row">

        {/* ── Left brand panel ── */}
        <div
          className="relative flex flex-col items-center justify-center p-10 md:w-[40%] shrink-0 overflow-hidden"
          style={{
            background: `linear-gradient(145deg, ${primaryColor} 0%, ${primaryColor}dd 50%, ${primaryColor}99 100%)`,
          }}
        >
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-white/10" />
          <div className="absolute -bottom-20 -right-12 w-72 h-72 rounded-full bg-white/8" />

          <div className="relative z-10 flex flex-col items-center text-center gap-5">
            {/* Logo */}
            <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl ring-4 ring-white/25">
              {vendor?.logo_url ? (
                <img src={imgUrl(vendor.logo_url)} alt={vendor.display_name} className="w-20 h-20 rounded-xl object-cover" />
              ) : (
                <Store className="w-11 h-11 text-white" />
              )}
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">
                {vendor?.display_name || 'Our Store'}
              </h1>
              {vendor?.description && (
                <p className="mt-2 text-sm text-white/70 leading-relaxed line-clamp-3 max-w-[220px]">
                  {vendor.description}
                </p>
              )}
            </div>

            {location && (
              <span className="inline-flex items-center gap-1.5 text-white/75 text-xs bg-white/15 px-3 py-1.5 rounded-full">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {location}
              </span>
            )}

            {/* Perks */}
            <div className="flex flex-col gap-2 mt-2 w-full">
              {['Fast checkout', 'Order & booking tracking', 'Exclusive deals & offers', 'Secure & private'].map((b) => (
                <div key={b} className="flex items-center gap-2 text-white/70 text-xs">
                  <Check className="w-3.5 h-3.5 shrink-0 text-white/90" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="absolute bottom-4 text-white/35 text-xs">Powered by KITERP</p>
        </div>

        {/* ── Right form panel ── */}
        <div className="flex-1 bg-white px-8 py-10 overflow-y-auto">
          <div className="w-full max-w-sm mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Create account</h2>
              <p className="text-sm text-gray-500 mt-1">
                Join{' '}
                <span className="font-semibold text-gray-700">{vendor?.display_name || 'us'}</span>
                {' '}today
              </p>
            </div>

            {/* Error banner */}
            {(registerMut.isError || loginMut.isError) && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-800">
                {(registerMut.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                  || 'Registration failed. Please try again.'}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Full Name</label>
                <Input {...register('full_name')} placeholder="John Doe" className="h-11" />
                {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Email Address <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </label>
                <Input {...register('email')} type="email" placeholder="you@example.com" className="h-11" />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Phone Number <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </label>
                <Controller name="phone" control={control} render={({ field }) => (
                  <PhoneInput value={field.value ?? ''} onChange={field.onChange} defaultCountryIso="IN" />
                )} />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
                <p className="text-xs text-gray-400 mt-1">Either email or phone is required</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Password</label>
                <div className="relative">
                  <Input {...register('password')} type={showPw ? 'text' : 'password'} placeholder="Min. 8 characters" className="h-11 pr-10" />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Confirm Password</label>
                <div className="relative">
                  <Input {...register('confirm_password')} type={showConfirm ? 'text' : 'password'} placeholder="Re-enter password" className="h-11 pr-10" />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirm_password && <p className="text-xs text-red-500 mt-1">{errors.confirm_password.message}</p>}
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-bold text-white hover:opacity-90 transition-opacity mt-2"
                style={{ backgroundColor: primaryColor }}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Account
              </Button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">Already have an account?</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <Link to={storePath('/login')}>
              <Button variant="outline" className="w-full h-11 font-medium border-gray-300 hover:bg-gray-50">
                Sign In
              </Button>
            </Link>

            <div className="flex items-center justify-center gap-1.5 mt-5 text-xs text-gray-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Secured by KITERP</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
