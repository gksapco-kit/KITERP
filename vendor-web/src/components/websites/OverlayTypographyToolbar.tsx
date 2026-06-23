import type { SyntheticEvent } from 'react'
import { cn } from '@/lib/utils'
import {
  ColorIdentPickerRow,
  TypographyFontStack,
  TextFieldAlignGrid,
  typographyToolbarBox,
  type TextAlignH,
} from '@/components/websites/TypographyCompositionControls'
import {
  defaultOverlayFillColor,
  isOverlayNoFill,
  overlayHasFillControls,
  overlayHasTextControls,
  type OverlayLayerItem,
} from '@/lib/builderOverlayVisual'
import { ensureBuilderFontLoaded } from '@storefront/lib/builderFontFamilies'

type OverlayTypographyItem = Pick<
  OverlayLayerItem,
  'type' | 'color' | 'bgColor' | 'bgFill' | 'fontSize' | 'align'
> & { fontFamily?: string | null }

export function OverlayTypographyToolbar({
  item,
  blockBackgroundColor,
  onUpdate,
  onStopBubble,
  showAlign = true,
  className,
}: {
  item: OverlayTypographyItem
  blockBackgroundColor?: string
  onUpdate: (patch: Record<string, unknown>) => void
  onStopBubble?: (e: SyntheticEvent) => void
  showAlign?: boolean
  className?: string
}) {
  const isIcon = item.type === 'icon'
  const hasText = overlayHasTextControls(item)
  const showSize = hasText || isIcon
  const showFamily = hasText
  const showBackground = overlayHasFillControls(item)

  const stop = (e: SyntheticEvent) => {
    onStopBubble?.(e)
  }

  const textColor = item.color || '#111827'
  const backgroundColor = isOverlayNoFill(item)
    ? (blockBackgroundColor || '#ffffff')
    : (item.bgColor || defaultOverlayFillColor(String(item.type)))

  return (
    <div
      className={cn(typographyToolbarBox, 'w-full max-w-full', className)}
      onMouseDown={stop}
      onPointerDown={stop}
      onClick={stop}
    >
      <div className="flex min-w-0 flex-1 items-stretch">
        {showSize || showFamily ? (
          <TypographyFontStack
            className="border-r border-gray-200"
            showFamily={showFamily}
            showSize={showSize}
            fontFamily={item.fontFamily ?? null}
            onFontFamilyChange={font => {
              if (font) ensureBuilderFontLoaded(font)
              onUpdate({ fontFamily: font || undefined })
            }}
            fontSizePx={item.fontSize}
            onFontSizeStep={delta => {
              const base = item.fontSize ?? (isIcon ? 32 : 16)
              onUpdate({ fontSize: Math.min(isIcon ? 160 : 120, Math.max(isIcon ? 12 : 8, base + delta)) })
            }}
            onFontSizeChange={px => {
              if (px == null) return
              onUpdate({ fontSize: px })
            }}
            onMouseDown={() => {}}
          />
        ) : null}
        <ColorIdentPickerRow
          vertical
          size="compact"
          textColor={textColor}
          backgroundColor={backgroundColor}
          onTextColorChange={color => onUpdate({ color })}
          onBackgroundColorChange={color => onUpdate({ bgFill: 'solid', bgColor: color })}
          showBackgroundPicker={showBackground}
          onMouseDown={e => stop(e)}
        />
      </div>
      {hasText && showAlign ? (
        <TextFieldAlignGrid
          embedded
          size="compact"
          textAlign={item.align}
          verticalAlign={undefined}
          textWrap={undefined}
          onTextAlignChange={(align: TextAlignH) => onUpdate({ align })}
          onVerticalAlignChange={() => {}}
          onTextWrapChange={() => {}}
        />
      ) : null}
    </div>
  )
}
