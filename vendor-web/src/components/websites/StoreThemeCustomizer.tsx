import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { vendorApi } from '@/api/vendor'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVendorStore } from '@/stores/vendorStore'
import { useSiteList } from '@/hooks/useWebsites'
import { vendorKeys } from '@/hooks/useVendor'
import { resolveBusinessFrontActiveTemplate } from '@/lib/businessFrontActiveTemplate'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
import { toast } from 'sonner'
import {
  Loader2, Palette, Type, Eye, Check, Sparkles,
  ShoppingBag, Wrench, Star, Truck, ChevronRight, Monitor,
  ToggleLeft, ToggleRight, Save,
  SlidersHorizontal, Image,
} from 'lucide-react'

interface TemplatePreset {
  id: string; name: string; description: string; hero_style: string
  product_layout: string; font: string
  colors: Record<string, string>; sections: Record<string, boolean>
}

interface ThemeConfig {
  template: string
  colors: Record<string, string>
  font: string
  font_body: string
  hero_style: string
  hero_title: string
  hero_subtitle: string
  hero_height: string
  hero_image_url: string
  product_layout: string
  product_detail_template: string
  card_style: string
  button_radius: string
  header_style: string
  sticky_header: boolean
  show_search: boolean
  footer_style: string
  sections: Record<string, boolean>
  custom_announcement: string
}

const FONTS = [
  { id: 'Inter', name: 'Inter', style: 'font-sans' },
  { id: 'Poppins', name: 'Poppins', style: 'font-sans' },
  { id: 'DM Sans', name: 'DM Sans', style: 'font-sans' },
  { id: 'Space Grotesk', name: 'Space Grotesk', style: 'font-mono' },
  { id: 'Playfair Display', name: 'Playfair Display', style: 'font-serif' },
  { id: 'Roboto', name: 'Roboto', style: 'font-sans' },
]

const SECTION_LABELS: Record<string, { label: string; description: string }> = {
  hero: { label: 'Hero Banner', description: 'Main banner with store name and CTA' },
  trust_badges: { label: 'Trust Badges', description: 'Free shipping, secure payment, etc.' },
  featured_products: { label: 'Featured Products', description: 'Grid of top products' },
  featured_services: { label: 'Featured Services', description: 'Services showcase section' },
  offers_banner: { label: 'Offers Banner', description: 'Promotional offers strip' },
  testimonials: { label: 'Testimonials', description: 'Customer testimonials section' },
  cta: { label: 'Call to Action', description: 'Bottom CTA banner' },
}

