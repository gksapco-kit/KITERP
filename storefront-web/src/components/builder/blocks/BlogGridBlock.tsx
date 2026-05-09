import { useMemo } from 'react'
import { Calendar } from 'lucide-react'
import type { PublicSite, StyleConfig } from '@/blocks/registry'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  branchCode?: string | null
}

/**
 * Blog grid — surfaces every published page whose `page_type === 'blog'`
 * from the current site. Until a dedicated post content type lands, this
 * is the simplest mapping that's actually meaningful (a vendor can mark
 * any page "blog" and it shows up here).
 *
 * Falls back gracefully when there are no blog pages: renders a single
 * "no posts yet" tile so admins immediately see something is wired up.
 */
export default function BlogGridBlock({ site, style, props }: Props) {
  const title = (props.title as string) || 'Latest Posts'
  const cols = Math.min(Math.max(Number(props.columns ?? 3) || 3, 1), 4)

  const posts = useMemo(() => {
    return (site.pages || [])
      .filter(p => p.page_type === 'blog' && p.is_published)
      .sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0))
      .map(p => ({
        id: p.id,
        title: p.title,
        excerpt: p.seo_description || '',
        url: p.is_homepage ? '/' : `/${p.slug}`,
        image_url: p.og_image_url || null,
      }))
  }, [site.pages])

  if (posts.length === 0) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center" aria-label={title}>
        <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ fontFamily: style.font_heading, color: style.text_color }}>
          {title}
        </h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Once you mark a page as <strong>page type "blog"</strong> in the editor, it will show up here.
        </p>
      </section>
    )
  }

  const colClass: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto" aria-label={title}>
      <h2
        className="text-2xl sm:text-3xl font-bold mb-8 text-center"
        style={{ fontFamily: style.font_heading, color: style.text_color }}
      >
        {title}
      </h2>

      <div className={`grid grid-cols-1 ${colClass[cols] || colClass[3]} gap-6`}>
        {posts.map(p => (
          <article
            key={p.id}
            className="group rounded-2xl border border-gray-200 hover:border-gray-300 overflow-hidden bg-white transition-shadow hover:shadow-md"
          >
            <a href={p.url} className="flex flex-col h-full">
              <div className="aspect-[16/9] overflow-hidden bg-gray-100">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <Calendar className="w-10 h-10" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-lg font-semibold mb-2 line-clamp-2" style={{ color: style.text_color }}>
                  {p.title}
                </h3>
                {p.excerpt && (
                  <p className="text-sm text-gray-500 line-clamp-3 mb-4 flex-1">{p.excerpt}</p>
                )}
                <span
                  className="text-xs font-semibold inline-flex items-center gap-1 mt-auto"
                  style={{ color: style.primary_color }}
                >
                  Read more →
                </span>
              </div>
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}
