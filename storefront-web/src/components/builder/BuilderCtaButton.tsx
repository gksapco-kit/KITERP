import type { CSSProperties, ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isMultiSelectModifier } from '@/lib/builderMultiSelect'
import { useStorePath } from '@/hooks/useStorePath'
import { fieldCtaShellStyle } from '@/lib/fieldTextStyles'
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
  allowElementDelete = false,
}: {
  fieldKey: string
  blockId?: string
  blockProps?: Record<string, unknown>
  label: string
  href: string
  className?: string
  style?: CSSProperties
  trailing?: ReactNode
  /** Show remove control when this button is selected (hero sections). */
  allowElementDelete?: boolean
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
    'builder-site-btn',
    className,
    isEditor && 'cursor-pointer',
  )

  const shellStyle = blockProps
    ? fieldCtaShellStyle(blockProps, fieldKey, style)
    : style

  if (isEditor) {
    return (
      <BuilderPositionableField
        fieldKey={fieldKey}
        blockId={blockId}
        blockProps={blockProps}
        inline
        className="relative inline-block"
      >
        {allowElementDelete && isActive && ctx?.onDeleteBlockField && blockId ? (
          <button
            type="button"
            data-builder-cta-delete
            title="Remove button"
            className="absolute -top-2.5 -right-2.5 z-[60] flex h-5 w-5 items-center justify-center rounded-full border border-red-200 bg-red-600 text-white shadow-md hover:bg-red-700"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation()
              ctx.onDeleteBlockField!(blockId, fieldKey)
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        ) : null}
        <span
          role="button"
          tabIndex={0}
          data-builder-cta-shell="true"
          data-builder-cta-active={isActive ? 'true' : undefined}
          data-builder-field-selected={isActive ? 'true' : undefined}
          className={buttonClass}
          style={shellStyle}
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

  const target = (href || '').trim()
  // External / protocol links (http, mailto, tel, protocol-relative) and in-page
  // anchors must NOT be run through `storePath` or a router <Link>, otherwise the
  // store path prefix corrupts them (e.g. `mailto:x` -> `/store/slug/mailto:x`).
  const isProtocol = /^(https?:|mailto:|tel:)/i.test(target) || target.startsWith('//')
  const isAnchor = target.startsWith('#')
  // Query-only targets (e.g. `?branch=code`) attach to the store home.
  const to = target.startsWith('?') ? `${storePath('/')}${target}` : storePath(target || '/')

  // Same shell + label typography + position wrapper as the editor so preview/live
  // keep CTA colors, sizes, offsets, and text styles from the canvas.
  const shell = isProtocol || isAnchor ? (
    <a href={target} className={buttonClass} style={shellStyle} data-builder-cta-shell="true">
      {inner}
    </a>
  ) : (
    <Link to={to} className={buttonClass} style={shellStyle} data-builder-cta-shell="true">
      {inner}
    </Link>
  )

  return (
    <BuilderPositionableField
      fieldKey={fieldKey}
      blockId={blockId}
      blockProps={blockProps}
      inline
      className="relative inline-block"
    >
      {shell}
    </BuilderPositionableField>
  )
}