export function StoreThemeCustomizer({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient()
  const vendor = useVendorStore((s) => s.vendor)
  const { data: sites = [] } = useSiteList()
  const [activeTab, setActiveTab] = useState<'colors' | 'layout' | 'sections' | 'content'>('colors')

  const { data: config, isLoading } = useQuery<ThemeConfig>({
    queryKey: ['template-config'],
    queryFn: () => vendorApi.getTemplateConfig(),
  })

  const { data: presetsData } = useQuery<{ presets: TemplatePreset[] }>({
    queryKey: ['template-presets'],
    queryFn: () => vendorApi.getTemplatePresets(),
  })

  const [draft, setDraft] = useState<ThemeConfig | null>(null)

  useEffect(() => {
    if (config) setDraft(config)
  }, [config])

  const saveMutation = useMutation({
    mutationFn: (data: Partial<ThemeConfig>) => vendorApi.updateTemplateConfig(data),
    onSuccess: (res) => {
      setDraft(res)
      qc.setQueryData(['template-config'], res)
      qc.invalidateQueries({ queryKey: ['template-config'] })
      qc.invalidateQueries({ queryKey: vendorKeys.me() })
      toast.success('Template saved!')
    },
    onError: () => toast.error('Could not save template — check your customization settings'),
  })

  if (isLoading || !draft) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>

  const presets = presetsData?.presets || []
  const activeFront = resolveBusinessFrontActiveTemplate(draft.template, presets, sites)
  const storeUrl = vendor?.slug ? getCustomerStorefrontBaseUrl(vendor.slug) : null
  const updateDraft = (updates: Partial<ThemeConfig>) => setDraft({ ...draft, ...updates })
  const updateColor = (key: string, value: string) => setDraft({ ...draft, colors: { ...draft.colors, [key]: value } })
  const toggleSection = (key: string) => setDraft({ ...draft, sections: { ...draft.sections, [key]: !draft.sections[key] } })

  const tabs = [
    { id: 'colors' as const, label: 'Colors & Fonts', icon: Palette },
    { id: 'layout' as const, label: 'Layout & Style', icon: SlidersHorizontal },
    { id: 'sections' as const, label: 'Sections', icon: Eye },
    { id: 'content' as const, label: 'Content', icon: Type },
  ]

  return (
    <section id="store-theme-customizer" className="space-y-6">
      {!embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">Customize store theme</h2>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Colors, fonts, header, and homepage sections for the classic business front.
              {activeFront.kind === 'website_builder'
                ? ' Your published Business Website Builder site controls the home page; these settings still apply to catalog pages.'
                : ' Pick the default layout above, then fine-tune here.'}
            </p>
            <p className="text-sm mt-2">
              <span className="font-medium text-gray-800">Live on store: </span>
              <span className="text-primary font-semibold">{activeFront.name}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {storeUrl && (
              <Button variant="outline" asChild>
                <a href={storeUrl} target="_blank" rel="noopener noreferrer">View live store</a>
              </Button>
            )}
            <Button onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-800">Live on store: </span>
            <span className="text-primary font-semibold">{activeFront.name}</span>
          </p>
          <div className="flex flex-wrap gap-2 shrink-0">
            {storeUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={storeUrl} target="_blank" rel="noopener noreferrer">View live store</a>
              </Button>
            )}
            <Button size="sm" onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Editor panel */}
        <div className="xl:col-span-2 space-y-5">
          {/* Colors & Fonts tab */}
          {activeTab === 'colors' && (
            <div className="space-y-5">
              <Card>
                <CardHeader><CardTitle className="text-base">Colors</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { key: 'primary', label: 'Primary Color', desc: 'Buttons, links, headings' },
                    { key: 'secondary', label: 'Secondary Color', desc: 'Hover states, accents' },
                    { key: 'accent', label: 'Accent Color', desc: 'Highlights, badges, CTAs' },
                    { key: 'background', label: 'Background', desc: 'Page background' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center gap-3">
                      <label className="relative w-10 h-10 rounded-lg border-2 border-gray-200 overflow-hidden cursor-pointer shrink-0">
                        <input type="color" value={draft.colors[item.key] || '#000000'}
                          onChange={(e) => updateColor(item.key, e.target.value)}
                          className="absolute inset-0 w-full h-full cursor-pointer opacity-0" />
                        <div className="w-full h-full" style={{ backgroundColor: draft.colors[item.key] || '#000000' }} />
                      </label>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-gray-400">{item.desc}</p>
                      </div>
                      <Input value={draft.colors[item.key] || ''} onChange={(e) => updateColor(item.key, e.target.value)}
                        className="w-24 h-8 text-xs font-mono" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Heading Font</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {FONTS.map((f) => (
                      <button key={f.id} onClick={() => updateDraft({ font: f.id })}
                        className={`text-left rounded-lg border-2 p-3 transition-colors ${draft.font === f.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <p className="font-semibold text-sm">{f.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: f.id }}>The quick brown fox</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Body Font</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {FONTS.map((f) => (
                      <button key={f.id} onClick={() => updateDraft({ font_body: f.id })}
                        className={`text-left rounded-lg border-2 p-3 transition-colors ${(draft.font_body || draft.font) === f.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <p className="font-semibold text-sm">{f.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5" style={{ fontFamily: f.id }}>Body text sample</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Hero Style</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { id: 'gradient', label: 'Gradient' },
                      { id: 'image', label: 'Image' },
                      { id: 'minimal', label: 'Minimal' },
                      { id: 'dark', label: 'Dark' },
                    ].map((s) => (
                      <button key={s.id} onClick={() => updateDraft({ hero_style: s.id })}
                        className={`flex-1 min-w-[4rem] rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors ${draft.hero_style === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Layout & Style tab */}
          {activeTab === 'layout' && (
            <div className="space-y-5">
              <Card>
                <CardHeader><CardTitle className="text-base">Header</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Header Style</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'classic', label: 'Classic', desc: 'Double bar, logo left' },
                        { id: 'minimal', label: 'Minimal', desc: 'Single bar, clean' },
                        { id: 'centered', label: 'Centered', desc: 'Logo center, nav below' },
                      ].map((s) => (
                        <button key={s.id} onClick={() => updateDraft({ header_style: s.id })}
                          className={`text-left rounded-xl border-2 p-3 transition-all ${(draft.header_style || 'classic') === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <p className="text-sm font-semibold flex items-center gap-1">
                            {s.label}
                            {(draft.header_style || 'classic') === s.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t">
                    <div>
                      <p className="text-sm font-medium">Sticky Header</p>
                      <p className="text-xs text-gray-400">Header stays visible when scrolling</p>
                    </div>
                    <button onClick={() => updateDraft({ sticky_header: !draft.sticky_header })}>
                      {draft.sticky_header !== false
                        ? <ToggleRight className="w-8 h-8 text-blue-500" />
                        : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t">
                    <div>
                      <p className="text-sm font-medium">Show Search Bar</p>
                      <p className="text-xs text-gray-400">Display product search in header</p>
                    </div>
                    <button onClick={() => updateDraft({ show_search: !draft.show_search })}>
                      {draft.show_search !== false
                        ? <ToggleRight className="w-8 h-8 text-blue-500" />
                        : <ToggleLeft className="w-8 h-8 text-gray-300" />}
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Product Cards</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Card Style</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'default', label: 'Default', desc: 'Image + details below' },
                        { id: 'modern', label: 'Modern', desc: 'Overlay text on image' },
                        { id: 'minimal', label: 'Minimal', desc: 'Airy, borderless' },
                      ].map((s) => (
                        <button key={s.id} onClick={() => updateDraft({ card_style: s.id })}
                          className={`text-left rounded-xl border-2 p-3 transition-all ${(draft.card_style || 'default') === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          {/* Mini card preview */}
                          <div className="mb-2 h-12 rounded-lg overflow-hidden bg-gray-100 relative">
                            {s.id === 'default' && (
                              <>
                                <div className="absolute inset-0 bg-gradient-to-b from-gray-200 to-gray-100" />
                                <div className="absolute bottom-0 left-0 right-0 bg-white h-4" />
                              </>
                            )}
                            {s.id === 'modern' && (
                              <>
                                <div className="absolute inset-0 bg-gradient-to-b from-gray-300/50 to-gray-800/70" />
                                <div className="absolute bottom-1 left-1 right-1 h-2 bg-white/30 rounded" />
                              </>
                            )}
                            {s.id === 'minimal' && (
                              <div className="absolute inset-0 flex items-end pb-0.5 px-1">
                                <div className="w-full space-y-0.5">
                                  <div className="h-1.5 w-3/4 bg-gray-300 rounded" />
                                  <div className="h-1.5 w-1/2 bg-gray-200 rounded" />
                                </div>
                              </div>
                            )}
                          </div>
                          <p className="text-sm font-semibold flex items-center gap-1">
                            {s.label}
                            {(draft.card_style || 'default') === s.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Product Grid</Label>
                    <div className="flex gap-2">
                      {['grid-3', 'grid-4'].map((layout) => (
                        <button key={layout} onClick={() => updateDraft({ product_layout: layout })}
                          className={`flex-1 rounded-lg border-2 p-3 text-center text-sm font-medium transition-colors ${draft.product_layout === layout ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          {layout === 'grid-3' ? '3 Columns' : '4 Columns'}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Buttons</CardTitle></CardHeader>
                <CardContent>
                  <Label className="mb-2 block">Button Shape</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'sharp', label: 'Sharp', cls: 'rounded-none' },
                      { id: 'rounded', label: 'Rounded', cls: 'rounded-lg' },
                      { id: 'pill', label: 'Pill', cls: 'rounded-full' },
                    ].map((s) => (
                      <button key={s.id} onClick={() => updateDraft({ button_radius: s.id })}
                        className={`rounded-xl border-2 p-3 transition-all ${(draft.button_radius || 'rounded') === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className={`mx-auto mb-2 h-7 w-20 flex items-center justify-center text-xs font-bold text-white ${s.cls}`} style={{ backgroundColor: draft.colors?.primary || '#2563eb' }}>
                          Button
                        </div>
                        <p className="text-sm font-medium text-center flex items-center justify-center gap-1">
                          {s.label}
                          {(draft.button_radius || 'rounded') === s.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Hero Height</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'compact', label: 'Compact', desc: 'Short banner' },
                      { id: 'medium', label: 'Medium', desc: 'Balanced (default)' },
                      { id: 'tall', label: 'Tall', desc: 'Full-impact hero' },
                    ].map((s) => (
                      <button key={s.id} onClick={() => updateDraft({ hero_height: s.id })}
                        className={`text-left rounded-xl border-2 p-3 transition-all ${(draft.hero_height || 'medium') === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className={`w-full rounded mb-2 ${s.id === 'compact' ? 'h-4' : s.id === 'tall' ? 'h-10' : 'h-7'} bg-blue-100`} />
                        <p className="text-sm font-semibold flex items-center gap-1">
                          {s.label}
                          {(draft.hero_height || 'medium') === s.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Footer</CardTitle></CardHeader>
                <CardContent>
                  <Label className="mb-2 block">Footer Style</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'simple', label: 'Simple', desc: 'Single row, minimal' },
                      { id: 'standard', label: 'Standard', desc: '3-column balanced' },
                      { id: 'full', label: 'Full', desc: '4-column, complete info' },
                    ].map((s) => (
                      <button key={s.id} onClick={() => updateDraft({ footer_style: s.id })}
                        className={`text-left rounded-xl border-2 p-3 transition-all ${(draft.footer_style || 'standard') === s.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <p className="text-sm font-semibold flex items-center gap-1">
                          {s.label}
                          {(draft.footer_style || 'standard') === s.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Sections tab */}
          {activeTab === 'sections' && (
            <Card>
              <CardHeader><CardTitle className="text-base">Homepage Sections</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {Object.entries(SECTION_LABELS).map(([key, meta]) => (
                  <button key={key} onClick={() => toggleSection(key)}
                    className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                      <p className="text-xs text-gray-400">{meta.description}</p>
                    </div>
                    {draft.sections[key] ? (
                      <ToggleRight className="w-7 h-7 text-blue-500 shrink-0" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-gray-300 shrink-0" />
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Content tab */}
          {activeTab === 'content' && (
            <div className="space-y-5">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Image className="w-4 h-4" /> Hero Content</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Hero Title (leave empty for default)</Label>
                    <Input className="mt-1" value={draft.hero_title} onChange={(e) => updateDraft({ hero_title: e.target.value })}
                      placeholder={`Welcome to ${vendor?.display_name || 'Your Store'}`} />
                  </div>
                  <div>
                    <Label>Hero Subtitle</Label>
                    <Input className="mt-1" value={draft.hero_subtitle} onChange={(e) => updateDraft({ hero_subtitle: e.target.value })}
                      placeholder="Your one-stop shop for quality products and services" />
                  </div>
                  <div>
                    <Label>Hero Background Image URL</Label>
                    <Input className="mt-1" value={draft.hero_image_url || ''} onChange={(e) => updateDraft({ hero_image_url: e.target.value })}
                      placeholder="https://example.com/hero-banner.jpg" />
                    <p className="text-xs text-gray-400 mt-1">Shown for gradient & image hero styles. Uses store banner if empty.</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Announcement Bar</CardTitle></CardHeader>
                <CardContent>
                  <Label>Announcement Text</Label>
                  <Input className="mt-1" value={draft.custom_announcement} onChange={(e) => updateDraft({ custom_announcement: e.target.value })}
                    placeholder="Free delivery on orders above ₹500!" />
                  <p className="text-xs text-gray-400 mt-1">Shows at the top of your store. Leave empty to hide.</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Live Preview */}
        <div className="xl:col-span-3">
          <div className="sticky top-4">
            <div className="flex items-center gap-2 mb-3">
              <Monitor className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-500">Live Preview</span>
            </div>
            <div className="rounded-xl border-2 border-gray-200 overflow-hidden shadow-lg" style={{ backgroundColor: draft.colors.background || '#f9fafb' }}>
              {/* Announcement */}
              {draft.custom_announcement && (
                <div className="text-center py-1.5 text-xs font-medium text-white" style={{ backgroundColor: draft.colors.primary }}>
                  {draft.custom_announcement}
                </div>
              )}

              {/* Preview Header */}
              {(draft.header_style || 'classic') === 'minimal' ? (
                <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: draft.colors.primary }}>
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="font-bold text-sm" style={{ fontFamily: draft.font }}>{vendor?.display_name || 'Store'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded text-white text-xs" style={{ backgroundColor: draft.colors.primary }}>Products</span>
                    <ShoppingBag className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ) : (draft.header_style || 'classic') === 'centered' ? (
                <>
                  <div className="bg-white border-b px-4 py-2.5 flex flex-col items-center gap-1.5">
                    <span className="font-bold text-sm" style={{ fontFamily: draft.font, color: draft.colors.primary }}>{vendor?.display_name || 'Store'}</span>
                    <div className="flex items-center gap-1 text-xs text-white">
                      {['Home', 'Products', 'Services'].map(l => (
                        <span key={l} className="px-2 py-0.5 rounded" style={{ backgroundColor: draft.colors.primary }}>{l}</span>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: draft.colors.secondary }}>
                    <span className="font-bold text-sm text-white" style={{ fontFamily: draft.font }}>{vendor?.display_name || 'Store'}</span>
                    <div className="flex items-center gap-2 text-white">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="px-4 py-1.5 flex gap-3 text-xs text-white" style={{ backgroundColor: draft.colors.primary }}>
                    {['Home', 'Products', 'Services', 'Policies'].map(l => (
                      <span key={l} className="opacity-90">{l}</span>
                    ))}
                  </div>
                </>
              )}

              {/* Hero */}
              {draft.sections.hero && (() => {
                const heroH = draft.hero_height || 'medium'
                const heroPy = heroH === 'compact' ? 'py-4' : heroH === 'tall' ? 'py-10' : 'py-6'
                const br = draft.button_radius === 'sharp' ? 'rounded-none' : draft.button_radius === 'pill' ? 'rounded-full' : 'rounded-lg'
                const isDark = draft.hero_style === 'dark'
                const isGrad = draft.hero_style === 'gradient'
                const isImage = draft.hero_style === 'image'
                const onPhoto = isImage || isGrad
                const titleColor = isDark || onPhoto ? '#ffffff' : draft.colors.primary
                const subtitleColor = isDark || onPhoto ? 'rgba(255,255,255,0.85)' : '#6b7280'
                const heroBg = isGrad
                  ? `linear-gradient(135deg, ${draft.colors.primary}, ${draft.colors.secondary})`
                  : isDark
                    ? 'linear-gradient(135deg, #0f0a1e, #1e1b4b)'
                    : isImage
                      ? `linear-gradient(105deg, ${draft.colors.secondary}e8 0%, ${draft.colors.primary}cc 38%, rgba(15,23,42,0.72) 100%)`
                      : '#ffffff'
                return (
                  <div
                    className={`${heroPy} px-4 relative overflow-hidden text-center`}
                    style={{ background: heroBg }}
                  >
                    <div className="mx-auto max-w-[90%]">
                      <h2 className="text-base font-bold drop-shadow-sm" style={{
                        fontFamily: draft.font,
                        color: titleColor,
                      }}>
                        {draft.hero_title || `Welcome to ${vendor?.display_name || 'Store'}`}
                      </h2>
                      <p className="text-xs mt-1 drop-shadow-sm" style={{ color: subtitleColor }}>
                        {draft.hero_subtitle || 'Quality products and services'}
                      </p>
                      <div className="mt-3 flex gap-2 justify-center">
                      <div
                        className={`px-2.5 py-1 text-xs font-medium ${br}`}
                        style={{
                          backgroundColor: isDark || onPhoto ? draft.colors.accent : draft.colors.primary,
                          color: isDark || onPhoto ? '#0f172a' : '#ffffff',
                        }}
                      >
                        Shop Now
                      </div>
                      <div
                        className={`px-2.5 py-1 text-xs font-medium border-2 ${br}`}
                        style={{
                          borderColor: isDark || onPhoto ? 'rgba(255,255,255,0.75)' : draft.colors.primary,
                          color: isDark || onPhoto ? '#ffffff' : draft.colors.primary,
                          backgroundColor: isDark || onPhoto ? 'rgba(255,255,255,0.1)' : 'transparent',
                        }}
                      >
                        Services
                      </div>
                    </div>
                    </div>
                  </div>
                )
              })()}

              {/* Trust badges */}
              {draft.sections.trust_badges && (
                <div className="bg-white border-y px-4 py-2 flex justify-around">
                  {['Free Shipping', 'Secure Pay', 'Easy Returns'].map((t) => (
                    <span key={t} className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Truck className="w-3 h-3" style={{ color: draft.colors.primary }} />{t}
                    </span>
                  ))}
                </div>
              )}

              {/* Products */}
              {draft.sections.featured_products && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold" style={{ fontFamily: draft.font }}>Featured Products</h3>
                    <span className="text-xs flex items-center gap-0.5" style={{ color: draft.colors.primary }}>See all <ChevronRight className="w-3 h-3" /></span>
                  </div>
                  <div className={`grid gap-2 ${draft.product_layout === 'grid-3' ? 'grid-cols-3' : 'grid-cols-4'}`}>
                    {Array.from({ length: draft.product_layout === 'grid-3' ? 3 : 4 }).map((_, i) => (
                      <div key={i} className="bg-white rounded-lg border overflow-hidden">
                        <div className="aspect-square bg-gray-100" />
                        <div className="p-2">
                          <div className="h-2 w-2/3 bg-gray-200 rounded" />
                          <div className="flex items-center gap-0.5 mt-1.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className="w-2 h-2" style={{ color: s <= 4 ? draft.colors.accent : '#d1d5db' }} fill={s <= 4 ? draft.colors.accent : 'none'} />
                            ))}
                          </div>
                          <div className="h-2.5 w-1/2 rounded mt-1.5" style={{ backgroundColor: draft.colors.primary + '20' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Services */}
              {draft.sections.featured_services && (
                <div className="px-4 pb-4">
                  <h3 className="text-sm font-bold mb-3" style={{ fontFamily: draft.font }}>Our Services</h3>
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex gap-2 bg-white rounded-lg border p-2">
                        <div className="w-12 h-12 rounded bg-gray-100 shrink-0 flex items-center justify-center">
                          <Wrench className="w-5 h-5 text-gray-300" />
                        </div>
                        <div className="flex-1">
                          <div className="h-2 w-1/2 bg-gray-200 rounded" />
                          <div className="h-1.5 w-3/4 bg-gray-100 rounded mt-1.5" />
                          <div className="h-2 w-1/4 rounded mt-1.5" style={{ backgroundColor: draft.colors.primary + '30' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Offers */}
              {draft.sections.offers_banner && (
                <div className="mx-4 mb-4 rounded-xl p-4 text-center" style={{
                  background: `linear-gradient(135deg, ${draft.colors.accent}22, ${draft.colors.primary}22)`,
                  border: `1px dashed ${draft.colors.accent}`,
                }}>
                  <p className="text-xs font-bold" style={{ color: draft.colors.accent }}>Special Offers</p>
                  <p className="text-xs text-gray-500 mt-0.5">Up to 50% off on selected items</p>
                </div>
              )}

              {/* CTA */}
              {draft.sections.cta && (
                <div className="mx-4 mb-4 rounded-xl p-4 text-center text-white" style={{
                  background: `linear-gradient(135deg, ${draft.colors.secondary} 0%, ${draft.colors.primary} 50%, ${draft.colors.secondary}e8 100%)`,
                }}>
                  <p className="text-sm font-bold">Ready to get started?</p>
                  <div className="mt-3 flex justify-center gap-2">
                    <div className="px-3 py-1.5 text-xs font-bold rounded-lg shadow-sm" style={{ backgroundColor: '#ffffff', color: draft.colors.secondary }}>
                      Browse Products
                    </div>
                    <div className="px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-white text-white">
                      Create Account
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
