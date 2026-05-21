import { useState, useEffect, useRef } from 'react'
import { useUpdateVendor } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { Save, Loader2, Globe } from 'lucide-react'
import { toast } from 'sonner'
import type { Vendor } from '@/types'

const SOCIAL_FIELDS = [
  { key: 'website', label: 'Website', placeholder: 'https://yourstore.com' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '+91 98765 43210' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourstore' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourstore' },
  { key: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/yourstore' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourstore' },
]

export default function SocialLinksPage() {
  const { vendor } = useVendorStore()
  const updateVendor = useUpdateVendor()
  const [links, setLinks] = useState<Record<string, string>>({})
  const savingRef = useRef(false)

  useEffect(() => {
    if (vendor && !savingRef.current) {
      const l: Record<string, string> = {}
      for (const f of SOCIAL_FIELDS) l[f.key] = vendor.social_links?.[f.key] || ''
      setLinks(l)
    }
  }, [vendor])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned: Record<string, string> = {}
    for (const [k, v] of Object.entries(links)) {
      if (v.trim()) cleaned[k] = v.trim()
    }
    savingRef.current = true
    updateVendor.mutate({ social_links: cleaned } as Partial<Vendor>, {
      onSuccess: () => toast.success('Social links updated'),
      onSettled: () => { savingRef.current = false },
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Social & Web Links</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Links shown on your business front, website, and customer-facing pages.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
              <Globe className="h-5 w-5" strokeWidth={2} />
            </div>
            <CardTitle className="text-base">Channels & presence</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SOCIAL_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  {f.key === 'whatsapp' ? (
                    <PhoneInput
                      value={links[f.key] || ''}
                      onChange={(v) => setLinks({ ...links, [f.key]: v })}
                      defaultCountryIso="IN"
                    />
                  ) : (
                    <Input
                      value={links[f.key] || ''}
                      onChange={(e) => setLinks({ ...links, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={updateVendor.isPending} className="gap-2">
                {updateVendor.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
