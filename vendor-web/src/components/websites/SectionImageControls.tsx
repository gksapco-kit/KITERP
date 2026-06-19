import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  ImageIcon,
  Layers,
  Minus,
  Plus,
  Square,
  Upload,
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
  visualActionBtn,
  visualPanel,
  visualRow,
  visualSegmentBtn,
  visualSegmentTrack,
  visualStepperCell,
  visualStepperValue,
} from '@/components/websites/designBarVisualUi'

const FOCAL_STEP = 5
const HEIGHT_STEP = 40
const ZOOM_STEP = 10
const RADIUS_STEP = 4
const OPACITY_STEP = 10

const SHADOW_OPTIONS: { value: SectionImageShadow; label: string; title: string }[] = [
  { value: 'none', label: '✕', title: 'No shadow' },
  { value: 'sm', label: 'S', title: 'Small shadow' },
  { value: 'md', label: 'M', title: 'Medium shadow' },
  { value: 'lg', label: 'L', title: 'Large shadow' },
  { value: 'xl', label: 'XL', title: 'Extra large shadow' },
]

const OVERLAY_OPTIONS: { value: SectionImageOverlay; label: string; title: string }[] = [
  { value: 'none', label: 'Off', title: 'No gradient overlay' },
  { value: 'dark-bottom', label: 'Btm', title: 'Dark fade from bottom (best for captions)' },
  { value: 'top-fade', label: 'Top', title: 'Dark fade from top' },
  { value: 'dark-full', label: 'Dim', title: 'Even dark wash' },
  { value: 'brand', label: 'Brand', title: 'Brand color gradient' },
]

const FOCAL_CELL =
  'flex h-5 w-5 shrink-0 items-center justify-center border-r border-b border-gray-200 text-gray-600 transition-colors hover:bg-primary/10 hover:text-primary'

const FOCAL_EMPTY = 'h-5 w-5 shrink-0 border-r border-b border-gray-200 bg-gray-50/40'

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
      className={FOCAL_CELL}
      onMouseDown={stopBarBubble}
      onClick={() => onNudge(dx, dy)}
    >
      <Icon className="h-2.5 w-2.5" />
    </button>
  )

  return (
    <div
      className="grid shrink-0 grid-cols-3 grid-rows-3 overflow-hidden rounded-md border border-gray-200 bg-white"
      role="group"
      aria-label="Image focal point"
    >
      <div className={FOCAL_EMPTY} aria-hidden />
      {btn(0, -FOCAL_STEP, 'Pan up — show upper part of image', ArrowUp)}
      <div className={FOCAL_EMPTY} aria-hidden />
      {btn(-FOCAL_STEP, 0, 'Pan left', ArrowLeft)}
      <button
        type="button"
        title="Center image in frame"
        className={cn(FOCAL_CELL, 'bg-white text-primary hover:bg-primary/10')}
        onMouseDown={stopBarBubble}
        onClick={onCenter}
      >
        <Crosshair className="h-3 w-3" />
      </button>
      {btn(FOCAL_STEP, 0, 'Pan right', ArrowRight)}
      <div className={FOCAL_EMPTY} aria-hidden />
      {btn(0, FOCAL_STEP, 'Pan down — show lower part of image', ArrowDown)}
      <div className={cn(FOCAL_EMPTY, 'border-b-0 border-r-0')} aria-hidden />
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
      <span className="flex h-6 w-5 shrink-0 items-center justify-center border-r border-gray-200 text-gray-500">
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
  onPickImage,
  onOpenLibrary,
}: {
  imageField: string
  blockProps: Record<string, unknown>
  blockType: string
  /** When set, zoom / pan / fit apply only to this card / gallery slot. */
  arraySlot?: CanvasImageArraySlot | null
  /** Multi-select — toolbar applies to every slot in the list. */
  arraySlots?: CanvasImageArraySlot[]
  onUpdate: (patch: Record<string, unknown>) => void
  onPickImage?: () => void
  onOpenLibrary?: () => void
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
    <div className="flex items-stretch gap-px">
      <FocalPad onNudge={nudgeFocal} onCenter={centerFocal} />
      <div className="flex flex-col justify-center gap-px">
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
        {onPickImage ? (
          <button type="button" title="Upload image" onClick={onPickImage} className={cn(visualActionBtn('sky'), 'gap-1 px-1.5')}>
            <Upload className="h-3 w-3 shrink-0" />
            <span className="text-[8px]">Up</span>
          </button>
        ) : null}
        {onOpenLibrary ? (
          <button type="button" title="Media library" onClick={onOpenLibrary} className={cn(visualActionBtn('emerald'), 'gap-1 px-1.5')}>
            <ImageIcon className="h-3 w-3 shrink-0" />
            <span className="text-[8px]">Lib</span>
          </button>
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
              <span className="flex items-center px-1 text-gray-400">
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
          <div className={visualSegmentTrack} role="group" aria-label="Gradient overlay">
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
