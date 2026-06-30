import { useMemo } from 'react'
import { Calendar, Clock, Newspaper } from 'lucide-react'
import type { LiveItem, StyleConfig } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { useVendor } from '@/contexts/VendorContext'
import {
  CATALOG_GRID_COL_CLASS,
  readCatalogCardLayout,
} from '@/lib/catalogCardLayout'
import { cn, imgUrl } from '@/lib/utils'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'

interface Props {
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
  blockType?: string
}

interface BlogPostItem {
  id: string
  title: string
  excerpt: string
  url: string
  image_url: string | null
  date: string
  category: string
  readingMinutes: number | null
  isDraft: boolean
}

function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function liveItemToBlogPost(item: LiveItem, storePath: (path: string) => string): BlogPostItem | null {
  const title = String(item.title ?? '').trim()
  if (!title) return null
  const slug = String(item.meta?.slug ?? '').trim()
  const rawUrl = String(item.url ?? '').trim()
  const url = rawUrl
    ? (rawUrl.startsWith('/') ? storePath(rawUrl) : rawUrl)
    : (slug ? storePath(`/blog/${slug}`) : '#')
  const publishedAt = typeof item.meta?.published_at === 'string' ? item.meta.published_at : null
  const readingRaw = item.meta?.reading_minutes
  const readingMinutes = typeof readingRaw === 'number' ? readingRaw : null

  return {
    id: String(item.id ?? title),
    title,
    excerpt: String(item.description ?? '').trim(),
    url,
    image_url: item.image_url ? String(item.image_url) : null,
    date: fmtDate(publishedAt),
    category: String(item.meta?.category ?? item.subtitle ?? '').trim(),
    readingMinutes,
    isDraft: item.meta?.is_published === false,
  }
}

function BlogPostCard({
  post,
  style,
  isList,
  isEditor,
  compact,
}: {
  post: BlogPostItem
  style: StyleConfig
  isList: boolean
  isEditor: boolean
  compact: boolean
}) {
  const primary = style.primary_color || '#6366f1'
  const textColor = style.text_color || '#111827'

  const media = (
    <div
      className={cn(
        'blog-grid-card__media relative shrink-0 overflow-hidden bg-gray-100',
        isList
          ? 'w-full aspect-[16/9] sm:aspect-auto sm:w-52 md:w-60 sm:min-h-[168px]'
          : 'w-full',
      )}
    >
      <div className={cn('relative w-full overflow-hidden', isList ? 'h-full min-h-[168px] sm:absolute sm:inset-0' : 'aspect-[16/9]')}>
        {post.image_url ? (
          <img
            src={imgUrl(post.image_url)}
            alt={post.title}
            loading="lazy"
            className="absolute inset-0 block h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: `${primary}14` }}
          >
            <Newspaper className="h-10 w-10 opacity-40" style={{ color: primary }} />
          </div>
        )}
      </div>
      {isEditor && post.isDraft && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
          Draft
        </span>
      )}
    </div>
  )

  const body = (
    <div className={cn('flex min-w-0 flex-1 flex-col p-5', isList && 'sm:justify-center')}>
      {post.category && !compact && (
        <span
          className="mb-3 inline-block self-start rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: `${primary}18`, color: primary }}
        >
          {post.category}
        </span>
      )}

      <h3
        className={cn(
          'font-semibold leading-snug line-clamp-2 transition-colors group-hover:opacity-90',
          compact ? 'text-sm' : 'text-base sm:text-lg',
        )}
        style={{ color: textColor, fontFamily: style.font_heading }}
      >
        {post.title}
      </h3>

      {post.excerpt && !compact && (
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-gray-500">
          {post.excerpt}
        </p>
      )}

      {(post.date || post.readingMinutes) && !compact && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
          {post.date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {post.date}
            </span>
          )}
          {post.readingMinutes != null && post.readingMinutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {post.readingMinutes} min read
            </span>
          )}
        </div>
      )}
    </div>
  )

  return (
    <article
      className={cn(
        'blog-grid-card group h-full overflow-hidden bg-white',
        isList && 'sm:flex sm:min-h-[168px]',
      )}
    >
      <a
        href={post.url}
        className={cn(
          'flex h-full min-h-0 flex-col',
          isList && 'sm:flex-1 sm:flex-row sm:items-stretch',
        )}
      >
        {media}
        {body}
      </a>
    </article>
  )
}

/**
 * Blog grid — editorial cards synced from Blog Manager (matches /blog listing style).
 */
export default function BlogGridBlock({ style, props, liveItems, blockId, blockType }: Props) {
  const { storePath } = useVendor()
  const builderCanvas = useBuilderCanvas()
  const isEditor = builderCanvas?.isEditorCanvas && !!blockId
  const title = resolveBlockTextField(props, 'title')
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditor)
  const layout = blockType === 'blog_list' ? 'list' : String(props.layout ?? 'grid')
  const isList = layout === 'list'

  const cardLayout = readCatalogCardLayout(props, 'blog_grid', { defaultColumns: 3 })
  const columns = cardLayout.columns
  const itemGap = cardLayout.itemGap
  const compact = cardLayout.isMinimalCard || cardLayout.isCompactCard

  const posts = useMemo(
    () => (liveItems || [])
      .map(item => liveItemToBlogPost(item, storePath))
      .filter((post): post is BlogPostItem => post != null),
    [liveItems, storePath],
  )

  if (posts.length === 0) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title={title ?? undefined}
        message={isEditor
          ? 'Posts from Blog Manager will appear here once you publish them.'
          : 'No blog posts to show yet.'}
        hint={isEditor ? 'Open Website Management → Blog Manager to create and publish posts.' : undefined}
        icon={<Newspaper className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }

  return (
    <section className="blog-grid-section py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto" aria-label={title ?? undefined}>
      {showTitle && (
        <BuilderTextField
          fieldKey="title"
          blockId={blockId}
          blockProps={props}
          value={title ?? ''}
          as="h2"
          className="mb-10 text-center text-2xl font-bold sm:text-3xl"
          style={{ fontFamily: style.font_heading, color: style.text_color }}
          placeholder="Section title"
        />
      )}

      <div
        className={cn(
          'grid items-stretch',
          isList ? 'grid-cols-1' : (CATALOG_GRID_COL_CLASS[columns] || CATALOG_GRID_COL_CLASS[3]),
        )}
        style={{ gap: `${itemGap}px` }}
      >
        {posts.map(post => (
          <BlogPostCard
            key={post.id}
            post={post}
            style={style}
            isList={isList}
            isEditor={isEditor}
            compact={compact}
          />
        ))}
      </div>
    </section>
  )
}
