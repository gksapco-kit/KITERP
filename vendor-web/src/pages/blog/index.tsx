import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Plus, Search, Pencil, Trash2, Eye, EyeOff, Loader2,
  Newspaper, Tag, Clock, Calendar, X, Image as ImageIcon,
  ChevronLeft, BookOpen, Save, Upload, Send, Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, mediaUrl } from '@/lib/utils'
import { vendorApi } from '@/api/vendor'
import {
  useBlogPosts, useCreateBlogPost, useUpdateBlogPost,
  useDeleteBlogPost, usePublishBlogPost,
} from '@/hooks/useBlog'
import type { BlogPost, BlogPostCreate, BlogPostUpdate } from '@/api/blog'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function wordCount(text?: string | null) {
  if (!text) return 0
  return text.trim().split(/\s+/).length
}

function estimateReadingMinutes(content?: string | null) {
  return Math.max(1, Math.round(wordCount(content) / 200))
}

// ── Blog post editor ──────────────────────────────────────────────────────────

interface EditorProps {
  initial?: BlogPost
  onSave: (data: BlogPostCreate | BlogPostUpdate) => void
  onCancel: () => void
  saving: boolean
}

function BlogEditor({ initial, onSave, onCancel, saving }: EditorProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [coverUrl, setCoverUrl] = useState(initial?.cover_url ?? '')
  const [authorName, setAuthorName] = useState(initial?.author_name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(', '))
  const [isPublished, setIsPublished] = useState(initial?.is_published ?? false)
  const [coverUploading, setCoverUploading] = useState(false)
  const coverFileRef = useRef<HTMLInputElement>(null)

  const autoSlug = useCallback((t: string) =>
    t.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').slice(0, 180)
  , [])

  const handleTitleChange = (v: string) => {
    setTitle(v)
    if (!initial) setSlug(autoSlug(v))
  }

  const readingMins = estimateReadingMinutes(content)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { toast.error('Title is required'); return }
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
    onSave({
      title: title.trim(),
      slug: slug.trim() || autoSlug(title),
      excerpt: excerpt.trim() || undefined,
      content: content.trim() || undefined,
      cover_url: coverUrl.trim() || undefined,
      author_name: authorName.trim() || undefined,
      category: category.trim() || undefined,
      tags,
      reading_minutes: readingMins,
      is_published: isPublished,
    })
  }

  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (JPEG, PNG, WebP, or GIF)')
      return
    }
    setCoverUploading(true)
    try {
      const { cover_url } = await vendorApi.uploadBlogCover(file)
      setCoverUrl(cover_url)
      toast.success('Cover image uploaded')
    } catch {
      toast.error('Upload failed — try again or paste an image URL')
    } finally {
      setCoverUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-white shrink-0">
        <button type="button" onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <h2 className="text-sm font-semibold text-gray-800 flex-1">
          {initial ? 'Edit Post' : 'New Post'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPublished(p => !p)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
              isPublished
                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            )}
          >
            {isPublished ? <><Eye className="w-3.5 h-3.5" /> Published</> : <><EyeOff className="w-3.5 h-3.5" /> Draft</>}
          </button>
          <Button type="submit" size="sm" disabled={saving} className="gap-1.5 text-xs bg-primary hover:bg-primary/90 text-white">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Post Title *</label>
            <input
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Your compelling blog title…"
              className="w-full text-xl font-bold border-0 border-b-2 border-gray-200 focus:border-primary outline-none py-2 bg-transparent placeholder:text-gray-300"
              required
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Excerpt / Summary</label>
            <textarea
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              placeholder="A short description shown in blog listings…"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600">Content (Markdown or plain text)</label>
              <span className="text-[10px] text-gray-400">~{readingMins} min read · {wordCount(content)} words</span>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={`Write your blog post here.\n\nYou can use Markdown:\n## Heading\n**bold**, *italic*, [link](url)\n- bullet list`}
              rows={18}
              className="w-full text-sm font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-64 shrink-0 border-l bg-gray-50 overflow-y-auto p-4 space-y-5">
          {/* Cover image */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Cover image</label>
            <input
              ref={coverFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleCoverFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={coverUploading || saving}
              className="w-full gap-1.5 text-xs mb-2 h-8 border-primary/30 text-primary hover:bg-accent"
              onClick={() => coverFileRef.current?.click()}
            >
              {coverUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {coverUploading ? 'Uploading…' : 'Upload image'}
            </Button>
            <p className="text-[10px] text-gray-400 mb-1.5">Or paste a URL</p>
            <div className="relative">
              <ImageIcon className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                value={coverUrl}
                onChange={e => setCoverUrl(e.target.value)}
                placeholder="https://…"
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {coverUrl && (
              <img
                src={mediaUrl(coverUrl)}
                alt=""
                className="mt-2 rounded-lg w-full h-28 object-cover border border-gray-100"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            )}
          </div>

          {/* Slug */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">URL Slug</label>
            <input
              value={slug}
              onChange={e => setSlug(e.target.value)}
              placeholder="my-post-slug"
              className="w-full py-1.5 px-2.5 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Author */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Author Name</label>
            <input
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              placeholder="Your Name"
              className="w-full py-1.5 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Category</label>
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Product, News"
              className="w-full py-1.5 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Tags (comma-separated)</label>
            <input
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
              placeholder="tips, guide, product"
              className="w-full py-1.5 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {tagsRaw && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {tagsRaw.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                  <span key={t} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Status info */}
          {initial && (
            <div className="text-[10px] text-gray-400 space-y-1 border-t pt-3">
              <div>Created: {fmtDate(initial.created_at)}</div>
              {initial.published_at && <div>Published: {fmtDate(initial.published_at)}</div>}
            </div>
          )}
        </div>
      </div>
    </form>
  )
}

// ── Blog post list ────────────────────────────────────────────────────────────

export default function BlogManagerPage() {
  const [search, setSearch] = useState('')
  const [filterPublished, setFilterPublished] = useState<boolean | undefined>(undefined)
  const [editingPost, setEditingPost] = useState<BlogPost | null | 'new'>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const { data, isLoading } = useBlogPosts({ search: search || undefined, is_published: filterPublished })
  const createMutation = useCreateBlogPost()
  const updateMutation = useUpdateBlogPost()
  const deleteMutation = useDeleteBlogPost()
  const publishMutation = usePublishBlogPost()

  const handleSave = (formData: BlogPostCreate | BlogPostUpdate) => {
    if (editingPost === 'new') {
      createMutation.mutate(formData as BlogPostCreate, { onSuccess: () => setEditingPost(null) })
    } else if (editingPost) {
      updateMutation.mutate({ id: editingPost.id, data: formData as BlogPostUpdate }, { onSuccess: () => setEditingPost(null) })
    }
  }

  if (editingPost) {
    return (
      <div className="h-screen flex flex-col bg-white">
        <BlogEditor
          initial={editingPost === 'new' ? undefined : editingPost}
          onSave={handleSave}
          onCancel={() => setEditingPost(null)}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      </div>
    )
  }

  const posts = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Blog Manager</h1>
            <p className="text-sm text-gray-500">{total} post{total !== 1 ? 's' : ''} total</p>
          </div>
        </div>
        <Button
          onClick={() => setEditingPost('new')}
          className="sm:ml-auto gap-2 bg-primary hover:bg-primary/90 text-white"
        >
          <Plus className="w-4 h-4" /> New Post
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search posts…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-2.5">
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {([undefined, false, true] as const).map((val) => (
            <button
              key={String(val)}
              onClick={() => setFilterPublished(val)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                filterPublished === val
                  ? 'bg-primary text-white border-primary'
                  : 'text-gray-600 border-gray-200 hover:bg-gray-50'
              )}
            >
              {val === undefined ? 'All' : val ? 'Published' : 'Drafts'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary/70" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-gray-500 font-medium">No posts yet</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">Create your first blog post to engage your customers</p>
          <Button onClick={() => setEditingPost('new')} size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white">
            <Plus className="w-4 h-4" /> Create Post
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => {
            const publishBusy =
              publishMutation.isPending && publishMutation.variables?.id === post.id
            return (
            <div
              key={post.id}
              className="flex gap-4 bg-white rounded-2xl border border-gray-100 hover:border-primary/30 hover:shadow-sm transition-all p-4"
            >
              {/* Cover thumbnail */}
              {post.cover_url ? (
                <img src={mediaUrl(post.cover_url)} alt="" className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                  <Newspaper className="w-8 h-8 text-gray-300" />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-gray-900 flex-1 min-w-0 line-clamp-1">{post.title}</h3>
                  <span className={cn('shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full',
                    post.is_published ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  )}>
                    {post.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                {post.excerpt && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{post.excerpt}</p>
                )}
                <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] text-gray-400">
                  {post.category && (
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />{post.category}
                    </span>
                  )}
                  {post.reading_minutes && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />{post.reading_minutes} min
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {post.is_published ? fmtDate(post.published_at) : `Updated ${fmtDate(post.updated_at)}`}
                  </span>
                  {post.tags.length > 0 && (
                    <span className="flex items-center gap-1 flex-wrap">
                      {post.tags.slice(0, 3).map(t => (
                        <span key={t} className="bg-gray-100 px-1.5 py-0.5 rounded-full">{t}</span>
                      ))}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions — explicit publish labels (icon-only EyeOff read as “hidden”, not publish). */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                {post.is_published ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={publishBusy}
                    title="Remove post from your public blog"
                    className="h-8 gap-1.5 text-xs font-semibold border-amber-200 text-amber-800 hover:bg-amber-50"
                    onClick={() => publishMutation.mutate({ id: post.id, publish: false })}
                  >
                    {publishBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Undo2 className="w-3.5 h-3.5" />
                    )}
                    Unpublish
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={publishBusy}
                    title="Make this post visible on your business front blog"
                    className="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => publishMutation.mutate({ id: post.id, publish: true })}
                  >
                    {publishBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Publish
                  </Button>
                )}
                <button
                  onClick={() => setEditingPost(post)}
                  className="p-2 rounded-lg text-gray-400 hover:bg-accent hover:text-primary transition-colors"
                  title="Edit post"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {deleteConfirmId === post.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { deleteMutation.mutate(post.id); setDeleteConfirmId(null) }}
                      className="px-2 py-1 text-[10px] font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Confirm
                    </button>
                    <button onClick={() => setDeleteConfirmId(null)} className="p-1 text-gray-400 hover:text-gray-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(post.id)}
                    className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Delete post"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
