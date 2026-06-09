import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Layers, Plus, Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { registerEscapeHandler } from '@/lib/escapeCloseRegistry'
import {
  BG_STYLE_OPTIONS,
  SHADOW_PRESETS,
  SHAPE_OPTIONS,
  VISUAL_INSERT_TYPES,
} from '@/lib/builderVisualPresets'
import { MediaClipPicker, mediaClipActiveLabel } from '@/components/websites/MediaClipPicker'
import { DesignBarDropdownPortal } from '@/components/websites/DesignBarDropdownPortal'
import { ScrollAnimationControls } from '@/components/websites/ScrollAnimationControls'
import { OverlayLayerVisualControls } from '@/components/websites/OverlayLayerVisualControls'
import { OverlayIconsRibbonButton } from '@/components/websites/OverlayIconPicker'
import {
  visualMenuTrigger,
  visualSectionGrid,
  visualTabShell,
} from '@/components/websites/designBarVisualUi'
import { animationOptionLabel } from '@storefront/lib/builderScrollAnimations'
import { sectionSupportsBgStyle, sectionSupportsEdgeShapes, sectionSupportsMediaClip } from '@storefront/lib/designBarCapabilities'
import type { OverlayLayerItem } from '@/lib/builderOverlayVisual'
import type { BlockProps } from '@/types/websites'

type VisualDropdown = 'insert' | 'icons' | 'clips' | 'anim' | 'origins' | 'shadow' | 'background' | null

function SectionMenuBtn({
  btnRef,
  title,
  active,
  accent,
  onClick,
  open,
  icon,
  label,
  badge,
}: {
  btnRef: React.RefObject<HTMLButtonElement>
  title: string
  active: boolean
  accent?: 'blue' | 'emerald'
  onClick: () => void
  open: boolean
  icon?: React.ReactNode
  label: string
  badge?: string | number | null
}) {
  return (
    <button
      ref={btnRef}
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        visualMenuTrigger(active || open, accent),
        open && 'ring-1 ring-primary/30',
      )}
    >
      {icon ?? <span className="w-3 shrink-0" aria-hidden />}
      <span className="min-w-0 flex-1 truncate text-center">{label}</span>
      {badge != null && badge !== '' ? (
        <span className="rounded-full bg-primary/15 px-0.5 text-[7px] font-black text-primary">{badge}</span>
      ) : null}
      <ChevronDown className={cn('h-2.5 w-2.5 shrink-0 opacity-60', open && 'rotate-180')} />
    </button>
  )
}

