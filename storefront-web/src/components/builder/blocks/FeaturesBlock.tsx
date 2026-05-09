import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'

interface FeatureItem { icon?: string; title: string; desc?: string; description?: string; image_url?: string }

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockType: string
}

export default function FeaturesBlock({ style, props, blockType }: Props) {
  const title = (props.title as string) || ''
  const features = (props.features as FeatureItem[] | undefined) || []
  const isAlternating = blockType === 'features_alternating'

  if (isAlternating) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-16">
        {title && <h2 className="text-3xl font-bold text-gray-900 text-center">{title}</h2>}
        {features.map((feature, i) => (
          <div key={i} className={`grid lg:grid-cols-2 gap-10 items-center ${i % 2 === 1 ? 'lg:direction-rtl' : ''}`}>
            <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.desc || feature.description}</p>
            </div>
            <div className={`${i % 2 === 1 ? 'lg:order-1' : ''}`}>
              {feature.image_url ? (
                <img src={feature.image_url} alt={feature.title} className="w-full rounded-2xl shadow-lg object-cover aspect-video" loading="lazy" />
              ) : (
                <div className="w-full aspect-video rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${style.primary_color}10` }}>
                  <span className="text-gray-400">Feature Image</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </section>
    )
  }

  const layout = (props.layout as string) || 'grid-3'
  const colClass = layout === 'grid-2' ? 'grid-cols-1 sm:grid-cols-2' :
    layout === 'grid-4' ? 'grid-cols-2 sm:grid-cols-4' :
    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {title && <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">{title}</h2>}
      <div className={`grid ${colClass} gap-6`}>
        {features.map((feature, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-2xl" style={{ backgroundColor: `${style.primary_color}15` }}>
              {feature.icon === 'Zap' ? '⚡' : feature.icon === 'Shield' ? '🛡️' : feature.icon === 'Star' ? '⭐' : feature.icon === 'Clock' ? '⏱️' : '✨'}
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed">{feature.desc || feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
