import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Plus, Search, Pencil, Trash2, Eye, EyeOff, Loader2,
  Newspaper, Tag, Clock, Calendar, X, Image as ImageIcon,
  ChevronLeft, BookOpen, Save, Upload, Send, Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn, mediaUrl } from '@/lib/utils'
import { ImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { SingleImagePreview } from '@/components/common/CatalogMediaLightbox'
import { vendorApi } from '@/api/vendor'
import {
  useBlogPosts, useCreateBlogPost, useUpdateBlogPost,
  useDeleteBlogPost, usePublishBlogPost, useBlogSettings, useUpdateBlogSettings,
} from '@/hooks/useBlog'
import type { BlogPost, BlogPostCreate, BlogPostUpdate } from '@/api/blog'

// ── shared dark-mode chrome ───────────────────────────────────────────────────

const blogLabelClass = 'text-xs font-medium text-muted-foreground block mb-1'
const blogLabelClassSpaced = 'text-xs font-medium text-muted-foreground block mb-1.5'

const blogInputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]'

const blogInputCompactClass =
  'w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]'

const blogSearchClass =
  'h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring [color-scheme:dark]'

const blogFilterActiveClass = 'border-primary bg-primary text-primary-foreground'
const blogFilterInactiveClass =
  'border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'

const blogStatusPublishedClass = 'bg-green-500/15 text-green-700 dark:text-green-300'
const blogStatusDraftClass = 'bg-amber-500/15 text-amber-700 dark:text-amber-300'

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

  const uploadCoverFile = async (file: File) => {
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
      toast.error('Upload failed — try again or pick another image')
    } finally {
      setCoverUploading(false)
    }
  }

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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-5 py-3 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="flex-1 text-sm font-semibold text-foreground">
          {initial ? 'Edit Post' : 'New Post'}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPublished(p => !p)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              isPublished
                ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
                : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted',
            )}
          >
            {isPublished ? <><Eye className="w-3.5 h-3.5" /> Published</> : <><EyeOff className="w-3.5 h-3.5" /> Draft</>}
          </button>
          <Button type="submit" size="sm" disabled={saving} className="gap-1.5 text-xs">
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
            <label className={blogLabelClass}>Post Title *</label>
            <input
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Your compelling blog title…"
              className="w-full border-0 border-b-2 border-border bg-transparent py-2 text-xl font-bold text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary"
              required
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className={blogLabelClass}>Excerpt / Summary</label>
            <textarea
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              placeholder="A short description shown in blog listings…"
              rows={2}
              className={cn(blogInputClass, 'resize-none')}
            />
          </div>

          {/* Content */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className={blogLabelClass}>Content (Markdown or plain text)</label>
              <span className="text-xs text-muted-foreground">~{readingMins} min read · {wordCount(content)} words</span>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={`Write your blog post here.\n\nYou can use Markdown:\n## Heading\n**bold**, *italic*, [link](url)\n- bullet list`}
              rows={18}
              className={cn(blogInputClass, 'resize-none font-mono leading-relaxed')}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-64 shrink-0 overflow-y-auto border-l border-border bg-muted/30 p-4 space-y-5">
          {/* Cover image */}
          <div>
            <label className={blogLabelClassSpaced}>Cover image</label>
            <ImageSourcePicker
              title="Cover image"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={saving}
              uploading={coverUploading}
              onFile={uploadCoverFile}
              onUrl={(url) => setCoverUrl(url)}
              buttonClassName="mb-2 h-8 w-full border-primary/30 text-xs text-primary hover:bg-accent"
            />
            {coverUrl && (
              <SingleImagePreview
                url={coverUrl}
                alt="Cover image"
                resolveUrl={mediaUrl}
                className="mt-2 w-full rounded-lg"
                imgClassName="h-28 w-full rounded-lg border border-border object-cover"
                editable
                onSave={uploadCoverFile}
              />
            )}
          </div>

          {/* Slug */}
          <div>
            <label className={blogLabelClassSpaced}>URL Slug</label>
            <input
              value={slug}
              onChange={e => setSlug(e.target.value)}
              placeholder="my-post-slug"
              className={cn(blogInputCompactClass, 'font-mono')}
            />
          </div>

          {/* Author */}
          <div>
            <label className={blogLabelClassSpaced}>Author Name</label>
            <input
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              placeholder="Your Name"
              className={blogInputCompactClass}
            />
          </div>

          {/* Category */}
          <div>
            <label className={blogLabelClassSpaced}>Category</label>
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Product, News"
              className={blogInputCompactClass}
            />
          </div>

          {/* Tags */}
          <div>
            <label className={blogLabelClassSpaced}>Tags (comma-separated)</label>
            <input
              value={tagsRaw}
              onChange={e => setTagsRaw(e.target.value)}
              placeholder="tips, guide, product"
              className={blogInputCompactClass}
            />
            {tagsRaw && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {tagsRaw.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                  <span key={t} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Status info */}
          {initial && (
            <div className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
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
  const { data: blogSettings, isLoading: settingsLoading } = useBlogSettings()
  const updateSettingsMutation = useUpdateBlogSettings()
  const blogEnabled = blogSettings?.blog_enabled ?? true

  const handleSave = (formData: BlogPostCreate | BlogPostUpdate) => {
    if (editingPost === 'new') {
      createMutation.mutate(formData as BlogPostCreate, { onSuccess: () => setEditingPost(null) })
    } else if (editingPost) {
      updateMutation.mutate({ id: editingPost.id, data: formData as BlogPostUpdate }, { onSuccess: () => setEditingPost(null) })
    }
  }

  if (editingPost) {
    return (
      <div className="flex h-screen flex-col bg-background">
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
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Newspaper className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Blog Manager</h1>
              <p className="text-sm text-muted-foreground">{total} post{total !== 1 ? 's' : ''} total</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:ml-auto">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
              <div className="min-w-0">
                <Label htmlFor="blog-enabled" className="text-sm font-medium text-foreground cursor-pointer">
                  Show on website
                </Label>
                <p className="text-xs text-muted-foreground">
                  {blogEnabled ? 'Blog page and nav link are visible' : 'Blog is hidden from your storefront'}
                </p>
              </div>
              <Switch
                id="blog-enabled"
                checked={blogEnabled}
                disabled={settingsLoading || updateSettingsMutation.isPending}
                onCheckedChange={(checked) => updateSettingsMutation.mutate({ blog_enabled: checked })}
              />
            </div>
            <Button
              onClick={() => setEditingPost('new')}
              className="gap-2"
            >
              <Plus className="w-4 h-4" /> New Post
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search posts…"
            className={blogSearchClass}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {([undefined, false, true] as const).map((val) => (
            <button
              key={String(val)}
              onClick={() => setFilterPublished(val)}
              className={cn(
                'h-10 rounded-lg border px-3 text-sm font-medium transition-colors',
                filterPublished === val ? blogFilterActiveClass : blogFilterInactiveClass,
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
          <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border py-20 text-center">
          <BookOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground/40" />
          <h3 className="font-medium text-muted-foreground">No posts yet</h3>
          <p className="mt-1 mb-4 text-sm text-muted-foreground/80">Create your first blog post to engage your customers</p>
          <Button onClick={() => setEditingPost('new')} size="sm" className="gap-2">
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
              className="flex max-h-[90vh] gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
            >
              {/* Cover thumbnail */}
              {post.cover_url ? (
                <img src={mediaUrl(post.cover_url)} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-24 sm:w-24" />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-muted sm:h-24 sm:w-24">
                  <Newspaper className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start gap-2">
                  <h3 className="line-clamp-1 min-w-0 flex-1 text-sm font-semibold text-foreground">{post.title}</h3>
                  <span className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-bold',
                    post.is_published ? blogStatusPublishedClass : blogStatusDraftClass,
                  )}>
                    {post.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                {post.excerpt && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.excerpt}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {post.category && (
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />{post.category}
                    </span>
                  )}
                  {post.reading_minutes && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />{post.reading_minutes} min
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {post.is_published ? fmtDate(post.published_at) : `Updated ${fmtDate(post.updated_at)}`}
                  </span>
                  {post.tags.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1">
                      {post.tags.slice(0, 3).map(t => (
                        <span key={t} className="rounded-full bg-muted px-1.5 py-0.5">{t}</span>
                      ))}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions — explicit publish labels (icon-only EyeOff read as “hidden”, not publish). */}
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {post.is_published ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={publishBusy}
                    title="Remove post from your public blog"
                    className="h-8 gap-1.5 border-amber-500/30 text-xs font-medium text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
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
                    className="h-8 gap-1.5 text-xs font-medium"
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
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                  title="Edit post"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {deleteConfirmId === post.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { deleteMutation.mutate(post.id); setDeleteConfirmId(null) }}
                      className="rounded-lg bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(post.id)}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Delete post"
                  >
                    <Trash2 className="h-4 w-4" />
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
