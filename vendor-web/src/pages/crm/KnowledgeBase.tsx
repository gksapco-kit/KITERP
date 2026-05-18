import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useKbArticles, useSaveKb } from '@/hooks/useCrm'
import { Plus, Loader2, BookOpen, Eye, ThumbsUp, Edit3 } from 'lucide-react'
import { CrmModal, Field, SearchBar, Pager, LoadingRow, EmptyRow } from './_shared'
import { formatDate } from '@/lib/utils'
import type { KbArticle } from '@/api/crm'

function KbForm({ article, onClose }: { article?: KbArticle; onClose: () => void }) {
  const save = useSaveKb()
  const [form, setForm] = useState({
    title: article?.title || '',
    slug: article?.slug || '',
    body: article?.body || '',
    summary: article?.summary || '',
    status: article?.status || 'draft',
    tags: article?.tags?.join(', ') || '',
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    save.mutate(
      {
        id: article?.id,
        data: {
          title: form.title,
          slug: form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
          body: form.body || undefined,
          summary: form.summary || undefined,
          status: form.status,
          tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        },
      },
      { onSuccess: onClose },
    )
  }
  return (
    <CrmModal title={article ? 'Edit article' : 'New article'} onClose={onClose} maxW="max-w-2xl">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title" required><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Slug"><Input value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} placeholder="auto from title" /></Field>
          <Field label="Status">
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
        </div>
        <Field label="Summary"><Input value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} /></Field>
        <Field label="Body (Markdown)">
          <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
            className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
        </Field>
        <Field label="Tags (comma separated)"><Input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} /></Field>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </form>
    </CrmModal>
  )
}

export default function KnowledgeBasePage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [edit, setEdit] = useState<KbArticle | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading } = useKbArticles({ page, size: 20, q: search || undefined })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New article
        </Button>
      </div>

      <SearchBar value={searchInput} onChange={setSearchInput}
        onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }}
        placeholder="Search articles…" />

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Article</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Views</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Helpful</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase hidden xl:table-cell">Updated</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? <LoadingRow cols={6} /> : !data?.items?.length ? (
                <EmptyRow cols={6} message="No articles yet" action={
                  <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
                    <BookOpen className="w-4 h-4 mr-1" /> Write your first article
                  </Button>
                } />
              ) : data.items.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.summary && <p className="text-xs text-gray-500 line-clamp-1">{a.summary}</p>}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <Badge variant={a.status === 'published' ? 'success' : a.status === 'archived' ? 'secondary' : 'soft'}>{a.status}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm hidden lg:table-cell">
                    <span className="flex items-center gap-1 text-gray-600"><Eye className="w-3 h-3" /> {a.view_count}</span>
                  </td>
                  <td className="px-6 py-4 text-sm hidden lg:table-cell">
                    <span className="flex items-center gap-1 text-gray-600"><ThumbsUp className="w-3 h-3" /> {a.helpful_count}</span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 hidden xl:table-cell">{formatDate(a.updated_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEdit(a)}>
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pages={data?.pages || 0} total={data?.total || 0} onPage={setPage} />
        </CardContent>
      </Card>

      {showCreate && <KbForm onClose={() => setShowCreate(false)} />}
      {edit && <KbForm article={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}
