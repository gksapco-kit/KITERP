import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isMultiSelectModifier } from '@/lib/builderMultiSelect'
import { useStorePath } from '@/hooks/useStorePath'
import { BuilderPositionableField } from '@/components/builder/BuilderPositionableField'
import { BuilderTextField } from '@/components/builder/BuilderTextField'

/** Canvas-editable CTA button — selectable, draggable, inline label edit. */
export function BuilderCtaButton({
  fieldKey,
  blockId,
  blockProps,
  label,
  href,
  className,
  style,
  trailing,
}: {
  fieldKey: string
  blockId?: string
  blockProps?: Record<string, unknown>
  label: string
  href: string
  className?: string
  style?: CSSProperties
  trailing?: ReactNode
}) {
  const ctx = useBuilderCanvas()
  const storePath = useStorePath()
  const isEditor = ctx?.isEditorCanvas && !!blockId
  const isActive = isEditor
    && ctx?.activeBlockId === blockId
    && ((ctx?.activeTextFields ?? []).includes(fieldKey) || ctx?.activeTextField === fieldKey)

  const inner = (
    <>
      <BuilderTextField
        fieldKey={fieldKey}
        blockId={blockId}
        blockProps={blockProps}
        value={label}
        as="span"
        skipPositionWrapper
        embeddedInControl
        className="inline"
      />
      {trailing}
    </>
  )

  const buttonClass = cn(
    className,
    isEditor && 'cursor-pointer',
  )

  if (isEditor) {
    return (
      <BuilderPositionableField
        fieldKey={fieldKey}
        blockId={blockId}
        blockProps={blockProps}
        inline
      >
        <span
          role="button"
          tabIndex={0}
          data-builder-cta-shell="true"
          data-builder-cta-active={isActive ? 'true' : undefined}
          data-builder-field-selected={isActive ? 'true' : undefined}
          className={buttonClass}
          style={style}
          onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
          onClick={(e: React.MouseEvent) => {
            if ((e.target as HTMLElement).closest('[data-text-key]')) return
            e.stopPropagation()
            if (!blockId) return
            ctx?.onTextFieldActivate?.(blockId, fieldKey, { additive: isMultiSelectModifier(e) })
          }}
        >
          {inner}
        </span>
      </BuilderPositionableField>
    )
  }

  return (
    <Link to={storePath(href)} className={buttonClass} style={style}>
      {label}
      {trailing}
    </Link>
  )
}
