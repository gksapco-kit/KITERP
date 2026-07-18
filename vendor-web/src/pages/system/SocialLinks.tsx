import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useUpdateVendor, useStores, useUpdateStore } from '@/hooks/useVendor'
import { useVendorStore } from '@/stores/vendorStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { ThemeSelect } from '@/components/common/ThemeSelect'
import { SocialLinksModeToggle } from '@/components/business-units/SocialLinksModeToggle'
import { Save, Loader2, Link2, ExternalLink, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Vendor } from '@/types'
import {
  SOCIAL_LINK_FIELDS,
  SOCIAL_LINKS_ICON_STYLE_KEY,
  SOCIAL_LINKS_ICON_STYLE_OPTIONS,
  SOCIAL_LINKS_MODE_KEY,
  DEFAULT_SOCIAL_LINKS_ICON_STYLE,
  isSocialLinksIconStyle,
  resolveSocialLinksIconStyle,
  resolveSocialLinksMode,
  storeSocialLinks,
  type SocialLinksIconStyle,
  type SocialLinksMode,
} from '@/lib/socialLinksMode'
import { cn } from '@/lib/utils'
import { SocialPlatformIcon } from '@/lib/socialPlatformIcons'
import {
  normalizeSocialLinksForSave,
  resolveSocialLinkHref,
  socialLinkValueForInput,
} from '@/lib/socialLinkStorage'

import { askConfirm } from '@/components/common/ConfirmProvider'
function linksFromSource(source?: Record<string, string> | null): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of SOCIAL_LINK_FIELDS) {
    out[f.key] = socialLinkValueForInput(f.key, source?.[f.key] || '')
  }
  if (source) {
    for (const [k, v] of Object.entries(source)) {
      if (!(k in out) && typeof v === 'string') out[k] = socialLinkValueForInput(k, v)
    }
  }
  return out
}

function cleanLinks(links: Record<string, string>): Record<string, string> {
  return normalizeSocialLinksForSave(links)
}

