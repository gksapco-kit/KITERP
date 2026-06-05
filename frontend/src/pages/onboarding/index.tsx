import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Image, X, Camera, Store } from 'lucide-react'
import axios from 'axios'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SingleImagePreview } from '@/components/common/CatalogMediaLightbox'
import { mediaUrl } from '@/lib/utils'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const schema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  display_name: z.string().min(2, 'Display name must be at least 2 characters'),
  industry: z.string().min(2, 'Industry is required'),
  business_type: z.enum(['individual', 'partnership', 'llc', 'corporation', 'proprietorship']),
  description: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function OnboardingBasic() {
  const navigate = useNavigate()
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [bannerUrl, setBannerUrl] = useState<string>('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      business_type: 'individual',
    },
  })

  const uploadFile = async (file: File, type: 'logo' | 'banner') => {
    const setUploading = type === 'logo' ? setLogoUploading : setBannerUploading
    const setUrl = type === 'logo' ? setLogoUrl : setBannerUrl
    const endpoint = type === 'logo' ? '/uploads/vendor/logo-anonymous' : '/uploads/vendor/banner-anonymous'

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = localStorage.getItem('access_token')
      const res = await axios.post(`${API_URL}${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
      setUrl(type === 'logo' ? res.data.logo_url : res.data.banner_url)
    } catch {
      alert(`Failed to upload ${type}. Please try again.`)
    }
    setUploading(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, WebP, GIF)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('File too large. Maximum size is 5 MB.')
      return
    }
    uploadFile(file, type)
  }

  const fullImageUrl = (url: string) => {
    if (!url) return ''
    if (url.startsWith('http')) return url
    return `${API_URL.replace('/api/v1', '')}${url}`
  }

  const onSubmit = (data: FormData) => {
    sessionStorage.setItem('onboarding_basic', JSON.stringify({
      ...data,
      logo_url: logoUrl || undefined,
      banner_url: bannerUrl || undefined,
    }))
    navigate('/onboarding/subdomain')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Basic Information</h2>
        <p className="text-sm text-gray-600 mt-1">
          Tell us about your business
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Logo & Banner Upload */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Store Branding</Label>

          <div className="flex gap-6 items-start">
            {/* Logo */}
            <div className="flex flex-col items-center gap-2">
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'logo')} />
              {logoUrl ? (
                <div className="relative w-24 h-24">
                  <SingleImagePreview
                    url={logoUrl}
                    alt="Logo"
                    resolveUrl={mediaUrl}
                    className="w-24 h-24 rounded-xl border-2 border-gray-200 overflow-hidden"
                    imgClassName="w-full h-full object-cover"
                    editable
                    onSave={(file) => uploadFile(file, 'logo')}
                  />
                  <button
                    type="button"
                    onClick={() => logoRef.current?.click()}
                    title="Replace logo"
                    className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border bg-white shadow hover:bg-gray-50"
                  >
                    {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => logoRef.current?.click()}
                  className="relative w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 flex items-center justify-center overflow-hidden group transition-colors bg-gray-50">
                  {logoUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-400">
                      <Store className="w-8 h-8" />
                      <span className="text-xs font-medium">Add Logo</span>
                    </div>
                  )}
                </button>
              )}
              {logoUrl && (
                <button type="button" onClick={() => setLogoUrl('')} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-0.5">
                  <X className="w-3 h-3" /> Remove
                </button>
              )}
              <span className="text-xs text-gray-400">Logo</span>
            </div>

            {/* Banner */}
            <div className="flex-1 flex flex-col gap-2">
              <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'banner')} />
              {bannerUrl ? (
                <div className="relative w-full h-24">
                  <SingleImagePreview
                    url={bannerUrl}
                    alt="Banner"
                    resolveUrl={mediaUrl}
                    className="w-full h-24 rounded-xl border-2 border-gray-200 overflow-hidden"
                    imgClassName="w-full h-full object-cover"
                    editable
                    onSave={(file) => uploadFile(file, 'banner')}
                  />
                  <button
                    type="button"
                    onClick={() => bannerRef.current?.click()}
                    title="Replace banner"
                    className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border bg-white shadow hover:bg-gray-50"
                  >
                    {bannerUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => bannerRef.current?.click()}
                  className="relative w-full h-24 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 flex items-center justify-center overflow-hidden group transition-colors bg-gray-50">
                  {bannerUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-400">
                      <Image className="w-8 h-8" />
                      <span className="text-xs font-medium">Add Store Banner</span>
                      <span className="text-xs">Recommended: 1200 x 400</span>
                    </div>
                  )}
                </button>
              )}
              {bannerUrl && (
                <button type="button" onClick={() => setBannerUrl('')} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-0.5 self-start">
                  <X className="w-3 h-3" /> Remove
                </button>
              )}
              <span className="text-xs text-gray-400">Store Banner (Optional)</span>
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="business_name">Business Name</Label>
          <Input
            id="business_name"
            {...register('business_name')}
            className="mt-1"
            placeholder="Your Company Name"
          />
          {errors.business_name && (
            <p className="mt-1 text-sm text-red-500">{errors.business_name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="display_name">Display Name</Label>
          <Input
            id="display_name"
            {...register('display_name')}
            className="mt-1"
            placeholder="Name shown to customers"
          />
          {errors.display_name && (
            <p className="mt-1 text-sm text-red-500">{errors.display_name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="industry">Industry</Label>
          <Input
            id="industry"
            {...register('industry')}
            className="mt-1"
            placeholder="e.g., Retail, Services, Food"
          />
          {errors.industry && (
            <p className="mt-1 text-sm text-red-500">{errors.industry.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="business_type">Business Type</Label>
          <select
            id="business_type"
            {...register('business_type')}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="individual">Individual</option>
            <option value="proprietorship">Proprietorship</option>
            <option value="partnership">Partnership</option>
            <option value="llc">LLC</option>
            <option value="corporation">Corporation</option>
          </select>
        </div>

        <div>
          <Label htmlFor="description">Description (Optional)</Label>
          <textarea
            id="description"
            {...register('description')}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
            placeholder="Tell customers about your business"
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </div>
      </form>
    </div>
  )
}
