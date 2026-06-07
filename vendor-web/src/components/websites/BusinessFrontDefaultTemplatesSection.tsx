import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ExternalLink, Layout, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { vendorApi } from '@/api/vendor'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
import {
  isLegacyPresetActive,
  resolveBusinessFrontActiveTemplate,
  type ThemePresetSummary,
} from '@/lib/businessFrontActiveTemplate'
import { Button } from '@/components/ui/button'

type Props = {
  presets: ThemePresetSummary[]
  themeTemplateId: string | undefined
  sites: { id: string; name: string; is_published: boolean }[]
  vendorSlug: string | undefined
  isLoading?: boolean
  /** When true, hide the outer section chrome (embedded in another page). */
  compact?: boolean
}

export function BusinessFrontDefaultTemplatesSection({
  presets,
  themeTemplateId,
  sites,
  vendorSlug,
  isLoading,
  compact,
}: Props) {
  const qc = useQueryClient()
  const active = resolveBusinessFrontActiveTemplate(themeTemplateId, presets, sites)

  const applyPreset = useMutation({
    mutationFn: (presetId: string) => vendorApi.applyTemplatePreset(presetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-config'] })
      toast.success('Business front theme updated')
    },
    onError: () => toast.error('Could not apply theme preset'),
  })

  const storeUrl = vendorSlug ? getCustomerStorefrontBaseUrl(vendorSlug) : null

  const body = (
    <>
      {!compact && (
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="font-semibold text-gray-900 flex items-center gap-2">
            <Layout className="w-4 h-4 text-primary shrink-0" />
            Live on your business front
          </p>
          <p className="text-gray-600 mt-1">
            <span className="font-medium text-gray-900">{active.name}</span>
            {' — '}
            {active.description}
          </p>
          {active.kind === 'website_builder' && active.siteId && (
            <Link
              to={`/websites/${active.siteId}`}
              className="inline-flex items-center gap-1 text-primary font-semibold mt-2 hover:underline"
            >
              Open in Website Builder
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
          {active.kind === 'legacy_preset' && storeUrl && (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary font-semibold mt-2 hover:underline"
            >
              View live store
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500 py-4">Loading default templates…</p>}

      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {presets.map(preset => {
            const live = isLegacyPresetActive(active, preset.id)
            const palette = preset.colors
              ? [preset.colors.primary, preset.colors.secondary, preset.colors.accent, preset.colors.background].filter(Boolean)
              : []

            return (
              <div
                key={preset.id}
                className={cn(
                  'rounded-2xl border overflow-hidden bg-white transition-shadow',
                  live ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-gray-100 hover:border-primary/25',
                )}
              >
                <div
                  className="h-28 relative"
                  style={{
                    background: palette.length >= 2
                      ? `linear-gradient(135deg, ${palette[0]}, ${palette[1]})`
                      : 'linear-gradient(135deg, #2563eb, #1e40af)',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
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
                  <h3 className="font-extrabold text-gray-900">{preset.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 min-h-[2.5rem]">
                    {preset.description || 'Section-based home used when no Website Builder site is published.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
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
                    <Link
                      to="/template"
                      className="px-3 py-1.5 rounded-lg text-xs font-extrabold border border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      Customize
                    </Link>
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
          })}
        </div>
      )}
    </>
  )

  if (compact) return body

  return (
    <section className="bg-white border border-gray-200/80 rounded-2xl shadow-sm p-4 sm:p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <div className="inline-flex items-center gap-2 text-primary font-extrabold text-xs uppercase tracking-wide mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Business front defaults
          </div>
          <h2 className="text-lg font-extrabold text-gray-900">Default store layouts</h2>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            These themes power your live business front when no Website Builder site is published — hero, featured
            products, trust badges, and colors. Pick one below to see which layout customers get today.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link to="/template">Open theme editor</Link>
        </Button>
      </div>
      {body}
    </section>
  )
}
