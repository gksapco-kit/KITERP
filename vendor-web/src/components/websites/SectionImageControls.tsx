import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Layers,
  Minus,
  Plus,
  Square,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CanvasImageArraySlot } from '@storefront/lib/canvasImageTarget'
import {
  patchArrayItemImageStyle,
  patchMultipleArrayItemImageStyles,
  readArrayItemFromBlockProps,
  readArrayItemImageStyleProps,
  readSectionImageFit,
  readSectionImageFocal,
  readSectionImageLayer,
  readSectionImageOpacity,
  readSectionImageOverlay,
  readSectionImageRadius,
  readSectionImageScale,
  readSectionImageShadow,
  sectionImageDecorKeys,
  sectionImageStyleKeys,
  type SectionImageFit,
  type SectionImageOverlay,
  type SectionImageShadow,
} from '@storefront/lib/sectionImageStyle'
import {
  DESIGN_BAR_SOFT_INNER_BORDER,
  visualFocalCell,
  visualFocalCorner,
  visualFocalPad,
  visualPanel,
  visualRow,
  visualSegmentBtn,
  visualSegmentTrack,
  VISUAL_TAB_ROW_H,
  visualStepperCell,
  visualStepperValue,
} from '@/components/websites/designBarVisualUi'

const FOCAL_STEP = 5
const HEIGHT_STEP = 40
const ZOOM_STEP = 10
const RADIUS_STEP = 4
const OPACITY_STEP = 10
const WIDTH_STEP = 5

const SHADOW_OPTIONS: { value: SectionImageShadow; label: string; title: string }[] = [
  { value: 'none', label: '✕', title: 'No shadow' },
  { value: 'sm', label: 'S', title: 'Small shadow' },
  { value: 'md', label: 'M', title: 'Medium shadow' },
  { value: 'lg', label: 'L', title: 'Large shadow' },
  { value: 'xl', label: 'XL', title: 'Extra large shadow' },
  { value: 'inner', label: 'In', title: 'Inset shadow' },
  { value: 'glow', label: 'Gl', title: 'Soft outer glow' },
]

const OVERLAY_OPTIONS: { value: SectionImageOverlay; label: string; title: string }[] = [
  { value: 'none', label: 'Off', title: 'No gradient overlay' },
  { value: 'dark-bottom', label: 'Btm', title: 'Dark fade from bottom (best for captions)' },
  { value: 'top-fade', label: 'Top', title: 'Dark fade from top' },
  { value: 'left-fade', label: 'L', title: 'Dark fade from left' },
  { value: 'right-fade', label: 'R', title: 'Dark fade from right' },
  { value: 'vignette', label: 'Vig', title: 'Dark edges, clear center' },
  { value: 'spotlight', label: 'Spot', title: 'Bright center, dark edges' },
  { value: 'dark-full', label: 'Dim', title: 'Even dark wash' },
  { value: 'warm', label: 'Warm', title: 'Warm amber tint' },
  { value: 'cool', label: 'Cool', title: 'Cool blue tint' },
  { value: 'sunset', label: 'Sun', title: 'Sunset warmth from bottom' },
  { value: 'brand', label: 'Brand', title: 'Brand color gradient' },
]


function stopBarBubble(e: React.SyntheticEvent) {
  e.stopPropagation()
}

function FocalPad({
  onNudge,
  onCenter,
}: {
  onNudge: (dx: number, dy: number) => void
  onCenter: () => void
}) {
  const btn = (dx: number, dy: number, label: string, Icon: typeof ArrowUp) => (
    <button
      type="button"
      title={label}
      className={visualFocalCell}
      onMouseDown={stopBarBubble}
      onClick={() => onNudge(dx, dy)}
    >
      <Icon className="h-2.5 w-2.5" />
    </button>
  )

  return (
    <div
      className={visualFocalPad}
      role="group"
      aria-label="Image focal point — or drag the photo on the canvas to fit"
    >
      <div className={visualFocalCorner} aria-hidden />
      {btn(0, -FOCAL_STEP, 'Pan up — show upper part of image', ArrowUp)}
      <div className={visualFocalCorner} aria-hidden />
      {btn(-FOCAL_STEP, 0, 'Pan left', ArrowLeft)}
      <button
        type="button"
        title="Center image in frame"
        className={cn(visualFocalCell, 'text-primary')}
        onMouseDown={stopBarBubble}
        onClick={onCenter}
      >
        <Crosshair className="h-3 w-3" />
      </button>
      {btn(FOCAL_STEP, 0, 'Pan right', ArrowRight)}
      <div className={visualFocalCorner} aria-hidden />
      {btn(0, FOCAL_STEP, 'Pan down — show lower part of image', ArrowDown)}
      <div className={visualFocalCorner} aria-hidden />
    </div>
  )
}

