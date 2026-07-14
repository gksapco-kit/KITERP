import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageSquareText, Mail, Phone } from 'lucide-react'
import apiClient from '@/api/client'
import { Button } from '@/components/ui/button'

const STATUSES = ['', 'new', 'read', 'resolved'] as const

type ContactQuery = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  message: string
  status: string
  created_at?: string | null
}

export default function ContactQueries() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-contact-queries', statusFilter],
    queryFn: async () => {
      const res = await apiClient.get('/vendors/me/contact-queries', {
        params: { status: statusFilter || undefined, size: 50 },
      })
      return res.data as { items: ContactQuery[]; total: number }
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/vendors/me/contact-queries/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-contact-queries'] }),
  })

  const items = data?.items ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquareText className="w-6 h-6 text-primary" />
          Queries
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Customer messages from your storefront Contact Us page — name, email, phone, and issue.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              statusFilter === s
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-muted-foreground border-border'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/40" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
          No contact queries yet. They appear when shoppers submit the Contact Us form on your storefront.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((q) => (
            <div key={q.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">{q.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {q.created_at ? new Date(q.created_at).toLocaleString() : '—'}
                  </p>
                </div>
                <span className="text-xs font-medium capitalize px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 h-fit">
                  {q.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                {q.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <a href={`mailto:${q.email}`} className="hover:underline">
                      {q.email}
                    </a>
                  </span>
                )}
                {q.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                    <a href={`tel:${q.phone}`} className="hover:underline">
                      {q.phone}
                    </a>
                  </span>
                )}
              </div>

              <p className="text-sm whitespace-pre-wrap border-t pt-3">{q.message}</p>

              {(q.status === 'new' || q.status === 'read') && (
                <div className="flex flex-wrap gap-2">
                  {q.status === 'new' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateMut.isPending}
                      onClick={() => updateMut.mutate({ id: q.id, status: 'read' })}
                    >
                      Mark read
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={updateMut.isPending}
                    onClick={() => updateMut.mutate({ id: q.id, status: 'resolved' })}
                  >
                    Resolve
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
