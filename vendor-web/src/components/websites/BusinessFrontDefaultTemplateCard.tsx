import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { vendorApi } from '@/api/vendor'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
import {
  isLegacyPresetActive,
  resolveBusinessFrontActiveTemplate,
  type ThemePresetSummary,
} from '@/lib/businessFrontActiveTemplate'

type Props = {
  preset: ThemePresetSummary
  themeTemplateId: string | undefined
  sites: { id: string; name: string; is_published: boolean }[]
  vendorSlug: string | undefined
  onCustomize: () => void
}

export function BusinessFrontDefaultTemplateCard({
  preset,
  themeTemplateId,
  sites,
  vendorSlug,
  onCustomize,
}: Props) {
  const qc = useQueryClient()
  const active = resolveBusinessFrontActiveTemplate(themeTemplateId, [preset], sites)
  const live = isLegacyPresetActive(active, preset.id)
  const storeUrl = vendorSlug ? getCustomerStorefrontBaseUrl(vendorSlug) : null

  const palette = preset.colors
    ? [preset.colors.primary, preset.colors.secondary, preset.colors.accent, preset.colors.background].filter(Boolean)
    : []

  const applyPreset = useMutation({
    mutationFn: (presetId: string) => vendorApi.applyTemplatePreset(presetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-config'] })
      toast.success('Business front theme updated')
    },
    onError: () => toast.error('Could not apply theme preset'),
  })

  return (
    <div
      className={cn(
        'text-left border rounded-2xl overflow-hidden transition-colors group bg-white',
        'shadow-[0_1px_0_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(100,195,160,0.15)]',
        live ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100 hover:border-primary/30',
      )}
    >
      <div className="relative">
        <div
          className="w-full h-36 sm:h-40"
          style={{
            background: palette.length >= 2
              ? `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`
              : 'linear-gradient(135deg, #64C3A0, #13624A)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent pointer-events-none" />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1.5">
          <span className="text-[10px] uppercase tracking-wide font-extrabold bg-white/90 text-gray-800 rounded-full px-2 py-0.5">
            Default layout
          </span>
          {live && (
            <span className="text-[10px] uppercase tracking-wide font-extrabold bg-primary text-white rounded-full px-2 py-0.5 flex items-center gap-0.5">
              <Check className="w-3 h-3" /> Live
            </span>
          )}
        </div>
        {palette.length > 0 && (
          <div className="absolute bottom-2 right-2 inline-flex -space-x-1">
            {palette.slice(0, 4).map((c, i) => (
              <span
                key={`${c}-${i}`}
                className="w-3.5 h-3.5 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="p-3.5">
        <div className="font-extrabold text-gray-900 group-hover:text-primary transition-colors">{preset.name}</div>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
          {preset.description || 'Section-based home used when no Website Builder site is published.'}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
          {storeUrl && (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Preview store
            </a>
          )}
          <button
            type="button"
            onClick={onCustomize}
            className="px-3 py-1.5 rounded-lg text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            Customize
          </button>
          <button
            type="button"
            disabled={live || applyPreset.isPending || active.kind === 'website_builder'}
            title={
              active.kind === 'website_builder'
                ? 'Unpublish your Website Builder site to switch default themes'
                : live
                  ? 'Already active on your store'
                  : undefined
            }
            onClick={() => applyPreset.mutate(preset.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors',
              live || active.kind === 'website_builder'
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-primary text-white hover:opacity-90',
            )}
          >
            {live ? 'In use' : 'Use this theme'}
          </button>
        </div>
      </div>
    </div>
  )
}
