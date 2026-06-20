import { onModalBackdropClick, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { hrInputClass, hrTabActiveClass, hrTabInactiveClass, hrStatusBadge, hrEmptyStateClass, hrCardClass } from '../hrFormUi'
import { InlineFieldLabel } from '@/components/common/InlineFieldLabel'
import { Select } from '@/components/ui/select'
import { useState } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Megaphone, Plus, Pencil, Trash2, X, Pin } from 'lucide-react'
import {
  useHRAnnouncements, useCreateAnnouncement, useUpdateAnnouncement, useDeleteAnnouncement,
} from '@/hooks/useVendor'
import type { Announcement } from '@/types'

const STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: hrStatusBadge.draft },
  published: { label: 'Published', color: hrStatusBadge.published },
  archived:  { label: 'Archived',  color: hrStatusBadge.archived },
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
          <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
          <p className="mt-1 text-sm text-muted-foreground">Broadcast Company News, Updates And Notices</p>
        </div>
        <Button type="button" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> New Announcement
        </Button>
      </div>

      {isLoading ? (
        <div className={cn(hrCardClass, 'p-8 text-center text-muted-foreground')} onClick={e => e.stopPropagation()}>Loading…</div>
      ) : (list as Announcement[]).length === 0 ? (
        <div className={hrEmptyStateClass}>
          <Megaphone className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(list as Announcement[]).map(a => {
            const stat = STATUS[a.status] ?? STATUS.draft
            return (
              <div key={a.id} className={cn(hrCardClass, 'max-h-[90vh] overflow-y-auto p-4 shadow-sm')}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {a.pinned && <Pin className="h-3 w-3 shrink-0 text-orange-500" />}
                      <h3 className="font-semibold text-foreground">{a.title}</h3>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${stat.color}`}>{stat.label}</span>
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs uppercase text-primary">
                        {a.category ?? 'general'}
                      </span>
                    </div>
                    <p className="line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Audience: {a.audience ?? 'all'}
                      {a.publish_at && <> · Publish {new Date(a.publish_at).toLocaleString()}</>}
                      {a.expires_at && <> · Expires {new Date(a.expires_at).toLocaleString()}</>}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => setEditing(a)} className="p-1.5 text-muted-foreground hover:text-primary">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button"
                      onClick={() => { if (confirm(`Delete announcement "${a.title}"?`)) del.mutate(a.id) }}
                      className="p-1.5 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
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

function AnnouncementModal({
 item, onClose }: { item: Announcement | null; onClose: () => void }) {
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
    <div data-kiterp-modal className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" onClick={onModalBackdropClick(onClose)}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-border bg-card text-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-bold text-foreground">{item ? 'Edit Announcement' : 'New Announcement'}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 p-4">
          <Field label="Title *">
            <input className={hrInputClass} value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Body *">
            <textarea className={cn(hrInputClass, 'min-h-[7rem] resize-y')} rows={5} value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                options={[
                  { value: 'general', label: 'General' },
                  { value: 'policy', label: 'Policy' },
                  { value: 'event', label: 'Event' },
                  { value: 'hr', label: 'HR' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
                aria-label="Category"
                className="w-full"
              />
            </Field>
            <Field label="Audience">
              <Select
                value={form.audience}
                onChange={(v) => setForm({ ...form, audience: v })}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'department', label: 'By department' },
                  { value: 'store', label: 'By store' },
                  { value: 'designation', label: 'By designation' },
                ]}
                aria-label="Audience"
                className="w-full"
              />
            </Field>
          </div>
          <Field label="Cover image URL">
            <input className={hrInputClass} value={form.cover_image_url}
              onChange={e => setForm({ ...form, cover_image_url: e.target.value })} />
          </Field>
          <Field label="Attachment URL">
            <input className={hrInputClass} value={form.attachment_url}
              onChange={e => setForm({ ...form, attachment_url: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Publish at">
              <input type="datetime-local" className={hrInputClass}
                value={form.publish_at} onChange={e => setForm({ ...form, publish_at: e.target.value })} />
            </Field>
            <Field label="Expires at">
              <input type="datetime-local" className={hrInputClass}
                value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
            </Field>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.pinned}
                onChange={e => setForm({ ...form, pinned: e.target.checked })} /> Pin to top
            </label>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v as Announcement['status'] })}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'published', label: 'Published' },
                  { value: 'archived', label: 'Archived' },
                ]}
                aria-label="Status"
                className="w-full"
              />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={!form.title.trim() || !form.body.trim() || create.isPending || update.isPending}>
            {item ? 'Save' : 'Publish'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <InlineFieldLabel label={label} className="mb-1 block text-xs font-medium text-muted-foreground" />
      {children}
    </div>
  )
}
