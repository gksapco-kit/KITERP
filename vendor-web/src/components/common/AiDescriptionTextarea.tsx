import { useState, type TextareaHTMLAttributes } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { vendorApi, type AiCopyRequest } from '@/api/vendor'
import { extractApiError } from '@/lib/errorMessages'
import { cn } from '@/lib/utils'

export type AiCopyFieldKind = AiCopyRequest['field_kind']

export type AiDescriptionContext = {
  field_kind: AiCopyFieldKind
  name?: string
  category?: string
  company_type?: string
  offering_type?: string
  extra_context?: Record<string, string | number | boolean | null | undefined>
  /** Soft gate: show toast if missing before calling API */
  requireNameOrCategory?: boolean
}

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  context: AiDescriptionContext
  maxLength?: number
  showCounter?: boolean
  wrapperClassName?: string
  buttonClassName?: string
}

export function AiDescriptionTextarea({
  value,
  onChange,
  context,
  maxLength = 2000,
  showCounter = false,
  className,
  wrapperClassName,
  buttonClassName,
  rows = 3,
  disabled,
  ...rest
}: Props) {
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    const name = (context.name || '').trim()
    const category = (context.category || context.company_type || '').trim()
    const draft = (value || '').trim()
    if (context.requireNameOrCategory !== false && !name && !category && !draft) {
      toast.error('Enter a name/title or category first')
      return
    }
    setLoading(true)
    try {
      const { result } = await vendorApi.generateAiCopy({
        field_kind: context.field_kind,
        name: name || undefined,
        category: category || undefined,
        company_type: context.company_type || undefined,
        offering_type: context.offering_type || undefined,
        current_text: draft || undefined,
        max_chars: maxLength,
        extra_context: context.extra_context,
      })
      const next = (result || '').trim().slice(0, maxLength)
      if (!next) {
        toast.error('AI did not return text. Please try again.')
        return
      }
      onChange(next)
      toast.success('Description generated — review and save when ready')
    } catch (err) {
      toast.error(extractApiError(err, 'generate description') || 'Could not generate description')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('space-y-1', wrapperClassName)}>
      {showCounter ? (
        <div className="flex justify-end">
          <span className="text-xs tabular-nums text-muted-foreground">
            {(value || '').length}/{maxLength}
          </span>
        </div>
      ) : null}
      <div className="relative">
        <textarea
          {...rest}
          rows={rows}
          value={value}
          disabled={disabled || loading}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'flex min-h-[4.5rem] w-full resize-y rounded-md border border-input bg-background py-1.5 pl-2.5 pr-9 text-sm leading-snug',
            className,
          )}
        />
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={disabled || loading}
          title="Generate with AI"
          aria-label="Generate with AI"
          className={cn(
            'absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-primary hover:bg-primary/10 disabled:opacity-60',
            buttonClassName,
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
