import { Megaphone, Pin, ExternalLink } from 'lucide-react'
import { useESSAnnouncements, useESSMarkAnnouncementRead } from '@/hooks/useESS'

export default function ESSAnnouncementsPage() {
  const { data: list = [], isLoading } = useESSAnnouncements()
  const markRead = useESSMarkAnnouncementRead()
  const items: any[] = (list as any)?.items ?? list

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">Latest news and updates from your company</p>

      {isLoading ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center">
          <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a: any) => (
            <article
              key={a.id}
              className={`bg-white border rounded-xl shadow-sm overflow-hidden ${
                !a.read_by_me ? 'border-l-4 border-l-blue-500' : ''
              }`}
            >
              {a.cover_image_url && (
                <img src={a.cover_image_url} alt={a.title} className="w-full h-40 object-cover" />
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  {a.pinned && <Pin className="w-3 h-3 text-orange-500 shrink-0" />}
                  <h3 className="font-semibold text-gray-900">{a.title}</h3>
                  {!a.read_by_me && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">NEW</span>
                  )}
                </div>
                <p className="text-[10px] uppercase text-gray-400 mb-2">
                  {a.category ?? 'general'} · {new Date(a.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{a.body}</p>
                <div className="flex items-center gap-4 mt-3">
                  {a.attachment_url && (
                    <a
                      href={a.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Attachment
                    </a>
                  )}
                  {!a.read_by_me && (
                    <button
                      onClick={() => markRead.mutate(a.id)}
                      className="text-xs text-gray-500 hover:text-gray-800 ml-auto"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
