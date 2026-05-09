import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import StarRating from '@/components/StarRating'
import { useProductReviews, useServiceReviews, useSubmitReview } from '@/hooks/useStore'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { Link } from 'react-router-dom'
import {
  Loader2, MessageSquare, CheckCircle2, ChevronLeft, ChevronRight,
  User, Reply,
} from 'lucide-react'
import type { Review } from '@/types'

interface ReviewSectionProps {
  reviewType: 'product' | 'service'
  targetId: string
}

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-3 text-gray-500">{star}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right text-gray-400">{count}</span>
    </div>
  )
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="border-b last:border-b-0 py-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{review.customer_name || 'Customer'}</span>
            {review.is_verified_purchase && (
              <span className="inline-flex items-center gap-0.5 text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            )}
            <span className="text-xs text-gray-400">
              {new Date(review.created_at).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
            </span>
          </div>
          <div className="mt-1">
            <StarRating rating={review.rating} size="sm" />
          </div>
          {review.title && <p className="font-medium text-sm mt-2">{review.title}</p>}
          {review.comment && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{review.comment}</p>}

          {/* Vendor reply */}
          {review.reply && (
            <div className="mt-3 bg-gray-50 rounded-lg p-3 border-l-2 border-blue-400">
              <div className="flex items-center gap-1 text-xs font-medium text-blue-600 mb-1">
                <Reply className="w-3 h-3" /> Vendor Response
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.reply}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewForm({
  reviewType,
  targetId,
  onSuccess,
}: {
  reviewType: 'product' | 'service'
  targetId: string
  onSuccess: () => void
}) {
  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const submit = useSubmitReview()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) return

    submit.mutate(
      {
        review_type: reviewType,
        product_id: reviewType === 'product' ? targetId : undefined,
        service_id: reviewType === 'service' ? targetId : undefined,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim() || undefined,
      },
      { onSuccess }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-5 space-y-4">
      <h4 className="font-medium text-sm">Write a Review</h4>
      <div>
        <label className="block text-sm text-gray-500 mb-1">Your Rating *</label>
        <StarRating rating={rating} size="lg" interactive onRate={setRating} />
        {rating === 0 && (
          <p className="text-xs text-gray-400 mt-1">Click a star to rate</p>
        )}
      </div>
      <div>
        <label className="block text-sm text-gray-500 mb-1">Title (optional)</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarize your experience"
          maxLength={255}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-500 mb-1">Review (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share details of your experience..."
          maxLength={2000}
          rows={4}
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
      <Button type="submit" disabled={rating === 0 || submit.isPending} className="gap-2">
        {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
        Submit Review
      </Button>
    </form>
  )
}

export default function ReviewSection({ reviewType, targetId }: ReviewSectionProps) {
  const { storePath } = useVendor()
  const { isAuthenticated } = useAuthStore()
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)

  const hook = reviewType === 'product' ? useProductReviews : useServiceReviews
  const { data, isLoading } = hook(targetId, { page, size: 5 })

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Customer Reviews
          {data && data.review_count > 0 && (
            <span className="text-base font-normal text-gray-400">({data.review_count})</span>
          )}
        </h2>
        {isAuthenticated && !showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Write a Review
          </Button>
        )}
      </div>

      {/* Summary */}
      {data && data.review_count > 0 && (
        <div className="flex flex-col sm:flex-row gap-8 mb-8 bg-gray-50 rounded-lg p-5">
          <div className="flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-gray-900">{data.avg_rating.toFixed(1)}</span>
            <StarRating rating={data.avg_rating} size="md" />
            <span className="text-sm text-gray-500 mt-1">{data.review_count} review{data.review_count !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => (
              <RatingBar
                key={star}
                star={star}
                count={data.distribution?.[star] || 0}
                total={data.review_count}
              />
            ))}
          </div>
        </div>
      )}

      {/* Review form */}
      {showForm && (
        <div className="mb-6">
          <ReviewForm
            reviewType={reviewType}
            targetId={targetId}
            onSuccess={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Not logged in prompt */}
      {!isAuthenticated && (
        <div className="text-center py-6 bg-gray-50 rounded-lg mb-6">
          <p className="text-sm text-gray-500">
            <Link to={storePath('/login')} className="text-blue-600 hover:underline font-medium">
              Login
            </Link>{' '}
            to write a review
          </p>
        </div>
      )}

      {/* Reviews list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : !data?.items?.length ? (
        <div className="text-center py-10 text-gray-400">
          <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No reviews yet. Be the first to review!</p>
        </div>
      ) : (
        <div>
          {data.items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-500">
                Page {data.page} of {data.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
