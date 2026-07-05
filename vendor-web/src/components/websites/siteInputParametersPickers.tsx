import {
  Check, Lock, Sparkles, Palette, Paintbrush,
  FileText, Smartphone, ShoppingBag, Wrench, Star, Mail, ShoppingCart,
  Search, ClipboardList, Users, CreditCard, BookOpen, CalendarCheck, GalleryHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SetupFeatureId, SetupFeatureOption } from '@/lib/businessSitePresets'
import {
  CUSTOM_WEBSITE_PALETTE_ID,
  getWebsiteColorPaletteLabel,
  resolveWebsitePaletteColors,
  WEBSITE_COLOR_PALETTES,
  WEBSITE_PALETTE_COLOR_FIELDS,
  type WebsiteColorPaletteId,
  type WebsitePaletteColors,
} from '@/lib/websiteColorPalettes'

const SETUP_FEATURE_ICONS: Record<SetupFeatureId, LucideIcon> = {
  homepage_copy: FileText,
  mobile_layout: Smartphone,
  products_sections: ShoppingBag,
  services_sections: Wrench,
  reviews_trust: Star,
  contact_form: Mail,
  commerce_blocks: ShoppingCart,
  seo_content: Search,
  publish_checklist: ClipboardList,
  about_page: Users,
  services_page: Wrench,
  pricing_page: CreditCard,
  blog_page: BookOpen,
  booking_blocks: CalendarCheck,
  menu_gallery: GalleryHorizontal,
}

