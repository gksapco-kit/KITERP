import { useState, useMemo } from 'react'
import { useReviews, useReplyToReview, useToggleReviewVisibility } from '@/hooks/useVendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableToolbar } from '@/components/table/TableToolbar'
import { processRows, type SortDir } from '@/lib/tableList'
import {
  Star, MessageSquare, Eye, EyeOff, Send, ChevronLeft,
  ChevronRight, Loader2, CheckCircle2, Filter, Reply,
} from 'lucide-react'
import type { Review } from '@/types'

function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${sz} ${s <= rating ? 'fill-amber-400 text-amber-400' : 'fill-none text-gray-300'}`}
        />
      ))}
    </div>
  )
}

function ReplyForm({ reviewId, existingReply }: { reviewId: string; existingReply?: string }) {
  const [reply, setReply] = useState(existingReply || '')
  const [editing, setEditing] = useState(!existingReply)
  const replyMutation = useReplyToReview()

  const handleSubmit = () => {
    if (!reply.trim()) return
    replyMutation.mutate({ id: reviewId, reply: reply.trim() }, {
      onSuccess: () => setEditing(false),
    })
  }

  if (!editing && existingReply) {
    return (
      <div className="mt-3 bg-blue-50 rounded-lg p-3 border-l-3 border-blue-400">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-blue-600 flex items-center gap-1">
            <Reply className="w-3 h-3" /> Your Reply
          </span>
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">
            Edit
          </button>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{existingReply}</p>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="Write a reply to this review..."
        rows={3}
        maxLength={2000}
        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!reply.trim() || replyMutation.isPending}
          className="gap-1"
        >
          {replyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          {existingReply ? 'Update Reply' : 'Post Reply'}
        </Button>
        {existingReply && (
          <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setReply(existingReply) }}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}

function ReviewRow({ review }: { review: Review }) {
  const [showReply, setShowReply] = useState(false)
  const toggleVisibility = useToggleReviewVisibility()

  return (
    <div className={`border rounded-lg p-4 ${!review.is_visible ? 'bg-gray-50 opacity-75' : 'bg-white'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{review.customer_name || 'Customer'}</span>
            <StarDisplay rating={review.rating} />
            {review.is_verified_purchase && (
              <span className="inline-flex items-center gap-0.5 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            )}
            <span className="inline-flex items-center text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded capitalize">
              {review.review_type}
            </span>
            {!review.is_visible && (
              <span className="inline-flex items-center gap-0.5 text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                <EyeOff className="w-3 h-3" /> Hidden
              </span>
            )}
          </div>

          {review.title && <p className="font-medium text-sm mt-2">{review.title}</p>}
          {review.comment && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{review.comment}</p>}

          <p className="text-xs text-gray-400 mt-2">
            {new Date(review.created_at).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </p>

          {/* Existing reply or reply form */}
          {(review.reply || showReply) && (
            <ReplyForm reviewId={review.id} existingReply={review.reply} />
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleVisibility.mutate({ id: review.id, is_visible: !review.is_visible })}
            className="gap-1 text-xs"
            title={review.is_visible ? 'Hide review' : 'Show review'}
          >
            {review.is_visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {review.is_visible ? 'Hide' : 'Show'}
          </Button>
          {!review.reply && !showReply && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReply(true)}
              className="gap-1 text-xs"
            >
              <Reply className="w-3.5 h-3.5" /> Reply
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ReviewsPage() {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const { data, isLoading } = useReviews({ page, size: 15, review_type: filter })

  const displayReviews = useMemo(() => {
    return processRows(
      data?.items,
      search,
      (r) => [r.customer_name || '', r.title || '', r.comment || '', r.review_type || ''],
      sortKey,
      sortDir,
      {
        rating: (r) => r.rating,
        created_at: (r) => r.created_at,
        review_type: (r) => r.review_type,
        customer_name: (r) => r.customer_name || '',
      },
    )
  }, [data?.items, search, sortKey, sortDir])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6" /> Reviews
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage customer reviews for your products and services</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500">Filter:</span>
        {[
          { label: 'All', value: undefined },
          { label: 'Products', value: 'product' },
          { label: 'Services', value: 'service' },
        ].map((f) => (
          <Button
            key={f.label}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilter(f.value); setPage(1) }}
          >
            {f.label}
          </Button>
        ))}
        {data && (
          <span className="text-sm text-gray-400 ml-auto">{data.total} review{data.total !== 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="rounded-lg border bg-white overflow-hidden mb-4">
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search reviews…"
          sortOptions={[
            { value: 'rating', label: 'Rating' },
            { value: 'created_at', label: 'Date' },
            { value: 'review_type', label: 'Type' },
            { value: 'customer_name', label: 'Customer Name' },
          ]}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortKeyChange={setSortKey}
          onSortDirChange={setSortDir}
        />
      </div>

      {/* Reviews list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : !data?.items?.length ? (
        <div className="text-center py-16 bg-white rounded-lg border">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No reviews yet</p>
          <p className="text-sm text-gray-400 mt-1">Reviews will appear here when customers submit them</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayReviews.map((review) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-500">Page {data.page} of {data.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
