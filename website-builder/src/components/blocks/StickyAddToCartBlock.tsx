import { useEffect, useState } from 'react'
import { Minus, Plus, ShoppingCart } from 'lucide-react'
import {
  defaultStickyAddToCartProps,
  parsePriceValue,
  STICKY_ADD_TO_CART_DEFAULTS,
} from '../../lib/stickyAddToCartDefaults'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block } from '../../types/builder'

interface StickyAddToCartBlockProps {
  block: Block
  interactive?: boolean
}

export function StickyAddToCartBlock({ block, interactive }: StickyAddToCartBlockProps) {
  const { props, styles } = block
  const addToCart = useBuilderStore((s) => s.addToCart)
  const catalog = useBuilderStore((s) => s.catalog)

  const [quantity, setQuantity] = useState(1)
  const [visible, setVisible] = useState(true)

  const linkedType = props.linkedItemType ?? STICKY_ADD_TO_CART_DEFAULTS.linkedItemType
  const linked = props.linkedItemId
    ? (linkedType === 'service' ? catalog.services : catalog.products).find((p) => p.id === props.linkedItemId)
    : undefined

  const name = linked?.name ?? props.text ?? defaultStickyAddToCartProps().text
  const imageUrl = linked?.imageUrl ?? props.imageUrl ?? defaultStickyAddToCartProps().imageUrl
  const priceStr = linked ? `$${linked.price.toFixed(2)}` : props.productPrice ?? STICKY_ADD_TO_CART_DEFAULTS.productPrice
  const compareAt = props.compareAtPrice ?? STICKY_ADD_TO_CART_DEFAULTS.compareAtPrice
  const showImage = props.showStickyAtcImage !== false
  const showQty = props.showStickyAtcQuantity !== false
  const revealOnScroll = props.stickyAtcRevealOnScroll !== false
  const threshold = props.stickyAtcScrollThreshold ?? STICKY_ADD_TO_CART_DEFAULTS.stickyAtcScrollThreshold
  const subtitle = props.subtitle
  const btnLabel = props.buttonText ?? STICKY_ADD_TO_CART_DEFAULTS.buttonText
  const btnBg = styles.backgroundColor ?? '#111827'
  const btnColor = styles.textColor ?? '#ffffff'

  useEffect(() => {
    if (!interactive || !revealOnScroll) {
      setVisible(true)
      return
    }
    const onScroll = () => setVisible(window.scrollY >= threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [interactive, revealOnScroll, threshold])

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!interactive) return
    addToCart({
      itemId: linked?.id ?? props.linkedItemId ?? 'sticky-product',
      itemType: linkedType,
      name,
      price: linked?.price ?? parsePriceValue(priceStr),
      quantity,
      imageUrl: imageUrl ?? '',
    })
  }

  const bar = (
    <div
        className={`border-t border-gray-200/80 bg-white/95 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md transition-all duration-300 dark:border-gray-700 dark:bg-gray-900/95 ${
          !visible && interactive ? 'pointer-events-none translate-y-full opacity-0' : 'translate-y-0 opacity-100'
        }`}
        style={{ margin: styles.margin }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-3.5">
          {showImage && imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl border border-gray-100 object-cover shadow-sm sm:h-14 sm:w-14"
            />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">{name}</p>
            {subtitle && (
              <p className="hidden truncate text-xs text-gray-500 dark:text-gray-400 sm:block">{subtitle}</p>
            )}
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-base font-bold text-gray-900 dark:text-white">{priceStr}</span>
              {compareAt && compareAt !== priceStr && (
                <span className="text-sm text-gray-400 line-through">{compareAt}</span>
              )}
            </div>
          </div>

          {showQty && (
            <div className="hidden items-center rounded-lg border border-gray-200 bg-gray-50 sm:flex dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setQuantity((q) => Math.max(1, q - 1))
                }}
                className="flex h-9 w-9 items-center justify-center text-gray-600 hover:text-gray-900 dark:text-gray-400"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums">{quantity}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setQuantity((q) => q + 1)
                }}
                className="flex h-9 w-9 items-center justify-center text-gray-600 hover:text-gray-900 dark:text-gray-400"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleAdd}
            style={{ backgroundColor: btnBg, color: btnColor, borderRadius: styles.borderRadius ?? '12px' }}
            className="inline-flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-semibold shadow-md transition hover:opacity-90 sm:px-6 sm:py-3"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{btnLabel}</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
    </div>
  )

  if (interactive) {
    return (
      <div className="pointer-events-none h-0 overflow-visible" aria-hidden>
        <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-50">{bar}</div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {bar}
      <p className="mt-2 text-xs text-gray-400">
        Fixed to bottom on preview and live site{revealOnScroll ? ` · appears after ${threshold}px scroll` : ''}
      </p>
    </div>
  )
}
