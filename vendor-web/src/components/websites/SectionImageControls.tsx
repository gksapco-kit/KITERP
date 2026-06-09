import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  ImageIcon,
  Minus,
  Plus,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  readSectionImageFit,
  readSectionImageFocal,
  readSectionImageScale,
  sectionImageStyleKeys,
  type SectionImageFit,
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

const FOCAL_CELL =
  'flex h-6 w-6 shrink-0 items-center justify-center border-r border-b border-gray-200 text-gray-600 transition-colors hover:bg-primary/10 hover:text-primary'

const FOCAL_EMPTY = 'h-6 w-6 shrink-0 border-r border-b border-gray-200 bg-gray-50/40'

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
      <Icon className="h-3 w-3" />
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
        <Crosshair className="h-3.5 w-3.5" />
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

export function SectionImageControls({
  imageField,
  blockProps,
  blockType,
  onUpdate,
  onPickImage,
  onOpenLibrary,
}: {
  imageField: string
  blockProps: Record<string, unknown>
  blockType: string
  onUpdate: (patch: Record<string, unknown>) => void
  onPickImage?: () => void
  onOpenLibrary?: () => void
}) {
  const keys = sectionImageStyleKeys(imageField)
  const fit = readSectionImageFit(imageField, blockProps)
  const focal = readSectionImageFocal(imageField, blockProps)
  const zoom = readSectionImageScale(imageField, blockProps)
  const panelHeight = Number(blockProps.min_height) || 640
  const showPanelHeight = blockType.includes('hero') && imageField === 'image_url'

  const setFit = (next: SectionImageFit) => onUpdate({ [keys.fit]: next })
  const nudgeFocal = (dx: number, dy: number) => {
    onUpdate({
      [keys.focalX]: Math.min(100, Math.max(0, focal.x + dx)),
      [keys.focalY]: Math.min(100, Math.max(0, focal.y + dy)),
    })
  }

  const centerFocal = () => {
    onUpdate({ [keys.focalX]: 50, [keys.focalY]: 50 })
  }

  return (
    <div className="flex flex-col gap-px">
      <div className={visualRow}>
        <FocalPad onNudge={nudgeFocal} onCenter={centerFocal} />
        <ZoomStepper
          value={zoom}
          onCommit={n => onUpdate({ [keys.scale]: n })}
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
    </div>
  )
}
