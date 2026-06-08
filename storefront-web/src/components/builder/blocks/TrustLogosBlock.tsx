import { Award } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null }

export default function TrustLogosBlock({ style, props, liveItems }: Props) {
  const title = (props.title as string) || 'Trusted by'
  const logos = liveItems.filter(i => i.image_url)
  if (logos.length === 0) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title={title}
        message="Partner and trust logos will show here. Upload logo images in the Media panel or connect this section to your media library."
        icon={<Award className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }
  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {title && <p className="text-center text-sm font-semibold text-gray-400 uppercase tracking-widest mb-8">{title}</p>}
      <div className="flex flex-wrap justify-center gap-8 items-center">
        {logos.map(logo => (
          <img key={logo.id} src={logo.image_url as string} alt={logo.title} className="h-10 w-auto grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all object-contain" loading="lazy" />
        ))}
      </div>
    </section>
  )
}
