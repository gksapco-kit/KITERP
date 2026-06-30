import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

export default function CouponBannerBlock({ style, props, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const [copied, setCopied] = useState(false)

  const title = resolveBlockTextField(props, 'title')
  const code = resolveBlockTextField(props, 'code')
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  const showCode = !isBlockFieldHidden(props, 'code') && (code || isEditorCanvas)
  const showCopy = props.show_copy_button !== false && showCode && code

  const copy = () => {
    if (code) {
      navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!showTitle && !showCode) return null

  return (
    <div className="text-white py-3 px-4 text-center flex items-center justify-center gap-3 flex-wrap" style={{ backgroundColor: style.accent_color || '#f59e0b' }}>
      {showTitle && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="span" className="font-semibold text-sm" placeholder="Promo message" />
      )}
      {showCode && (
        showCopy && !isEditorCanvas ? (
          <button onClick={copy} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-xs font-bold transition-colors">
            {copied ? <><Check className="w-3 h-3" />Copied!</> : <><Copy className="w-3 h-3" />{code}</>}
          </button>
        ) : (
          <BuilderTextField fieldKey="code" blockId={blockId} blockProps={props} value={code ?? ''} as="span" className="bg-white/20 px-3 py-1 rounded-lg text-xs font-bold" placeholder="CODE" skipPositionWrapper />
        )
      )}
    </div>
  )
}
