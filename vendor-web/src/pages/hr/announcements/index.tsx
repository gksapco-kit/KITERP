import { onModalBackdropClick } from '@/lib/utils'
import { useState } from 'react'
import { Megaphone, Plus, Pencil, Trash2, X, Pin } from 'lucide-react'
import {
  useHRAnnouncements, useCreateAnnouncement, useUpdateAnnouncement, useDeleteAnnouncement,
} from '@/hooks/useVendor'
import type { Announcement } from '@/types'

const STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600' },
  published: { label: 'Published', color: 'bg-green-100 text-green-700' },
  archived:  { label: 'Archived',  color: 'bg-gray-200 text-gray-700' },
}

export default function AnnouncementsPage() {
  const { data: list = [], isLoading } = useHRAnnouncements()
  const del = useDeleteAnnouncement()
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500 mt-1">Broadcast Company News, Updates And Notices</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Announcement
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400" onClick={e => e.stopPropagation()}>Loading…</div>
      ) : (list as Announcement[]).length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(list as Announcement[]).map(a => {
            const stat = STATUS[a.status] ?? STATUS.draft
            return (
              <div key={a.id} className="bg-white border rounded-xl shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {a.pinned && <Pin className="w-3 h-3 text-orange-500 shrink-0" />}
                      <h3 className="font-semibold text-gray-900">{a.title}</h3>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${stat.color}`}>{stat.label}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">
                        {a.category ?? 'general'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2 whitespace-pre-line">{a.body}</p>
                    <p className="text-xs text-gray-400 mt-1.5">
                      Audience: {a.audience ?? 'all'}
                      {a.publish_at && <> · Publish {new Date(a.publish_at).toLocaleString()}</>}
                      {a.expires_at && <> · Expires {new Date(a.expires_at).toLocaleString()}</>}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditing(a)} className="p-1.5 text-gray-400 hover:text-blue-600">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete announcement "${a.title}"?`)) del.mutate(a.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(showNew || editing) && (
        <AnnouncementModal item={editing} onClose={() => { setShowNew(false); setEditing(null) }} />
      )}
    </div>
  )
}

function AnnouncementModal({ item, onClose }: { item: Announcement | null; onClose: () => void }) {
  const create = useCreateAnnouncement()
  const update = useUpdateAnnouncement()
  const [form, setForm] = useState({
    title:           item?.title ?? '',
    body:            item?.body ?? '',
    category:        item?.category ?? 'general',
    audience:        item?.audience ?? 'all',
    pinned:          item?.pinned ?? false,
    cover_image_url: item?.cover_image_url ?? '',
    attachment_url:  item?.attachment_url ?? '',
    publish_at:      item?.publish_at?.slice(0, 16) ?? '',
    expires_at:      item?.expires_at?.slice(0, 16) ?? '',
    status:          item?.status ?? 'draft',
  })

  const submit = () => {
    const payload: Record<string, unknown> = {
      ...form,
      publish_at: form.publish_at || null,
      expires_at: form.expires_at || null,
    }
    if (item) update.mutate({ id: item.id, data: payload }, { onSuccess: onClose })
    else      create.mutate(payload, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onModalBackdropClick(onClose)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{item ? 'Edit Announcement' : 'New Announcement'}</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Title *">
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Body *">
            <textarea className="w-full border rounded px-3 py-2 text-sm" rows={5} value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}>
                <option value="general">General</option>
                <option value="policy">Policy</option>
                <option value="event">Event</option>
                <option value="hr">HR</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
            <Field label="Audience">
              <select className="w-full border rounded px-3 py-2 text-sm" value={form.audience}
                onChange={e => setForm({ ...form, audience: e.target.value })}>
                <option value="all">All</option>
                <option value="department">By department</option>
                <option value="store">By store</option>
                <option value="designation">By designation</option>
              </select>
            </Field>
          </div>
          <Field label="Cover image URL">
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.cover_image_url}
              onChange={e => setForm({ ...form, cover_image_url: e.target.value })} />
          </Field>
          <Field label="Attachment URL">
            <input className="w-full border rounded px-3 py-2 text-sm" value={form.attachment_url}
              onChange={e => setForm({ ...form, attachment_url: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Publish at">
              <input type="datetime-local" className="w-full border rounded px-3 py-2 text-sm"
                value={form.publish_at} onChange={e => setForm({ ...form, publish_at: e.target.value })} />
            </Field>
            <Field label="Expires at">
              <input type="datetime-local" className="w-full border rounded px-3 py-2 text-sm"
                value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
            </Field>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.pinned}
                onChange={e => setForm({ ...form, pinned: e.target.checked })} /> Pin to top
            </label>
            <Field label="Status">
              <select className="border rounded px-3 py-2 text-sm" value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value as Announcement['status'] })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="btn-cancel px-4 py-2 text-sm border rounded-lg text-gray-700">Cancel</button>
          <button onClick={submit} disabled={!form.title.trim() || !form.body.trim() || create.isPending || update.isPending}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
            {item ? 'Save' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  )
}