export function SetupFeaturesPicker({
  features,
  selected,
  businessType,
  sellingMode,
  disabled,
  onToggle,
  onSelectRecommended,
}: {
  features: SetupFeatureOption[]
  selected: SetupFeatureId[]
  businessType: string
  sellingMode: string
  disabled?: boolean
  onToggle: (id: SetupFeatureId, locked?: boolean) => void
  onSelectRecommended: () => void
}) {
  const core = features.filter(f => f.locked)
  const optional = features.filter(f => !f.locked)
  const featureIds = new Set(features.map(f => f.id))
  const selectedInView = selected.filter(id => featureIds.has(id))
  const optionalSelected = optional.filter(f => selected.includes(f.id)).length

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/80">
      <div className="border-b border-gray-100 bg-white/90 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Optional sections</p>
            <p className="mt-0.5 text-xs text-gray-500">Core features are always on. Toggle optional sections below.</p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-primary">
            {selectedInView.length} of {features.length}
          </span>
        </div>
      </div>

      {core.length > 0 && (
        <div className="border-b border-gray-100 px-4 py-3">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Always included</p>
          <div className="flex flex-wrap gap-2">
            {core.map(feature => {
              const Icon = SETUP_FEATURE_ICONS[feature.id]
              return (
                <div
                  key={feature.id}
                  title={feature.description}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1.5 text-[11px] font-medium text-emerald-800"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                  <Icon className="h-3.5 w-3.5 opacity-70" />
                  <span>{feature.label}</span>
                  <Lock className="h-3 w-3 opacity-40" aria-hidden />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {optional.length > 0 && (
        <div className="px-4 py-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Optional sections</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] tabular-nums text-gray-400">{optionalSelected}/{optional.length} on</span>
              <button
                type="button"
                disabled={disabled}
                onClick={onSelectRecommended}
                className="text-[10px] font-semibold text-primary hover:text-primary/80 disabled:opacity-50"
              >
                Reset to recommended
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {optional.map(feature => {
              const Icon = SETUP_FEATURE_ICONS[feature.id]
              const checked = selected.includes(feature.id)
              return (
                <button
                  key={feature.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggle(feature.id, false)}
                  aria-pressed={checked}
                  className={cn(
                    'group relative flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
                    checked
                      ? 'border-primary bg-primary/[0.06] shadow-sm shadow-primary/10'
                      : 'border-gray-200 bg-white hover:border-primary/30 hover:bg-gray-50/80',
                    disabled && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                      checked ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-primary/10 group-hover:text-primary',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 pr-6">
                    <span className={cn('block text-xs font-semibold leading-tight', checked ? 'text-gray-900' : 'text-gray-800')}>
                      {feature.label}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-[11px] leading-snug text-gray-500">
                      {feature.description}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all',
                      checked
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 bg-white group-hover:border-primary/50',
                    )}
                    aria-hidden
                  >
                    {checked && <Check className="h-3 w-3 stroke-[3]" />}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 bg-gray-50/90 px-4 py-3">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-500">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            Generated from your <strong className="font-medium text-gray-700">{businessType}</strong> setup
            {sellingMode !== 'both' ? ` (${sellingMode})` : ''}.
          </span>
        </p>
      </div>
    </div>
  )
}

export function ColorPalettePicker({
  selected,
  customColors,
  disabled,
  onSelect,
  onCustomColorsChange,
}: {
  selected: WebsiteColorPaletteId
  customColors: WebsitePaletteColors
  disabled?: boolean
  onSelect: (id: WebsiteColorPaletteId) => void
  onCustomColorsChange: (colors: WebsitePaletteColors) => void
}) {
  const activeColors = resolveWebsitePaletteColors(selected, customColors)
  const isCustom = selected === CUSTOM_WEBSITE_PALETTE_ID

  const updateCustomColor = (key: keyof WebsitePaletteColors, value: string) => {
    onCustomColorsChange({ ...customColors, [key]: value })
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/80">
      <div className="border-b border-gray-100 bg-white/90 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Color palette</p>
            <p className="mt-0.5 text-xs text-gray-500">Pick a preset or draft your own brand colors.</p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            {getWebsiteColorPaletteLabel(selected)}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {WEBSITE_COLOR_PALETTES.map(palette => {
            const checked = selected === palette.id
            return (
              <button
                key={palette.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(palette.id)}
                aria-pressed={checked}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
                  checked
                    ? 'border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/20'
                    : 'border-gray-200 bg-white hover:border-primary/30 hover:shadow-sm',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <div className="flex h-14 items-stretch border-b border-gray-100" aria-hidden>
                  <span className="flex-[2]" style={{ backgroundColor: palette.colors.primary_color }} />
                  <span className="flex-1" style={{ backgroundColor: palette.colors.accent_color }} />
                  <span className="flex-1 border-l border-gray-100" style={{ backgroundColor: palette.colors.bg_color }} />
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-xs font-semibold text-gray-900">{palette.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-gray-500">{palette.description}</p>
                </div>
                {checked && (
                  <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                    <Check className="h-3 w-3 stroke-[3]" aria-hidden />
                  </span>
                )}
              </button>
            )
          })}

          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(CUSTOM_WEBSITE_PALETTE_ID)}
            aria-pressed={isCustom}
            className={cn(
              'group relative flex flex-col overflow-hidden rounded-xl border-2 border-dashed text-left transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
              isCustom
                ? 'border-primary bg-primary/[0.04] shadow-sm shadow-primary/10 ring-1 ring-primary/20'
                : 'border-gray-300 bg-white hover:border-primary/40 hover:bg-gray-50/80',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <div className="flex h-14 items-stretch border-b border-gray-100" aria-hidden>
              <span className="flex-[2]" style={{ backgroundColor: customColors.primary_color }} />
              <span className="flex-1" style={{ backgroundColor: customColors.accent_color }} />
              <span className="flex-1 border-l border-gray-100" style={{ backgroundColor: customColors.bg_color }} />
            </div>
            <div className="px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                <Paintbrush className="h-3.5 w-3.5 text-primary" />
                Custom palette
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-gray-500">Draft your own primary, accent, and background colors.</p>
            </div>
            {isCustom && (
              <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                <Check className="h-3 w-3 stroke-[3]" aria-hidden />
              </span>
            )}
          </button>
        </div>

        {isCustom && (
          <div className="rounded-xl border border-primary/20 bg-white p-4 shadow-sm">
            <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {WEBSITE_PALETTE_COLOR_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50/80 px-2.5 py-2">
                  <input
                    type="color"
                    value={customColors[key]}
                    disabled={disabled}
                    onChange={e => updateCustomColor(key, e.target.value)}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5"
                    aria-label={`${label} color`}
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`palette-${key}`} className="block text-xs font-medium text-gray-700">{label}</label>
                    <input
                      id={`palette-${key}`}
                      type="text"
                      value={customColors[key]}
                      disabled={disabled}
                      onChange={e => {
                        const v = e.target.value.trim()
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) updateCustomColor(key, v)
                      }}
                      onBlur={e => {
                        const v = e.target.value.trim()
                        if (!/^#[0-9A-Fa-f]{6}$/.test(v)) updateCustomColor(key, customColors[key])
                      }}
                      className="mt-0.5 w-full bg-transparent font-mono text-[11px] text-gray-500 outline-none"
                      spellCheck={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isCustom && (
          <div className="flex h-10 overflow-hidden rounded-xl border border-gray-200 shadow-inner" aria-label="Selected palette preview">
            <span className="flex-[2]" style={{ backgroundColor: activeColors.primary_color }} />
            <span className="flex-1" style={{ backgroundColor: activeColors.accent_color }} />
            <span className="flex-1" style={{ backgroundColor: activeColors.bg_color }} />
            <span className="flex-1 border-l border-gray-100" style={{ backgroundColor: activeColors.surface_color }} />
            <span className="w-10" style={{ backgroundColor: activeColors.text_color }} />
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 bg-gray-50/90 px-4 py-3">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-500">
          <Palette className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>Palette applies to buttons, heroes, cards, and CTAs across your site.</span>
        </p>
      </div>
    </div>
  )
}
