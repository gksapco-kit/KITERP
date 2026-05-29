interface CardItemImageProps {
  src?: string
  alt?: string
  height: string
  className?: string
  placeholderClassName?: string
}

export function CardItemImage({
  src,
  alt = '',
  height,
  className = '',
  placeholderClassName = 'text-xs text-gray-400',
}: CardItemImageProps) {
  const shellClass = `w-full shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-700 ${className}`

  if (!src) {
    return (
      <div className={`flex items-center justify-center ${shellClass}`} style={{ height }}>
        <span className={placeholderClassName}>No image</span>
      </div>
    )
  }

  return (
    <div className={shellClass} style={{ height }}>
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  )
}
