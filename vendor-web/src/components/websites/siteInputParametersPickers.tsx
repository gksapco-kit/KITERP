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

function PaletteSwatchStrip({
  colors,
  className,
}: {
  colors: WebsitePaletteColors
  className?: string
}) {
  return (
    <div className={cn('flex items-stretch overflow-hidden', className)} aria-hidden>
      <span className="flex-[2]" style={{ backgroundColor: colors.primary_color }} />
      <span className="flex-1" style={{ backgroundColor: colors.secondary_color }} />
      <span className="flex-1" style={{ backgroundColor: colors.accent_color }} />
      <span className="flex-1 border-l border-black/5" style={{ backgroundColor: colors.bg_color }} />
    </div>
  )
}

export function ColorPalettePicker({
  selected,
  customColors,
  disabled,
  onSelect,
  onCustomColorsChange,
  title = 'Color palette',
  description = 'Pick a preset or draft your own brand colors.',
  idPrefix = 'palette',
}: {
  selected: WebsiteColorPaletteId
  customColors: WebsitePaletteColors
  disabled?: boolean
  onSelect: (id: WebsiteColorPaletteId) => void
  onCustomColorsChange: (colors: WebsitePaletteColors) => void
  title?: string
  description?: string
  /** Prefix for hex input ids (avoids collisions when two pickers mount). */
  idPrefix?: string
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
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="mt-0.5 text-xs text-gray-500">{description}</p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            {getWebsiteColorPaletteLabel(selected)}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* Live preview — how the palette reads on a site surface */}
        <div
          className="overflow-hidden rounded-xl border border-gray-200 shadow-sm"
          style={{ backgroundColor: activeColors.bg_color }}
          aria-label="Selected palette preview"
        >
          <div
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={{ backgroundColor: activeColors.primary_color }}
          >
            <span className="text-xs font-semibold text-white/95">Your site</span>
            <span
              className="rounded-md px-2 py-1 text-[10px] font-semibold"
              style={{ backgroundColor: activeColors.accent_color, color: '#fff' }}
            >
              Accent
            </span>
          </div>
          <div className="px-4 py-3.5">
            <div
              className="rounded-lg border px-3 py-2.5 shadow-sm"
              style={{
                backgroundColor: activeColors.surface_color,
                borderColor: `${activeColors.secondary_color}33`,
              }}
            >
              <p className="text-sm font-semibold" style={{ color: activeColors.text_color }}>
                Headline & buttons
              </p>
              <p className="mt-0.5 text-[11px] leading-snug opacity-70" style={{ color: activeColors.text_color }}>
                Preview updates as you pick a palette.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: activeColors.primary_color }}
                >
                  Primary
                </span>
                <span
                  className="inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: activeColors.secondary_color }}
                >
                  Secondary
                </span>
                <span
                  className="inline-flex rounded-md border px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    borderColor: activeColors.accent_color,
                    color: activeColors.accent_color,
                    backgroundColor: activeColors.surface_color,
                  }}
                >
                  Outline
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {WEBSITE_COLOR_PALETTES.map(palette => {
            const checked = selected === palette.id
            return (
              <button
                key={palette.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(palette.id)}
                aria-pressed={checked}
                title={palette.description}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-xl border-2 text-left transition-all',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
                  checked
                    ? 'border-primary shadow-sm shadow-primary/10 ring-1 ring-primary/20'
                    : 'border-gray-200 bg-white hover:border-primary/30 hover:shadow-sm',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <PaletteSwatchStrip colors={palette.colors} className="h-12 border-b border-gray-100" />
                <div className="px-2.5 py-2">
                  <p className="truncate text-xs font-semibold text-gray-900">{palette.label}</p>
                  <p className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-gray-500">
                    {palette.description}
                  </p>
                </div>
                {checked && (
                  <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-black/5">
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
            <PaletteSwatchStrip colors={customColors} className="h-12 border-b border-gray-100" />
            <div className="px-2.5 py-2">
              <p className="flex items-center gap-1 text-xs font-semibold text-gray-900">
                <Paintbrush className="h-3.5 w-3.5 shrink-0 text-primary" />
                Custom
              </p>
              <p className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-gray-500">
                Draft your own colors
              </p>
            </div>
            {isCustom && (
              <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-primary shadow-sm ring-1 ring-black/5">
                <Check className="h-3 w-3 stroke-[3]" aria-hidden />
              </span>
            )}
          </button>
        </div>

        {isCustom && (
          <div className="rounded-xl border border-primary/20 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-gray-900">Draft your palette</p>
              <PaletteSwatchStrip
                colors={customColors}
                className="h-7 max-w-[200px] flex-1 rounded-md border border-gray-200 shadow-inner"
              />
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {WEBSITE_PALETTE_COLOR_FIELDS.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50/80 px-2.5 py-2"
                >
                  <input
                    type="color"
                    value={customColors[key]}
                    disabled={disabled}
                    onChange={e => updateCustomColor(key, e.target.value)}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5"
                    aria-label={`${label} color`}
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`${idPrefix}-${key}`} className="block text-xs font-medium text-gray-700">
                      {label}
                    </label>
                    <input
                      id={`${idPrefix}-${key}`}
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
      </div>

      <div className="border-t border-gray-100 bg-gray-50/90 px-4 py-3">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-500">
          <Palette className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>Applies to buttons, heroes, cards, and CTAs. You can fine-tune colors in the builder anytime.</span>
        </p>
      </div>
    </div>
  )
}