function WidthStepper({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const current = Number.isFinite(value) && value > 0 ? value : 70
  const bump = (d: number) => onCommit(Math.max(30, Math.min(100, current + d)))
  return (
    <div className={cn(visualPanel, 'relative')} title="Image frame width (% of section)">
      <button type="button" className={visualStepperCell} onClick={() => bump(-WIDTH_STEP)} aria-label="Narrower">
        <Minus className="h-2.5 w-2.5" />
      </button>
      <span className={cn(visualStepperValue, 'min-w-[2rem]')}>{current}%</span>
      <button type="button" className={visualStepperCell} onClick={() => bump(WIDTH_STEP)} aria-label="Wider">
        <Plus className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

function HeightStepper({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const current = Number.isFinite(value) && value > 0 ? value : 640
  const bump = (d: number) => onCommit(Math.max(280, Math.min(1200, current + d)))
  return (
    <div className={cn(visualPanel, 'relative')} title="Panel height">
      <button type="button" className={visualStepperCell} onClick={() => bump(-HEIGHT_STEP)} aria-label="Decrease height">
        <Minus className="h-2.5 w-2.5" />
      </button>
      <span className={visualStepperValue}>{current}</span>
      <button type="button" className={visualStepperCell} onClick={() => bump(HEIGHT_STEP)} aria-label="Increase height">
        <Plus className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

function ZoomStepper({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const current = Number.isFinite(value) ? value : 100
  const bump = (d: number) => onCommit(Math.max(25, Math.min(400, current + d)))
  return (
    <div className={cn(visualPanel, 'relative')} title="Image zoom">
      <button type="button" className={visualStepperCell} onClick={() => bump(-ZOOM_STEP)} aria-label="Zoom out">
        <ZoomOut className="h-2.5 w-2.5" />
      </button>
      <span className={cn(visualStepperValue, 'min-w-[1.75rem]')}>{current}%</span>
      <button type="button" className={visualStepperCell} onClick={() => bump(ZOOM_STEP)} aria-label="Zoom in">
        <ZoomIn className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

function DecorStepper({
  icon,
  title,
  value,
  suffix,
  min,
  max,
  step,
  onCommit,
}: {
  icon: React.ReactNode
  title: string
  value: number
  suffix?: string
  min: number
  max: number
  step: number
  onCommit: (n: number) => void
}) {
  const bump = (d: number) => onCommit(Math.max(min, Math.min(max, value + d)))
  return (
    <div className={cn(visualPanel, 'relative')} title={title}>
      <span className={cn(VISUAL_TAB_ROW_H, 'flex w-6 shrink-0 items-center justify-center border-r text-gray-500', DESIGN_BAR_SOFT_INNER_BORDER)}>
        {icon}
      </span>
      <button type="button" className={visualStepperCell} onClick={() => bump(-step)} aria-label={`Decrease ${title}`}>
        <Minus className="h-2.5 w-2.5" />
      </button>
      <span className={cn(visualStepperValue, 'min-w-[1.75rem]')}>{value}{suffix}</span>
      <button type="button" className={visualStepperCell} onClick={() => bump(step)} aria-label={`Increase ${title}`}>
        <Plus className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

export function SectionImageControls({
  imageField,
  blockProps,
  blockType,
  arraySlot,
  arraySlots,
  onUpdate,
}: {
  imageField: string
  blockProps: Record<string, unknown>
  blockType: string
  /** When set, zoom / pan / fit apply only to this card / gallery slot. */
  arraySlot?: CanvasImageArraySlot | null
  /** Multi-select — toolbar applies to every slot in the list. */
  arraySlots?: CanvasImageArraySlot[]
  onUpdate: (patch: Record<string, unknown>) => void
}) {
  const resolvedSlots = arraySlots?.length ? arraySlots : arraySlot ? [arraySlot] : []
  const primarySlot = resolvedSlots[0]
  const styleSource = primarySlot
    ? readArrayItemImageStyleProps(
        readArrayItemFromBlockProps(blockProps, primarySlot.arrayKey, primarySlot.index),
        blockProps,
        imageField,
      )
    : blockProps
  const styleField = primarySlot ? 'image_url' : imageField
  const keys = sectionImageStyleKeys(styleField)
  const fit = readSectionImageFit(styleField, styleSource)
  const focal = readSectionImageFocal(styleField, styleSource)
  const zoom = readSectionImageScale(styleField, styleSource)
  const panelHeight = Number(blockProps.min_height) || 640
  const showPanelHeight = !primarySlot && blockType.includes('hero') && imageField === 'image_url'
  const showShapedWidth = !primarySlot
    && blockType === 'about_split'
    && blockProps.layout === 'shaped'
    && imageField === 'image_url'
  const shapedWidth = Number.isFinite(Number(blockProps.shaped_width)) && Number(blockProps.shaped_width) > 0
    ? Number(blockProps.shaped_width) : 70

  const applyPatch = (patch: Record<string, unknown>) => {
    if (resolvedSlots.length > 1) {
      onUpdate(patchMultipleArrayItemImageStyles(blockProps, resolvedSlots, patch))
      return
    }
    if (primarySlot) {
      onUpdate(patchArrayItemImageStyle(blockProps, primarySlot.arrayKey, primarySlot.index, patch))
      return
    }
    onUpdate(patch)
  }

  const setFit = (next: SectionImageFit) => applyPatch({ [keys.fit]: next })
  const nudgeFocal = (dx: number, dy: number) => {
    applyPatch({
      [keys.focalX]: Math.min(100, Math.max(0, focal.x + dx)),
      [keys.focalY]: Math.min(100, Math.max(0, focal.y + dy)),
    })
  }

  const centerFocal = () => {
    applyPatch({ [keys.focalX]: 50, [keys.focalY]: 50 })
  }

  // Corners + opacity + shadow apply to per-card images too — shadow is applied to the
  // card's frame (see arrayItemImageFrameStyle), so it renders even though the frame is
  // `overflow-hidden`. Gradient overlay + Front/Back layering stay whole-section only:
  // they need a full-bleed backing image, which a small card thumbnail is not.
  const isCard = !!primarySlot
  const decorKeys = sectionImageDecorKeys(styleField)
  const radius = readSectionImageRadius(styleField, styleSource)
  const shadow = readSectionImageShadow(styleField, styleSource)
  const opacity = readSectionImageOpacity(styleField, styleSource)
  const layer = readSectionImageLayer(styleField, styleSource)
  const overlay = readSectionImageOverlay(styleField, styleSource)
  const showShadow = true
  const showOverlay = !isCard
  // Background images already sit behind content — layering only matters for side images.
  const showLayer = !isCard && styleField === 'image_url'

  return (
    <div className="flex items-stretch gap-0.5">
      <FocalPad onNudge={nudgeFocal} onCenter={centerFocal} />
      <div className="flex flex-col justify-center gap-0.5">
      <div className={visualRow}>
        <ZoomStepper
          value={zoom}
          onCommit={n => applyPatch({ [keys.scale]: n })}
        />
        <div className={visualSegmentTrack} role="group" aria-label="Image fit">
          {(['cover', 'contain', 'fill'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              className={visualSegmentBtn(fit === mode)}
              onClick={() => setFit(mode)}
            >
              {mode === 'cover' ? 'Cover' : mode === 'contain' ? 'Fit' : 'Fill'}
            </button>
          ))}
        </div>
        {showPanelHeight ? (
          <HeightStepper
            value={panelHeight}
            onCommit={n => onUpdate({ min_height: n })}
          />
        ) : null}
        {showShapedWidth ? (
          <WidthStepper
            value={shapedWidth}
            onCommit={n => onUpdate({ shaped_width: n })}
          />
        ) : null}
      </div>

      <div className={visualRow}>
          <DecorStepper
            icon={<Square className="h-3 w-3 rounded-[3px]" />}
            title="Corner radius"
            value={radius}
            suffix=""
            min={0}
            max={96}
            step={RADIUS_STEP}
            onCommit={n => applyPatch({ [decorKeys.radius]: n })}
          />
          {showShadow ? (
          <div className={visualSegmentTrack} role="group" aria-label="Image shadow">
            {SHADOW_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                title={opt.title}
                className={visualSegmentBtn(shadow === opt.value)}
                onClick={() => applyPatch({ [decorKeys.shadow]: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
          ) : null}
          <DecorStepper
            icon={<span className="text-[9px] font-bold leading-none">◧</span>}
            title="Image opacity"
            value={opacity}
            suffix="%"
            min={10}
            max={100}
            step={OPACITY_STEP}
            onCommit={n => applyPatch({ [decorKeys.opacity]: n })}
          />
          {showLayer ? (
            <div className={visualSegmentTrack} role="group" aria-label="Image layer">
              <span className={cn(VISUAL_TAB_ROW_H, 'flex w-6 shrink-0 items-center justify-center border-r text-gray-400', DESIGN_BAR_SOFT_INNER_BORDER)}>
                <Layers className="h-3 w-3" />
              </span>
              <button
                type="button"
                title="Bring image in front of text"
                className={visualSegmentBtn(layer === 'front')}
                onClick={() => applyPatch({ [decorKeys.layer]: 'front' })}
              >
                Front
              </button>
              <button
                type="button"
                title="Send image behind text (text shows on top)"
                className={visualSegmentBtn(layer === 'back')}
                onClick={() => applyPatch({ [decorKeys.layer]: 'back' })}
              >
                Back
              </button>
            </div>
          ) : null}
          {showOverlay ? (
          <div className={cn(visualSegmentTrack, 'max-w-[min(100%,22rem)] flex-wrap')} role="group" aria-label="Gradient overlay">
            {OVERLAY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                title={opt.title}
                className={visualSegmentBtn(overlay === opt.value)}
                onClick={() => applyPatch({ [decorKeys.overlay]: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
