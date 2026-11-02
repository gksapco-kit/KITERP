import { useState } from 'react'
import { Flame, X } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

export default function AnnouncementBarBlock({ props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const [dismissed, setDismissed] = useState(false)
  if (dismissed && !isEditorCanvas) return null

  const text = resolveBlockTextField(props, 'text')
  const color = (props.color as string) || '#64C3A0'
  const showClose = props.show_close !== false
  const showText = !isBlockFieldHidden(props, 'text') && (text || isEditorCanvas)

  if (!showText) return null

  // Opt-in "lead" layout:  [flame] LEAD TEXT | highlight rest-of-text   (props.lead_text).
  // Sites without lead_text keep the original centered bar below.
  const leadText = typeof props.lead_text === 'string' ? props.lead_text.trim() : ''
  if (leadText) {
    const accent = (props.accent_color as string) || '#E8B96A'
    const highlight = typeof props.text_highlight === 'string' ? props.text_highlight.trim() : ''
    return (
      <div className="relative px-4 py-1.5 text-center text-[12px] sm:text-[13px]" style={{ backgroundColor: color, color: '#fff' }}>
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
          <Flame className="h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden />
          <span className="font-semibold uppercase italic tracking-[0.18em]" style={{ color: accent }}>{leadText}</span>
          <span aria-hidden className="hidden h-4 w-px bg-white/30 sm:block" />
          <span>
            {highlight && <span className="font-semibold italic" style={{ color: accent }}>{highlight} </span>}
            <BuilderTextField
              fieldKey="text"
              blockId={blockId}
              blockProps={props}
              value={text ?? ''}
              as="span"
              placeholder="Announcement text"
            />
          </span>
        </div>
        {showClose && !isEditorCanvas && (
          <button onClick={() => setDismissed(true)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="text-white text-sm py-2 px-4 text-center relative" style={{ backgroundColor: color }}>
      <BuilderTextField
        fieldKey="text"
        blockId={blockId}
        blockProps={props}
        value={text ?? ''}
        as="span"
        placeholder="Announcement text"
      />
      {showClose && !isEditorCanvas && (
        <button onClick={() => setDismissed(true)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
