import { Link, useParams } from 'react-router-dom'
import {
  ChevronLeft, Loader2, Clock, Calendar, Tag,
  Newspaper, AlertCircle,
} from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useBlogPost, useBlogPosts } from '@/hooks/useStore'
import { imgUrl } from '@/lib/utils'
import type { StoreBlogPost } from '@/api/store'

function fmtDate(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

/** Very lightweight Markdown renderer — covers headings, bold, italic, links, lists, code, blockquote */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let listBuffer: string[] = []

  const flushList = () => {
    if (listBuffer.length === 0) return
    nodes.push(
      <ul key={nodes.length} className="list-disc list-inside space-y-1 my-3 text-gray-700">
        {listBuffer.map((item, i) => <li key={i} className="text-base leading-relaxed">{inlineFormat(item)}</li>)}
      </ul>
    )
    listBuffer = []
  }

  const inlineFormat = (str: string): React.ReactNode => {
    // Build a simple rich text from the string
    const segments = str.split(/((?:\*\*\*.+?\*\*\*|\*\*.+?\*\*|\*.+?\*|`.+?`|\[.+?\]\(.+?\)))/)
    return (
      <>
        {segments.map((seg, i) => {
          if (seg.match(/^\*\*\*(.+?)\*\*\*$/)) return <strong key={i}><em>{seg.slice(3, -3)}</em></strong>
          if (seg.match(/^\*\*(.+?)\*\*$/)) return <strong key={i}>{seg.slice(2, -2)}</strong>
          if (seg.match(/^\*(.+?)\*$/)) return <em key={i}>{seg.slice(1, -1)}</em>
          if (seg.match(/^`(.+?)`$/)) return <code key={i} className="bg-gray-100 text-primary px-1 py-0.5 rounded text-[0.85em]">{seg.slice(1, -1)}</code>
          const linkMatch = seg.match(/^\[(.+?)\]\((.+?)\)$/)
          if (linkMatch) return <a key={i} href={linkMatch[2]} className="text-primary underline hover:text-primary" target="_blank" rel="noopener noreferrer">{linkMatch[1]}</a>
          return seg
        })}
      </>
    )
  }

  lines.forEach((line, i) => {
    if (line.startsWith('# '))  { flushList(); nodes.push(<h1 key={i} className="text-3xl font-bold text-gray-900 mt-6 mb-3">{inlineFormat(line.slice(2))}</h1>); return }
    if (line.startsWith('## ')) { flushList(); nodes.push(<h2 key={i} className="text-2xl font-bold text-gray-900 mt-5 mb-2">{inlineFormat(line.slice(3))}</h2>); return }
    if (line.startsWith('### ')){ flushList(); nodes.push(<h3 key={i} className="text-xl font-bold text-gray-800 mt-4 mb-2">{inlineFormat(line.slice(4))}</h3>); return }
    if (line.startsWith('#### ')){ flushList(); nodes.push(<h4 key={i} className="text-lg font-semibold text-gray-800 mt-3 mb-1">{inlineFormat(line.slice(5))}</h4>); return }
    if (line.startsWith('> '))  { flushList(); nodes.push(<blockquote key={i} className="border-l-4 border-primary/40 pl-4 my-3 italic text-gray-600">{inlineFormat(line.slice(2))}</blockquote>); return }
    if (line.startsWith('- ') || line.startsWith('* ')) { listBuffer.push(line.slice(2)); return }
    if (/^\d+\. /.test(line)) { listBuffer.push(line.replace(/^\d+\. /, '')); return }
    if (line.startsWith('```')) { flushList(); return } // skip code fence markers (naive)
    if (line.trim() === '')   { flushList(); nodes.push(<div key={i} className="h-3" />); return }
    flushList()
    nodes.push(<p key={i} className="text-base text-gray-700 leading-relaxed">{inlineFormat(line)}</p>)
  })
  flushList()
  return nodes
}

function RelatedCard({ post, storePath, primaryColor }: {
  post: StoreBlogPost
  storePath: (p: string) => string
  primaryColor: string
}) {
  return (
    <Link
      to={storePath(`/blog/${post.slug}`)}
      className="group flex gap-3 items-start p-3 rounded-xl border border-gray-100 hover:border-primary/30 hover:shadow-sm transition-all"
    >
      {post.cover_url ? (
        <img src={imgUrl(post.cover_url)} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: primaryColor + '10' }}>
          <Newspaper className="w-7 h-7" style={{ color: primaryColor + '40' }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-primary transition-colors">{post.title}</p>
        {post.published_at && (
          <p className="text-xs text-gray-400 mt-1">{fmtDate(post.published_at)}</p>
        )}
      </div>
    </Link>
  )
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const { storePath } = useVendor()
  const theme = useTheme()
  const primaryColor = theme.colors.primary

  const { data: post, isLoading, isError } = useBlogPost(slug ?? '')
  const { data: relatedData } = useBlogPosts({ size: 4 })
  const related = (relatedData?.items ?? []).filter(p => p.slug !== slug).slice(0, 3)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: primaryColor }} />
      </div>
    )
  }

  if (isError || !post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700">Post not found</h2>
        <p className="text-gray-400 mt-2 mb-6">This post may have been removed or isn't published yet.</p>
        <Link
          to={storePath('/blog')}
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: primaryColor }}
        >
          <ChevronLeft className="w-4 h-4" /> Back to Blog
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid lg:grid-cols-[1fr_280px] gap-10">
        {/* Article */}
        <article>
          {/* Back */}
          <Link
            to={storePath('/blog')}
            className="inline-flex items-center gap-1.5 text-sm font-medium mb-6 hover:underline"
            style={{ color: primaryColor }}
          >
            <ChevronLeft className="w-4 h-4" /> All Posts
          </Link>

          {/* Category */}
          {post.category && (
            <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-4"
              style={{ backgroundColor: primaryColor + '15', color: primaryColor }}>
              {post.category}
            </span>
          )}

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">{post.title}</h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-500">
            {post.author_name && (
              <div className="flex items-center gap-2">
                {post.author_avatar_url ? (
                  <img src={imgUrl(post.author_avatar_url)} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: primaryColor }}>
                    {post.author_name[0].toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-gray-700">{post.author_name}</span>
              </div>
            )}
            {post.published_at && (
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {fmtDate(post.published_at)}</span>
            )}
            {post.reading_minutes && (
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {post.reading_minutes} min read</span>
            )}
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {post.tags.map(t => (
                <span key={t} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                  <Tag className="w-3 h-3" /> {t}
                </span>
              ))}
            </div>
          )}

          {/* Cover */}
          {post.cover_url && (
            <div className="mt-6 rounded-2xl overflow-hidden aspect-video">
              <img src={imgUrl(post.cover_url)} alt={post.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Excerpt */}
          {post.excerpt && (
            <p className="mt-6 text-lg text-gray-500 italic border-l-4 pl-4 leading-relaxed" style={{ borderColor: primaryColor + '40' }}>
              {post.excerpt}
            </p>
          )}

          {/* Content */}
          {post.content ? (
            <div className="mt-6 prose-like">
              {renderMarkdown(post.content)}
            </div>
          ) : (
            <p className="mt-6 text-gray-400 italic">No content available for this post.</p>
          )}
        </article>

        {/* Sidebar */}
        {related.length > 0 && (
          <aside>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">More Posts</h3>
            <div className="space-y-3">
              {related.map(r => (
                <RelatedCard key={r.id} post={r} storePath={storePath} primaryColor={primaryColor} />
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
