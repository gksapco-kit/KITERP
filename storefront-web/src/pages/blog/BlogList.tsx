import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Loader2, Newspaper, ChevronRight, Clock, Calendar, Tag, X } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useBlogPosts } from '@/hooks/useStore'
import { isVendorBlogEnabled } from '@/lib/catalogNavCapabilities'
import type { StoreBlogPost } from '@/api/store'
import { imgUrl } from '@/lib/utils'

function fmtDate(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PostCard({ post, storePath, primaryColor }: {
  post: StoreBlogPost
  storePath: (p: string) => string
  primaryColor: string
}) {
  return (
    <Link
      to={storePath(`/blog/${post.slug}`)}
      className="group block bg-white rounded-2xl border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all overflow-hidden max-h-[90vh] overflow-y-auto"
    >
      {post.cover_url ? (
        <div className="aspect-video overflow-hidden">
          <img
            src={imgUrl(post.cover_url)}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="aspect-video flex items-center justify-center" style={{ backgroundColor: primaryColor + '10' }}>
          <Newspaper className="w-12 h-12" style={{ color: primaryColor + '40' }} />
        </div>
      )}
      <div className="p-5">
        {post.category && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full mb-3 inline-block"
            style={{ backgroundColor: primaryColor + '15', color: primaryColor }}>
            {post.category}
          </span>
        )}
        <h2 className="font-bold text-gray-900 text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-sm text-gray-500 mt-2 line-clamp-3">{post.excerpt}</p>
        )}
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 flex-wrap">
          {post.author_name && <span className="font-medium text-gray-600">{post.author_name}</span>}
          {post.published_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {fmtDate(post.published_at)}
            </span>
          )}
          {post.reading_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {post.reading_minutes} min read
            </span>
          )}
        </div>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {post.tags.slice(0, 4).map(t => (
              <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

export default function BlogList() {
  const { storePath, vendor } = useVendor()
  const theme = useTheme()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useBlogPosts({
    page,
    size: 9,
    category: activeCategory ?? undefined,
    tag: activeTag ?? undefined,
  })

  if (!isVendorBlogEnabled(vendor?.settings)) {
    return <Navigate to={storePath('/')} replace />
  }

  const posts = data?.items ?? []
  const totalPages = data?.pages ?? 1

  // derive categories/tags from current posts (server-driven)
  const allCategories = [...new Set(posts.map(p => p.category).filter(Boolean))] as string[]
  const allTags = [...new Set(posts.flatMap(p => p.tags ?? []))]

  const primaryColor = theme.colors.primary

  const clearFilters = () => { setActiveCategory(null); setActiveTag(null); setPage(1) }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Blog</h1>
        <p className="text-gray-500 mt-1">Tips, updates and stories from our team</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="lg:w-52 shrink-0">
          {allCategories.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Categories</p>
              <div className="space-y-1">
                <button
                  onClick={() => { setActiveCategory(null); setPage(1) }}
                  className={`block w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                    !activeCategory ? 'font-semibold text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  style={!activeCategory ? { backgroundColor: primaryColor } : {}}
                >
                  All
                </button>
                {allCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setActiveCategory(cat); setPage(1) }}
                    className={`block w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors ${
                      activeCategory === cat ? 'font-semibold text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    style={activeCategory === cat ? { backgroundColor: primaryColor } : {}}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {allTags.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => { setActiveTag(activeTag === tag ? null : tag); setPage(1) }}
                    className="text-xs px-2 py-1 rounded-full border transition-colors"
                    style={activeTag === tag
                      ? { backgroundColor: primaryColor, borderColor: primaryColor, color: '#fff' }
                      : { borderColor: '#e5e7eb', color: '#374151' }
                    }
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(activeCategory || activeTag) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 mt-4 text-xs text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
        </aside>

        {/* Posts grid */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
            </div>
          ) : isError ? (
            <div className="text-center py-20 text-gray-400">
              <p>Could not load posts. Please try again later.</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
              <Newspaper className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No posts found</p>
              {(activeCategory || activeTag) && (
                <button onClick={clearFilters} className="mt-2 text-sm underline" style={{ color: primaryColor }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {posts.map(post => (
                  <PostCard key={post.id} post={post} storePath={storePath} primaryColor={primaryColor} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-10">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        page === p ? 'text-white' : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                      style={page === p ? { backgroundColor: primaryColor } : {}}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