export default function SocialLinksPage() {
  const { vendor } = useVendorStore()
  const updateVendor = useUpdateVendor()
  const updateStore = useUpdateStore()
  const { data: storesData } = useStores()
  const stores = useMemo(
    () => (storesData?.stores ?? []).filter(s => s.is_active && s.unit_type !== 'branch'),
    [storesData],
  )

  const socialLinksMode = resolveSocialLinksMode(vendor?.settings)
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [links, setLinks] = useState<Record<string, string>>({})
  const [iconStyle, setIconStyle] = useState<SocialLinksIconStyle>(DEFAULT_SOCIAL_LINKS_ICON_STYLE)
  const [isDirty, setIsDirty] = useState(false)
  const savingRef = useRef(false)
  const formDirtyRef = useRef(false)

  const activeStore = useMemo(
    () => stores.find(s => s.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  )

  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      const def = stores.find(s => s.is_default) ?? stores[0]
      setSelectedStoreId(def.id)
    }
  }, [stores, selectedStoreId])

  useEffect(() => {
    if (!vendor || savingRef.current || formDirtyRef.current) return
    if (socialLinksMode === 'shared') {
      setLinks(linksFromSource(vendor.social_links))
      setIconStyle(resolveSocialLinksIconStyle(vendor.settings))
      setIsDirty(false)
      return
    }
    if (activeStore) {
      setLinks(linksFromSource(storeSocialLinks(activeStore.settings)))
      setIconStyle(
        resolveSocialLinksIconStyle(
          vendor.settings,
          activeStore.settings as Record<string, unknown> | undefined,
          'per_unit',
        ),
      )
      setIsDirty(false)
    }
  }, [vendor, socialLinksMode, activeStore])

  const handleSetSocialLinksMode = useCallback(
    (mode: SocialLinksMode) => {
      const current = useVendorStore.getState().vendor
      if (!current) return
      if (resolveSocialLinksMode(current.settings) === mode) return
      updateVendor.mutate({
        settings: { ...(current.settings ?? {}), [SOCIAL_LINKS_MODE_KEY]: mode },
      })
      formDirtyRef.current = false
      setIsDirty(false)
    },
    [updateVendor],
  )

  const markDirty = (next: Record<string, string>) => {
    formDirtyRef.current = true
    setIsDirty(true)
    setLinks(next)
  }

  const handleIconStyleChange = (next: string) => {
    if (!isSocialLinksIconStyle(next)) return
    formDirtyRef.current = true
    setIsDirty(true)
    setIconStyle(next)
  }

  const handleStoreChange = async (storeId: string) => {
    if (formDirtyRef.current && !await askConfirm('You have unsaved changes. Switch business unit anyway?')) return
    formDirtyRef.current = false
    setIsDirty(false)
    setSelectedStoreId(storeId)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = cleanLinks(links)
    savingRef.current = true
    formDirtyRef.current = false
    setIsDirty(false)

    if (socialLinksMode === 'shared') {
      updateVendor.mutate({
        social_links: cleaned,
        settings: {
          ...(vendor?.settings ?? {}),
          [SOCIAL_LINKS_ICON_STYLE_KEY]: iconStyle,
        },
      } as Partial<Vendor>, {
        onSuccess: () => toast.success('Social links updated'),
        onSettled: () => { savingRef.current = false },
      })
      return
    }

    if (!activeStore) {
      toast.error('Select a business unit first')
      savingRef.current = false
      return
    }

    const settings = {
      ...(activeStore.settings ?? {}),
      social_links: cleaned,
      [SOCIAL_LINKS_ICON_STYLE_KEY]: iconStyle,
    }
    updateStore.mutate(
      { id: activeStore.id, data: { settings } },
      {
        onSuccess: () => toast.success(`${activeStore.name} social links updated`),
        onSettled: () => { savingRef.current = false },
      },
    )
  }

  const isSaving = updateVendor.isPending || updateStore.isPending

  const editingHint =
    socialLinksMode === 'shared'
      ? 'These links apply to every business unit — store footer, website footer, and social sections.'
      : activeStore
        ? `Editing links for ${activeStore.code ? `${activeStore.code} — ` : ''}${activeStore.name}. Empty fields inherit your shared links.`
        : 'Select a business unit to edit its links.'

  const sharedLinks = vendor?.social_links ?? {}

  const inheritedHint = (key: string): string | undefined => {
    if (socialLinksMode !== 'per_unit') return undefined
    const inherited = sharedLinks[key]?.trim()
    if (!inherited || links[key]?.trim()) return undefined
    return `Inherited: ${socialLinkValueForInput(key, inherited)}`
  }

  const whatsappHref = resolveSocialLinkHref(
    'whatsapp',
    links.whatsapp?.trim() || (socialLinksMode === 'per_unit' ? sharedLinks.whatsapp : '') || '',
  )
  const otherFields = SOCIAL_LINK_FIELDS.filter((f) => f.key !== 'whatsapp')
  const whatsappField = SOCIAL_LINK_FIELDS.find((f) => f.key === 'whatsapp')

  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Link2 className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold leading-tight text-foreground">Social & Web Links</h1>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              Set once here — links appear in your store footer, website footer, and social sections.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-border/70 bg-muted/15 px-2 py-1.5 lg:shrink-0">
          <SocialLinksModeToggle
            mode={socialLinksMode}
            pending={updateVendor.isPending}
            onConfirm={handleSetSocialLinksMode}
          />
          <Button type="submit" form="social-links-form" disabled={isSaving} className="h-8 shrink-0 gap-1.5 px-3 text-xs">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <form id="social-links-form" onSubmit={handleSubmit} className="space-y-2.5 p-3">
            <div
              className={cn(
                'grid grid-cols-1 gap-2',
                socialLinksMode === 'per_unit' ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]' : 'max-w-[14rem]',
              )}
            >
              {socialLinksMode === 'per_unit' && (
                <div className="space-y-1">
                  <Label className="text-xs">Business unit</Label>
                  <BusinessUnitSelect
                    value={selectedStoreId}
                    onChange={handleStoreChange}
                    autoSelectDefault
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="social-links-icon-style" className="text-xs">Icon style</Label>
                <ThemeSelect
                  id="social-links-icon-style"
                  value={iconStyle}
                  onChange={handleIconStyleChange}
                  aria-label="Social icon style"
                  wrapperClassName="w-full"
                  options={SOCIAL_LINKS_ICON_STYLE_OPTIONS.map(opt => ({
                    value: opt.value,
                    label: opt.label,
                    hint: opt.description,
                  }))}
                />
              </div>
            </div>

            <p className="text-[11px] leading-snug text-muted-foreground">{editingHint}</p>

            {whatsappField && (
              <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-800">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <Label htmlFor="social-link-whatsapp" autoHelp={false} className="mb-0 text-xs font-semibold">
                        WhatsApp
                      </Label>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        Footer and social icons — customers tap to open chat.
                      </p>
                    </div>
                  </div>
                  {whatsappHref && (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Preview
                    </a>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
                      links.whatsapp?.trim() || inheritedHint('whatsapp')
                        ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                        : 'bg-muted/80 text-muted-foreground ring-border',
                    )}
                    aria-hidden
                  >
                    <SocialPlatformIcon platform="whatsapp" style={iconStyle} bare className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <PhoneInput
                      value={links.whatsapp || ''}
                      onChange={(v) => markDirty({ ...links, whatsapp: v })}
                      defaultCountryIso="IN"
                      placeholder={inheritedHint('whatsapp') || whatsappField.placeholder}
                      dense
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {otherFields.map((f) => {
                const hasValue = Boolean(links[f.key]?.trim())
                const inherited = inheritedHint(f.key)
                return (
                  <div key={f.key} className="space-y-1">
                    <Label htmlFor={`social-link-${f.key}`} autoHelp={false} className="mb-0 text-xs">
                      {f.label}
                    </Label>
                    {f.kind === 'phone' ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
                            hasValue || inherited
                              ? 'bg-primary/10 text-primary ring-primary/25'
                              : 'bg-muted/80 text-muted-foreground ring-border',
                          )}
                          aria-hidden
                        >
                          <SocialPlatformIcon platform={f.key} style={iconStyle} bare className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <PhoneInput
                            value={links[f.key] || ''}
                            onChange={(v) => markDirty({ ...links, [f.key]: v })}
                            defaultCountryIso="IN"
                            placeholder={inherited || f.placeholder}
                            dense
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <span
                          className={cn(
                            'pointer-events-none absolute left-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md ring-1 ring-inset',
                            hasValue || inherited
                              ? 'bg-primary/10 text-primary ring-primary/25'
                              : 'bg-muted/80 text-muted-foreground ring-border',
                          )}
                          aria-hidden
                        >
                          <SocialPlatformIcon platform={f.key} style={iconStyle} bare className="h-3 w-3" />
                        </span>
                        <Input
                          id={`social-link-${f.key}`}
                          value={links[f.key] || ''}
                          onChange={(e) => markDirty({ ...links, [f.key]: e.target.value })}
                          placeholder={inherited || f.placeholder}
                          className={cn('h-9 pl-10 text-sm', hasValue && 'border-primary/30')}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {isDirty && (
              <p className="text-right text-[11px] text-amber-600 dark:text-amber-400">
                Unsaved changes
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
