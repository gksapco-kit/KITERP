import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { debounce } from 'lodash-es'
import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCheckSlug } from '@/hooks/useVendor'

const BASE_DOMAIN = 'kiterp.com'

const schema = z.object({
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
})

type FormData = z.infer<typeof schema>

export default function OnboardingSubdomain() {
  const navigate = useNavigate()
  const checkSlugMutation = useCheckSlug()
  const [availability, setAvailability] = useState<{ available: boolean } | null>(null)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const slug = watch('slug')

  const debouncedCheck = useCallback(
    debounce(async (value: string) => {
      if (value.length < 3) return
      const result = await checkSlugMutation.mutateAsync(value)
      setAvailability(result)
    }, 500),
    []
  )

  useEffect(() => {
    if (slug) debouncedCheck(slug)
  }, [slug])

  const onSubmit = (data: FormData) => {
    if (!availability?.available) return
    sessionStorage.setItem('onboarding_subdomain', data.slug)
    navigate('/onboarding/address')
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Choose Your Store URL</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
          <Globe className="w-5 h-5 text-gray-400" />
          <span>https://{slug || 'your-store'}.{BASE_DOMAIN}</span>
        </div>
        <div>
          <Label>Store URL</Label>
          <Input {...register('slug')} placeholder="your-store-name" className="mt-1" />
          {errors.slug && <p className="text-sm text-red-500 mt-1">{errors.slug.message}</p>}
          {availability?.available && <p className="text-sm text-green-600 mt-1">Available!</p>}
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => navigate('/onboarding')}>Back</Button>
          <Button type="submit" disabled={!availability?.available}>Continue</Button>
        </div>
      </form>
    </div>
  )
}
