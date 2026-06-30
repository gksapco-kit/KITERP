import { useState } from 'react'
import { X } from 'lucide-react'
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
