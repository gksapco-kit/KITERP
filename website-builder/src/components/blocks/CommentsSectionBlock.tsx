import { useState } from 'react'
import { Heart, MessageCircle, Send, Sparkles } from 'lucide-react'
import { SectionHeading } from '../builder/SectionHeading'
import {
  avatarGradient,
  COMMENTS_SECTION_DEFAULTS,
  getInitials,
} from '../../lib/commentsSectionDefaults'
import type { Block, CommentItem } from '../../types/builder'

interface CommentsSectionBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
}

function Avatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl?: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={`${dim} shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-gray-900`} />
  }
  return (
    <span
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-white dark:ring-gray-900 ${avatarGradient(name)}`}
    >
      {getInitials(name)}
    </span>
  )
}

function CommentForm({
  placeholder,
  buttonText,
  compact = false,
}: {
  placeholder: string
  buttonText: string
  compact?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/50 ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      }`}
    >
      <div className="flex gap-3 sm:gap-4">
        <Avatar name="You" size={compact ? 'sm' : 'md'} />
        <div className="min-w-0 flex-1 space-y-3">
          {!compact && (
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                readOnly
                placeholder="Your name"
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none dark:border-gray-600 dark:bg-gray-800"
              />
              <input
                type="email"
                readOnly
                placeholder="Email (optional)"
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
          )}
          <textarea
            readOnly
            rows={compact ? 2 : 3}
            placeholder={placeholder}
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-300 dark:border-gray-600 dark:bg-gray-800"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400">Preview only — form is not wired to a backend</p>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
            >
              <Send className="h-4 w-4" aria-hidden />
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CommentActions({
  likes,
  showLikes,
  showReply,
  liked,
  onLike,
}: {
  likes: number
  showLikes: boolean
  showReply: boolean
  liked: boolean
  onLike?: () => void
}) {
  return (
    <div className="mt-3 flex items-center gap-4">
      {showLikes && (
        <button
          type="button"
          onClick={onLike}
          className={`inline-flex items-center gap-1.5 text-xs font-medium transition ${
            liked ? 'text-rose-500' : 'text-gray-400 hover:text-rose-500'
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${liked ? 'fill-current' : ''}`} aria-hidden />
          {likes > 0 ? likes : 'Like'}
        </button>
      )}
      {showReply && (
        <button type="button" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition hover:text-brand-600">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          Reply
        </button>
      )}
    </div>
  )
}

function CommentRow({
  comment,
  layout,
  showAvatars,
  showLikes,
  showReply,
  isReply = false,
  interactive,
}: {
  comment: CommentItem
  layout: string
  showAvatars: boolean
  showLikes: boolean
  showReply: boolean
  isReply?: boolean
  interactive?: boolean
}) {
  const [liked, setLiked] = useState(false)
  const likes = comment.likes ?? 0

  const cardClass =
    layout === 'cards'
      ? 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900/40'
      : layout === 'compact'
        ? 'py-3'
        : 'py-5'

  const threadClass =
    layout === 'threaded' && isReply
      ? 'ml-6 border-l-2 border-brand-200 pl-5 dark:border-brand-800 sm:ml-10 sm:pl-6'
      : ''

  return (
    <article className={`${cardClass} ${threadClass}`}>
      <div className="flex gap-3 sm:gap-4">
        {showAvatars && <Avatar name={comment.author} avatarUrl={comment.avatarUrl} size={layout === 'compact' ? 'sm' : 'md'} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{comment.author}</span>
            {comment.isAuthor && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                <Sparkles className="h-2.5 w-2.5" aria-hidden />
                Author
              </span>
            )}
            {comment.date && <span className="text-xs text-gray-400">{comment.date}</span>}
          </div>
          <p className={`mt-2 leading-relaxed text-gray-600 dark:text-gray-300 ${layout === 'compact' ? 'text-sm' : 'text-sm sm:text-base'}`}>
            {comment.body}
          </p>
          <CommentActions
            likes={likes}
            showLikes={showLikes}
            showReply={showReply && !isReply}
            liked={liked}
            onLike={interactive ? () => setLiked((v) => !v) : undefined}
          />
        </div>
      </div>
    </article>
  )
}

function CommentThread({
  comment,
  layout,
  showAvatars,
  showLikes,
  showReply,
  interactive,
}: {
  comment: CommentItem
  layout: string
  showAvatars: boolean
  showLikes: boolean
  showReply: boolean
  interactive?: boolean
}) {
  const replies = (comment.replies ?? []).filter((r) => r.enabled !== false)

  return (
    <div className={layout === 'stacked' || layout === 'cards' ? 'divide-y divide-gray-100 dark:divide-gray-800' : 'space-y-0'}>
      <CommentRow
        comment={comment}
        layout={layout}
        showAvatars={showAvatars}
        showLikes={showLikes}
        showReply={showReply}
        interactive={interactive}
      />
      {replies.length > 0 && (
        <div className={layout === 'cards' ? 'mt-3 space-y-3 pl-2' : ''}>
          {replies.map((reply) => (
            <CommentRow
              key={reply.id ?? reply.author}
              comment={reply}
              layout={layout}
              showAvatars={showAvatars}
              showLikes={showLikes}
              showReply={false}
              isReply
              interactive={interactive}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CommentsSectionBlock({ block, layoutStyle, interactive }: CommentsSectionBlockProps) {
  const { props, styles } = block
  const layout = props.commentsLayout ?? COMMENTS_SECTION_DEFAULTS.commentsLayout
  const showForm = props.showCommentForm !== false
  const showAvatars = props.showCommentAvatars !== false
  const showLikes = props.showCommentLikes !== false
  const showReply = props.showReplyButton !== false
  const formPosition = props.commentFormPosition ?? COMMENTS_SECTION_DEFAULTS.commentFormPosition
  const placeholder = props.commentFormPlaceholder ?? COMMENTS_SECTION_DEFAULTS.commentFormPlaceholder
  const buttonText = props.commentFormButtonText ?? COMMENTS_SECTION_DEFAULTS.commentFormButtonText
  const items = (props.commentItems ?? []).filter((c) => c.enabled !== false)

  const form = showForm ? (
    <CommentForm placeholder={placeholder} buttonText={buttonText} compact={layout === 'compact'} />
  ) : null

  const listClass =
    layout === 'cards'
      ? 'space-y-4'
      : layout === 'stacked'
        ? 'divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white px-5 dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900/30 sm:px-6'
        : layout === 'threaded'
          ? 'space-y-1 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/30 sm:p-5'
          : 'space-y-1'

  if (items.length === 0) {
    return (
      <section style={layoutStyle} className="w-full py-8 text-center text-sm text-gray-400">
        Add comments in the properties panel
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      {(props.text || props.subtitle) && (
        <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-6" />
      )}

      <div className="space-y-6">
        {formPosition === 'top' && form}

        <div className={listClass}>
          {items.map((comment) => (
            <CommentThread
              key={comment.id ?? comment.author}
              comment={comment}
              layout={layout}
              showAvatars={showAvatars}
              showLikes={showLikes}
              showReply={showReply}
              interactive={interactive}
            />
          ))}
        </div>

        {formPosition === 'bottom' && form}
      </div>
    </section>
  )
}