export function VisualDesignBarTools({
  blockType,
  blockProps,
  blockAnimation,
  blockAnimationDelay,
  blockSupportsMediaClip: blockSupportsMediaClipProp,
  overlayCount,
  selectedOverlay,
  blockBackgroundColor,
  onUpdate,
  onUpdateOverlay,
  onAddOverlay,
  onClearOverlays,
  onOverlayPickImage,
  onOverlayOpenLibrary,
  onOverlaySetImageUrl,
  onOverlayEditLink,
  onOverlayEditText,
  onOverlayEditDescription,
  onOverlayBringToFront,
  onOverlaySendToBack,
}: {
  blockType: string
  blockProps: Record<string, unknown>
  blockAnimation?: string | null
  blockAnimationDelay?: number
  blockSupportsMediaClip?: boolean
  overlayCount: number
  selectedOverlay?: OverlayLayerItem | null
  blockBackgroundColor?: string
  onUpdate: (patch: Partial<BlockProps>) => void
  onUpdateOverlay?: (patch: Partial<OverlayLayerItem>) => void
  onAddOverlay: (type: string, anchor?: { x: number; y: number }, patch?: Partial<OverlayLayerItem>) => void
  onClearOverlays: () => void
  onOverlayPickImage?: () => void
  onOverlayOpenLibrary?: () => void
  onOverlaySetImageUrl?: () => void
  onOverlayEditLink?: () => void
  onOverlayEditText?: () => void
  onOverlayEditDescription?: () => void
  onOverlayBringToFront?: () => void
  onOverlaySendToBack?: () => void
}) {
  const p = blockProps
  const showMediaClip = blockSupportsMediaClipProp ?? sectionSupportsMediaClip(blockType)
  const showEdgeShapes = sectionSupportsEdgeShapes(blockType)
  const showBgStyle = sectionSupportsBgStyle(blockType)
  const [openMenu, setOpenMenu] = useState<VisualDropdown>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const insertBtnRef = useRef<HTMLButtonElement>(null)
  const iconsBtnRef = useRef<HTMLButtonElement>(null)
  const clipsBtnRef = useRef<HTMLButtonElement>(null)
  const animBtnRef = useRef<HTMLButtonElement>(null)
  const originsBtnRef = useRef<HTMLButtonElement>(null)
  const shadowBtnRef = useRef<HTMLButtonElement>(null)
  const bgBtnRef = useRef<HTMLButtonElement>(null)

  const activeMediaClipLabel = mediaClipActiveLabel((p as any).media_clip)
  const clipShort = activeMediaClipLabel ? activeMediaClipLabel.split(/\s+/)[0] : null
  const clipLabel = clipShort && clipShort.length <= 6 ? clipShort : 'Clips'
  const hasOrigins =
    ((p as any).top_shape && (p as any).top_shape !== 'none')
    || ((p as any).bottom_shape && (p as any).bottom_shape !== 'none')
  const shadowLabel =
    SHADOW_PRESETS.find(sh => sh.value === ((p as any).block_shadow ?? 'none'))?.label ?? 'None'
  const bgStyleLabel = String((p as any).bg_style || 'minimal')
  const hasActiveEffect = Boolean(blockAnimation && blockAnimation !== 'none')
  const effectShort = hasActiveEffect
    ? animationOptionLabel(blockAnimation!).split(/\s+/)[0]
    : 'Effects'

  const toggle = (menu: VisualDropdown) => {
    setOpenMenu(prev => (prev === menu ? null : menu))
  }

  const closeAll = () => setOpenMenu(null)

  useEffect(() => {
    if (!openMenu) return
    return registerEscapeHandler(closeAll)
  }, [openMenu])

  const hasLayer = Boolean(selectedOverlay && onUpdateOverlay)
  const selectedIsIcon = selectedOverlay?.type === 'icon'

  const handlePickIcon = (iconId: string) => {
    if (selectedIsIcon && onUpdateOverlay) {
      onUpdateOverlay({ iconName: iconId })
      return
    }
    onAddOverlay('icon', undefined, { iconName: iconId })
  }

  const insertControl = (
    <SectionMenuBtn
      btnRef={insertBtnRef}
      title="Insert visual element"
      active={overlayCount > 0}
      onClick={() => toggle('insert')}
      open={openMenu === 'insert'}
      icon={<Plus className="h-3 w-3 shrink-0" />}
      label="Ins"
      badge={overlayCount > 0 ? overlayCount : null}
    />
  )

  const iconsControl = (
    <OverlayIconsRibbonButton
      btnRef={iconsBtnRef}
      active={selectedIsIcon}
      open={openMenu === 'icons'}
      onToggle={() => toggle('icons')}
      selectedIconId={selectedIsIcon ? selectedOverlay?.iconName : null}
      onPickIcon={handlePickIcon}
    />
  )

  const quickInsertStrip = (
    <div className="flex shrink-0 items-center gap-0.5 border-r border-gray-200 pr-1">
      {insertControl}
      {iconsControl}
    </div>
  )

  const sectionGrid = (
    <>
      {quickInsertStrip}
      <div className={visualSectionGrid}>
      {showMediaClip ? (
        <SectionMenuBtn
          btnRef={clipsBtnRef}
          title={activeMediaClipLabel ? `Clips: ${activeMediaClipLabel}` : 'Clip shapes'}
          active={Boolean((p as any).media_clip)}
          accent="emerald"
          onClick={() => toggle('clips')}
          open={openMenu === 'clips'}
          icon={<Layers className="h-3 w-3 shrink-0" />}
          label={clipLabel}
        />
      ) : (
        <span className="h-7 w-[3.1rem] shrink-0" aria-hidden />
      )}
      <SectionMenuBtn
        btnRef={animBtnRef}
        title="Scroll effects"
        active={hasActiveEffect}
        accent="blue"
        onClick={() => toggle('anim')}
        open={openMenu === 'anim'}
        icon={<Zap className="h-3 w-3 shrink-0" />}
        label={effectShort}
      />
      {showEdgeShapes ? (
        <SectionMenuBtn
          btnRef={originsBtnRef}
          title="Edge shapes"
          active={hasOrigins}
          accent="emerald"
          onClick={() => toggle('origins')}
          open={openMenu === 'origins'}
          icon={
            <svg viewBox="0 0 20 10" className="h-2.5 w-3 shrink-0 fill-current">
              <path d="M0,10 C5,0 10,10 15,3 C17,1 18,5 20,4 L20,10 Z" />
            </svg>
          }
          label="Origins"
        />
      ) : (
        <span className="h-7 w-[3.1rem] shrink-0" aria-hidden />
      )}
      <SectionMenuBtn
        btnRef={shadowBtnRef}
        title="Shadow & glow"
        active={Boolean((p as any).block_shadow && (p as any).block_shadow !== 'none')}
        onClick={() => toggle('shadow')}
        open={openMenu === 'shadow'}
        icon={<Sparkles className="h-3 w-3 shrink-0" />}
        label={shadowLabel === 'None' ? 'Shadow' : shadowLabel}
      />
      {showBgStyle ? (
        <SectionMenuBtn
          btnRef={bgBtnRef}
          title="Background style"
          active={Boolean(bgStyleLabel && bgStyleLabel !== 'minimal')}
          onClick={() => toggle('background')}
          open={openMenu === 'background'}
          label={bgStyleLabel ? `Bg ${bgStyleLabel}` : 'Bg'}
        />
      ) : (
        <span className="h-7 w-[3.1rem] shrink-0" aria-hidden />
      )}
      </div>
    </>
  )

  return (
    <div className={visualTabShell}>
      {sectionGrid}

      {hasLayer ? (
        <OverlayLayerVisualControls
          item={selectedOverlay!}
          blockBackgroundColor={blockBackgroundColor}
          onUpdate={onUpdateOverlay!}
          onBringToFront={onOverlayBringToFront}
          onSendToBack={onOverlaySendToBack}
          onPickLocalImage={onOverlayPickImage}
          onOpenMediaLibrary={onOverlayOpenLibrary}
          onSetImageUrl={onOverlaySetImageUrl}
          onEditLink={onOverlayEditLink}
          onEditText={onOverlayEditText}
          onEditDescription={onOverlayEditDescription}
        />
      ) : null}

      {/* Dropdowns (portalled) */}
      <DesignBarDropdownPortal
        open={openMenu === 'insert'}
        anchorRef={insertBtnRef}
        menuRef={menuRef}
        className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden w-[17rem] max-h-[90vh] overflow-y-auto"
      >
        <div className="px-2.5 py-2 bg-accent border-b border-primary/20">
          <div className="text-[11px] font-bold text-primary">Insert layer</div>
        </div>
        <div className="grid grid-cols-3 gap-1 p-1.5">
          {VISUAL_INSERT_TYPES.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              title={label}
              onMouseDown={e => {
                e.stopPropagation()
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                onAddOverlay(type, { x: rect.right + 8, y: rect.top })
                closeAll()
              }}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-1 py-2 text-center transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <span className="text-base leading-none">{label.split(' ')[0]}</span>
              <span className="text-[9px] font-semibold leading-tight text-gray-700 line-clamp-2">
                {label.slice(label.indexOf(' ') + 1)}
              </span>
            </button>
          ))}
        </div>
        {overlayCount > 0 ? (
          <div className="flex items-center justify-between border-t border-gray-100 px-2.5 py-1.5">
            <span className="text-[10px] text-gray-500">{overlayCount} layer{overlayCount !== 1 ? 's' : ''}</span>
            <button
              type="button"
              onMouseDown={e => {
                e.stopPropagation()
                onClearOverlays()
                closeAll()
              }}
              className="text-[10px] font-semibold text-red-500 hover:text-red-600"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </DesignBarDropdownPortal>

      {showMediaClip ? (
        <DesignBarDropdownPortal
          open={openMenu === 'clips'}
          anchorRef={clipsBtnRef}
          menuRef={menuRef}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl p-2 w-[min(20rem,92vw)] max-h-[min(20rem,70vh)] overflow-y-auto overscroll-contain"
        >
          <MediaClipPicker
            compact
            value={(p as any).media_clip}
            onChange={clip => {
              onUpdate({ media_clip: clip } as Partial<BlockProps>)
              closeAll()
            }}
          />
        </DesignBarDropdownPortal>
      ) : null}

      <DesignBarDropdownPortal
        open={openMenu === 'anim'}
        anchorRef={animBtnRef}
        menuRef={menuRef}
        className="bg-white border border-gray-200 rounded-xl shadow-2xl p-2 w-[14rem] max-h-[90vh] overflow-y-auto"
      >
        <ScrollAnimationControls
          variant="compact"
          animation={blockAnimation}
          animationDelay={blockAnimationDelay || 0}
          onAnimationChange={id => onUpdate({ animation: id === 'none' ? null : id } as Partial<BlockProps>)}
          onDelayChange={ms => onUpdate({ animation_delay: ms } as Partial<BlockProps>)}
        />
      </DesignBarDropdownPortal>

      <DesignBarDropdownPortal
        open={openMenu === 'origins'}
        anchorRef={originsBtnRef}
        menuRef={menuRef}
        className="bg-white border border-gray-200 rounded-xl shadow-2xl p-2 w-[15rem] max-h-[90vh] overflow-y-auto"
      >
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Top</div>
        <div className="mb-2 grid grid-cols-3 gap-1">
          {SHAPE_OPTIONS.map(({ id, label }) => (
            <button
              key={`top-${id}`}
              type="button"
              onClick={() => onUpdate({ top_shape: id === 'none' ? null : id } as Partial<BlockProps>)}
              className={cn(
                'rounded-md border py-1.5 text-[10px] font-semibold transition-colors',
                ((p as any).top_shape || 'none') === id
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 text-gray-600 hover:border-primary/40 hover:bg-accent',
              )}
            >
              {label.split(' ').slice(1).join(' ') || 'None'}
            </button>
          ))}
        </div>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">Bottom</div>
        <div className="mb-2 grid grid-cols-3 gap-1">
          {SHAPE_OPTIONS.map(({ id, label }) => (
            <button
              key={`bot-${id}`}
              type="button"
              onClick={() => onUpdate({ bottom_shape: id === 'none' ? null : id } as Partial<BlockProps>)}
              className={cn(
                'rounded-md border py-1.5 text-[10px] font-semibold transition-colors',
                ((p as any).bottom_shape || 'none') === id
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 text-gray-600 hover:border-primary/40 hover:bg-accent',
              )}
            >
              {label.split(' ').slice(1).join(' ') || 'None'}
            </button>
          ))}
        </div>
        {hasOrigins ? (
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            <input
              type="color"
              value={(p as any).shape_color || '#ffffff'}
              onChange={e => onUpdate({ shape_color: e.target.value } as Partial<BlockProps>)}
              className="h-7 w-8 cursor-pointer rounded border border-gray-200 p-0.5"
            />
            <span className="text-[10px] text-gray-600">Shape fill</span>
          </div>
        ) : null}
      </DesignBarDropdownPortal>

      <DesignBarDropdownPortal
        open={openMenu === 'shadow'}
        anchorRef={shadowBtnRef}
        menuRef={menuRef}
        className="bg-white border border-gray-200 rounded-xl shadow-2xl p-2 w-[13rem] max-h-[90vh] overflow-y-auto"
      >
        <div className="grid grid-cols-2 gap-1">
          {SHADOW_PRESETS.map(sh => (
            <button
              key={sh.label}
              type="button"
              title={sh.label}
              onClick={() => {
                onUpdate({ block_shadow: sh.value } as Partial<BlockProps>)
                closeAll()
              }}
              className={cn(
                'rounded-md border py-2 text-[10px] font-bold transition-all',
                ((p as any).block_shadow ?? 'none') === sh.value
                  ? 'border-primary bg-accent text-primary'
                  : 'border-gray-200 text-gray-600 hover:border-primary/40',
              )}
              style={{ boxShadow: sh.value === 'none' ? undefined : sh.value }}
            >
              {sh.label}
            </button>
          ))}
        </div>
      </DesignBarDropdownPortal>

      {showBgStyle ? (
        <DesignBarDropdownPortal
          open={openMenu === 'background'}
          anchorRef={bgBtnRef}
          menuRef={menuRef}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl p-2 w-[11rem]"
        >
          <div className="grid grid-cols-2 gap-1">
            {BG_STYLE_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onUpdate({ bg_style: opt.id } as Partial<BlockProps>)
                  closeAll()
                }}
                className={cn(
                  'rounded-md border py-1.5 text-[10px] font-semibold transition-colors',
                  String((p as any).bg_style || 'minimal') === opt.id
                    ? 'border-primary bg-accent text-primary'
                    : 'border-gray-200 text-gray-600 hover:border-primary/40',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </DesignBarDropdownPortal>
      ) : null}
    </div>
  )
}
