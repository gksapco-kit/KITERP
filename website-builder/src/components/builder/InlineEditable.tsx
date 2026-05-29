interface InlineEditableProps {
  value: string
  onChange: (value: string) => void
  interactive: boolean
  selected: boolean
  tag?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
  className?: string
  style?: React.CSSProperties
  multiline?: boolean
}

export function InlineEditable({
  value,
  onChange,
  interactive,
  selected,
  tag: Tag = 'p',
  className = '',
  style,
  multiline = false,
}: InlineEditableProps) {
  if (!interactive || !selected) {
    return (
      <Tag className={className} style={style}>
        {value}
      </Tag>
    )
  }

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className={`w-full resize-none border-2 border-brand-400 bg-white/90 outline-none ${className}`}
        style={style}
        rows={3}
      />
    )
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={`w-full border-2 border-brand-400 bg-white/90 outline-none ${className}`}
      style={style}
    />
  )
}
