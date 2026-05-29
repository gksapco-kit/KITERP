import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import {
  COMMENTS_SECTION_DEFAULTS,
  createCommentItem,
  defaultCommentItems,
} from '../../lib/commentsSectionDefaults'
import type { Block, CommentItem } from '../../types/builder'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </label>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

interface CommentsSectionPropertiesFieldsProps {
  block: Block
  onChange: (props: Partial<Block['props']>) => void
}

function CommentEditor({
  comment,
  index,
  expanded,
  onToggle,
  onChange,
  onRemove,
  isReply = false,
}: {
  comment: CommentItem
  index: number
  expanded: boolean
  onToggle: () => void
  onChange: (item: CommentItem) => void
  onRemove: () => void
  isReply?: boolean
}) {
  return (
    <div className={`rounded-lg border border-gray-100 ${isReply ? 'ml-4 bg-gray-50/80' : 'bg-white'}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
          <span className="truncate text-sm font-medium text-gray-800">
            {isReply ? 'Reply: ' : ''}
            {comment.author || `Comment ${index + 1}`}
          </span>
        </button>
        <button type="button" onClick={onRemove} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500" aria-label="Remove">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {expanded && (
        <div className="space-y-3 border-t border-gray-100 px-3 py-3">
          <Field label="Author">
            <input className={inputClass} value={comment.author} onChange={(e) => onChange({ ...comment, author: e.target.value })} />
          </Field>
          <Field label="Avatar URL (optional)">
            <input className={inputClass} value={comment.avatarUrl ?? ''} onChange={(e) => onChange({ ...comment, avatarUrl: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Date label">
            <input className={inputClass} value={comment.date ?? ''} onChange={(e) => onChange({ ...comment, date: e.target.value })} placeholder="2 hours ago" />
          </Field>
          <Field label="Comment">
            <textarea className={inputClass} rows={3} value={comment.body} onChange={(e) => onChange({ ...comment, body: e.target.value })} />
          </Field>
          <Field label="Likes">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={comment.likes ?? 0}
              onChange={(e) => onChange({ ...comment, likes: parseInt(e.target.value, 10) || 0 })}
            />
          </Field>
          <ToggleField label="Mark as author" checked={!!comment.isAuthor} onChange={(v) => onChange({ ...comment, isAuthor: v })} />
        </div>
      )}
    </div>
  )
}

export function CommentsSectionPropertiesFields({ block, onChange }: CommentsSectionPropertiesFieldsProps) {
  const p = block.props
  const comments = p.commentItems ?? defaultCommentItems()
  const layout = p.commentsLayout ?? COMMENTS_SECTION_DEFAULTS.commentsLayout
  const [expanded, setExpanded] = useState<string | number | null>('0')

  const updateComments = (next: CommentItem[]) => onChange({ commentItems: next })

  const updateComment = (index: number, item: CommentItem) => {
    const next = [...comments]
    next[index] = item
    updateComments(next)
  }

  const removeComment = (index: number) => {
    updateComments(comments.filter((_, i) => i !== index))
    if (expanded === String(index)) setExpanded(null)
  }

  const addComment = () => {
    const next = [...comments, createCommentItem({ author: `Guest ${comments.length + 1}` })]
    updateComments(next)
    setExpanded(String(next.length - 1))
  }

  const addReply = (index: number) => {
    const next = [...comments]
    const replies = [...(next[index].replies ?? []), createCommentItem({ author: 'Reply author' })]
    next[index] = { ...next[index], replies }
    updateComments(next)
  }

  const updateReply = (commentIndex: number, replyIndex: number, reply: CommentItem) => {
    const next = [...comments]
    const replies = [...(next[commentIndex].replies ?? [])]
    replies[replyIndex] = reply
    next[commentIndex] = { ...next[commentIndex], replies }
    updateComments(next)
  }

  const removeReply = (commentIndex: number, replyIndex: number) => {
    const next = [...comments]
    const replies = (next[commentIndex].replies ?? []).filter((_, i) => i !== replyIndex)
    next[commentIndex] = { ...next[commentIndex], replies }
    updateComments(next)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Comments Section</p>

      <Field label="Section title">
        <input className={inputClass} value={p.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Comments" />
      </Field>

      <Field label="Section subtitle">
        <input className={inputClass} value={p.subtitle ?? ''} onChange={(e) => onChange({ subtitle: e.target.value })} placeholder="Join the conversation" />
      </Field>

      <Field label="Layout">
        <select
          className={inputClass}
          value={layout}
          onChange={(e) => onChange({ commentsLayout: e.target.value as 'stacked' | 'cards' | 'threaded' | 'compact' })}
        >
          <option value="stacked">Stacked list</option>
          <option value="cards">Card grid</option>
          <option value="threaded">Threaded replies</option>
          <option value="compact">Compact</option>
        </select>
      </Field>

      <ToggleField label="Show comment form" checked={p.showCommentForm !== false} onChange={(v) => onChange({ showCommentForm: v })} />
      <ToggleField label="Show avatars" checked={p.showCommentAvatars !== false} onChange={(v) => onChange({ showCommentAvatars: v })} />
      <ToggleField label="Show like buttons" checked={p.showCommentLikes !== false} onChange={(v) => onChange({ showCommentLikes: v })} />
      <ToggleField label="Show reply buttons" checked={p.showReplyButton !== false} onChange={(v) => onChange({ showReplyButton: v })} />

      {p.showCommentForm !== false && (
        <>
          <Field label="Form position">
            <select
              className={inputClass}
              value={p.commentFormPosition ?? 'top'}
              onChange={(e) => onChange({ commentFormPosition: e.target.value as 'top' | 'bottom' })}
            >
              <option value="top">Above comments</option>
              <option value="bottom">Below comments</option>
            </select>
          </Field>
          <Field label="Placeholder text">
            <input className={inputClass} value={p.commentFormPlaceholder ?? ''} onChange={(e) => onChange({ commentFormPlaceholder: e.target.value })} />
          </Field>
          <Field label="Submit button">
            <input className={inputClass} value={p.commentFormButtonText ?? ''} onChange={(e) => onChange({ commentFormButtonText: e.target.value })} />
          </Field>
        </>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Comments ({comments.length})</p>
        <button
          type="button"
          onClick={addComment}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      <div className="space-y-2">
        {comments.map((comment, i) => (
          <div key={comment.id ?? i} className="space-y-2">
            <CommentEditor
              comment={comment}
              index={i}
              expanded={expanded === String(i)}
              onToggle={() => setExpanded(expanded === String(i) ? null : String(i))}
              onChange={(item) => updateComment(i, item)}
              onRemove={() => removeComment(i)}
            />
            {(comment.replies ?? []).map((reply, ri) => (
              <CommentEditor
                key={reply.id ?? ri}
                comment={reply}
                index={ri}
                isReply
                expanded={expanded === `${i}-r-${ri}`}
                onToggle={() => setExpanded(expanded === `${i}-r-${ri}` ? null : `${i}-r-${ri}`)}
                onChange={(item) => updateReply(i, ri, item)}
                onRemove={() => removeReply(i, ri)}
              />
            ))}
            <button
              type="button"
              onClick={() => addReply(i)}
              className="ml-4 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              + Add reply
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
