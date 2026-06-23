import { useRef, type ReactNode } from 'react'
import { Info, Link2, Minus, Plus, Sparkles, Type } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  defaultOverlayFillColor,
  isOverlayNoFill,
  overlayHasFillControls,
  overlayHasLinkControl,
  overlayHasTextControls,
  overlayLayerTypeLabel,
  type OverlayLayerItem,
} from '@/lib/builderOverlayVisual'
import { OverlayTransformControls } from '@/components/websites/OverlayTransformControls'
import { OverlayAlignControls } from '@/components/websites/OverlayAlignControls'
import { OverlayIconPicker } from '@/components/websites/OverlayIconPicker'
import type { OverlayBox } from '@/lib/overlayAlignmentSnap'
import {
  visualActionBtn,
  visualChip,
  visualGroupDivider,
  visualIconBtn,
  visualMeta,
  visualPanel,
  visualSegmentBtn,
  visualSegmentTrack,
  visualStepperCell,
  visualStepperValue,
  visualToolbarRowWrap,
} from '@/components/websites/designBarVisualUi'

function ColorCell({
  value,
  onChange,
  title,
}: {
  value: string
  onChange: (color: string) => void
  title: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <button
      type="button"
      title={title}
      onClick={() => inputRef.current?.click()}
      className={cn(visualIconBtn(), 'relative overflow-hidden px-0')}
      style={{ backgroundColor: value }}
    >
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute h-0 w-0 opacity-0"
      />
    </button>
  )
}

