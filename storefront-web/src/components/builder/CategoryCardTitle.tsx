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
}: {
  index: number
  title: string
  blockId?: string
  blockProps?: Record<string, unknown>
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: CSSProperties
  placeholder?: string
}) {
  const value = categoryItemTitle(blockProps, index, title)

  if (!blockId) {
    const Tag = as
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
