import type { CSSProperties } from 'react'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { categoryFieldKey, categoryItemTitle } from '@/lib/categoryCardEditor'

/** Editable category label — persists to `props.categories[i].title`. */
export function CategoryCardTitle({
  index,
  title,
  blockId,
  blockProps,
  as = 'h3',
  className,
  style,
  placeholder,
  readOnly = false,
}: {
  index: number
  title: string
  blockId?: string
  blockProps?: Record<string, unknown>
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: CSSProperties
  placeholder?: string
  /** When true, render synced catalog text (no canvas edit). */
  readOnly?: boolean
}) {
  const value = categoryItemTitle(blockProps, index, title)
  const Tag = as

  if (!blockId || readOnly) {
    return (
      <Tag className={className} style={style}>
        {value}
      </Tag>
    )
  }

  return (
    <BuilderTextField
      fieldKey={categoryFieldKey(index)}
      blockId={blockId}
      blockProps={blockProps}
      value={value}
      as={as}
      className={className}
      style={style}
      placeholder={placeholder ?? 'Category name'}
    />
  )
}