function StepperField({
  label,
  value,
  min,
  max,
  fallback,
  stepSize = 1,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  fallback: number
  stepSize?: number
  onCommit: (n: number) => void
}) {
  const current = Number.isFinite(value) ? value : fallback
  const step = (delta: number) => onCommit(Math.min(max, Math.max(min, current + delta * stepSize)))

  return (
    <div className={cn(visualPanel, 'relative')} title={label}>
      <button type="button" className={visualStepperCell} onClick={() => step(-1)} aria-label={`Decrease ${label}`}>
        <Minus className="h-2.5 w-2.5" />
      </button>
      <span className={visualStepperValue}>{current}</span>
      <button type="button" className={visualStepperCell} onClick={() => step(1)} aria-label={`Increase ${label}`}>
        <Plus className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

export function OverlayLayerVisualControls({
  item,
  blockBackgroundColor,
  onUpdate,
  onBringToFront,
  onSendToBack,
  onEditLink,
  onEditText,
  onEditDescription,
  siblings,
  containerWidth,
  containerHeight,
  leading,
}: {
  item: OverlayLayerItem
  blockBackgroundColor?: string
  onUpdate: (patch: Partial<OverlayLayerItem>) => void
  onBringToFront?: () => void
  onSendToBack?: () => void
  onEditLink?: () => void
  onEditText?: () => void
  onEditDescription?: () => void
  siblings?: OverlayBox[]
  containerWidth?: number
  containerHeight?: number
  /** Insert / Visuals strip — same row as position controls. */
  leading?: ReactNode
}) {
  const noFill = isOverlayNoFill(item)
  const hasFillControls = overlayHasFillControls(item)
  const hasTextControls = overlayHasTextControls(item)
  const hasLink = overlayHasLinkControl(item)
  const isLinked = !!(item.linkType && item.linkType !== 'none')
  const savedFillColor = item.bgColor && item.bgColor !== 'transparent'
    ? item.bgColor
    : defaultOverlayFillColor(String(item.type))
  const isImage = item.type === 'image'
  const isIcon = item.type === 'icon'
  const hasContainer = !!(containerWidth && containerHeight)

  return (
    <div className="flex min-w-0 w-full flex-col gap-px">
      <div className={visualToolbarRowWrap}>
        {leading}
        {leading ? <span className={visualGroupDivider} aria-hidden /> : null}
        <OverlayTransformControls
          item={item}
          onUpdate={onUpdate}
          onBringToFront={onBringToFront}
          onSendToBack={onSendToBack}
          variant="compact"
          siblings={siblings}
          containerWidth={containerWidth}
          containerHeight={containerHeight}
          keyboardShortcuts
        />
        {hasContainer ? (
          <OverlayAlignControls
            item={item}
            containerWidth={containerWidth!}
            containerHeight={containerHeight!}
            onUpdate={onUpdate}
            variant="compact"
          />
        ) : null}

        <div className={visualPanel}>
          <span className={visualChip}>{overlayLayerTypeLabel(String(item.type))}</span>
          <span className={visualMeta}>{Math.round(item.w)}×{Math.round(item.h)}</span>
        </div>
      </div>

      <div className={visualToolbarRowWrap}>
      {hasTextControls ? (
        <>
          <ColorCell
            value={item.color || '#111827'}
            onChange={color => onUpdate({ color })}
            title="Text color"
          />
          <StepperField
            label="Text size"
            value={item.fontSize ?? 16}
            min={8}
            max={120}
            fallback={16}
            onCommit={n => onUpdate({ fontSize: n })}
          />
          {onEditText ? (
            <button
              type="button"
              title={item.type === 'text' ? 'Edit text' : 'Edit label'}
              onClick={onEditText}
              className={cn(visualActionBtn('primary'), 'w-7 px-0')}
            >
              <Type className="h-3 w-3 shrink-0" />
            </button>
          ) : null}
          {hasLink && onEditLink ? (
            <button
              type="button"
              title={isLinked ? `Linked: ${item.linkLabel || item.linkTarget}` : 'Link'}
              onClick={onEditLink}
              className={cn(visualActionBtn(isLinked ? 'link' : 'muted'), 'w-7 px-0')}
            >
              <Link2 className="h-3 w-3 shrink-0" />
            </button>
          ) : null}
          {(item.type === 'button' || item.type === 'badge') && onEditDescription ? (
            <button
              type="button"
              title="Description"
              onClick={onEditDescription}
              className={cn(visualActionBtn('sky'), 'w-7 px-0')}
            >
              <Info className="h-3 w-3 shrink-0" />
            </button>
          ) : null}
        </>
      ) : null}

      {isIcon ? (
        <>
          <OverlayIconPicker
            compact
            value={item.iconName}
            onChange={iconName => onUpdate({ iconName })}
          />
          <ColorCell
            value={item.color || '#111827'}
            onChange={color => onUpdate({ color })}
            title="Icon color"
          />
          <StepperField
            label="Icon size"
            value={item.fontSize ?? 32}
            min={12}
            max={160}
            fallback={32}
            onCommit={n => onUpdate({ fontSize: n })}
          />
          {hasLink && onEditLink ? (
            <button
              type="button"
              title={isLinked ? `Linked: ${item.linkLabel || item.linkTarget}` : 'Link'}
              onClick={onEditLink}
              className={cn(visualActionBtn(isLinked ? 'link' : 'muted'), 'w-7 px-0')}
            >
              <Link2 className="h-3 w-3 shrink-0" />
            </button>
          ) : null}
        </>
      ) : null}

      {isImage && hasLink && onEditLink ? (
        <button
          type="button"
          title={isLinked ? 'Linked' : 'Link'}
          onClick={onEditLink}
          className={cn(visualActionBtn(isLinked ? 'link' : 'muted'), 'w-7 px-0')}
        >
          <Link2 className="h-3 w-3 shrink-0" />
        </button>
      ) : null}

      {hasFillControls ? (
        <>
          <div className={visualSegmentTrack} role="group" aria-label="Fill">
            <button
              type="button"
              className={visualSegmentBtn(!noFill)}
              onClick={() => onUpdate({ bgFill: 'solid', bgColor: savedFillColor })}
            >
              Solid
            </button>
            <button
              type="button"
              className={visualSegmentBtn(noFill)}
              onClick={() => onUpdate({ bgFill: 'none' })}
            >
              None
            </button>
          </div>
          {!noFill ? (
            <ColorCell
              value={item.bgColor || savedFillColor}
              onChange={color => onUpdate({ bgFill: 'solid', bgColor: color })}
              title="Fill color"
            />
          ) : (
            <div
              className={cn(visualIconBtn(), 'overflow-hidden px-0')}
              style={{ backgroundColor: blockBackgroundColor || '#ffffff' }}
              title="Transparent fill"
            />
          )}
        </>
      ) : null}

      <StepperField
        label="Radius"
        value={item.borderRadius ?? 0}
        min={0}
        max={999}
        fallback={0}
        onCommit={n => onUpdate({ borderRadius: n })}
      />

      <StepperField
        label="Border"
        value={item.borderWidth ?? 0}
        min={0}
        max={24}
        fallback={0}
        onCommit={n => onUpdate({
          borderWidth: n,
          ...(n > 0 && !item.borderColor ? { borderColor: '#111827' } : {}),
        })}
      />

      <ColorCell
        value={item.borderColor || '#111827'}
        onChange={color => onUpdate({
          borderColor: color,
          borderWidth: Math.max(1, item.borderWidth ?? 1),
        })}
        title="Border color"
      />

      <button
        type="button"
        title={item.shadow ? 'Shadow on' : 'Shadow off'}
        onClick={() => onUpdate({ shadow: !item.shadow })}
        className={cn(visualActionBtn(item.shadow ? 'primary' : 'muted'), 'w-7 px-0')}
      >
        <Sparkles className="h-3 w-3 shrink-0" />
      </button>

      <StepperField
        label="Opacity"
        value={item.opacity ?? 100}
        min={10}
        max={100}
        fallback={100}
        onCommit={n => onUpdate({ opacity: n })}
      />

      {isImage ? (
        <>
          <StepperField
            label="Zoom"
            value={item.imageScale ?? 100}
            min={25}
            max={400}
            fallback={100}
            stepSize={10}
            onCommit={n => onUpdate({ imageScale: n })}
          />
          <div className={visualSegmentTrack} role="group" aria-label="Image fit">
            {(['cover', 'contain', 'fill'] as const).map(fit => (
              <button
                key={fit}
                type="button"
                className={visualSegmentBtn((item.objectFit || 'cover') === fit)}
                onClick={() => onUpdate({ objectFit: fit })}
              >
                {fit === 'cover' ? 'Cover' : fit === 'contain' ? 'Fit' : 'Fill'}
              </button>
            ))}
          </div>
        </>
      ) : null}
      </div>
    </div>
  )
}
