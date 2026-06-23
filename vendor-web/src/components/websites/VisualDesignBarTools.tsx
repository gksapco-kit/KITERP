import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { registerEscapeHandler } from '@/lib/escapeCloseRegistry'
import {
  BG_STYLE_OPTIONS,
  SHADOW_PRESETS,
  SHAPE_OPTIONS,
} from '@/lib/builderVisualPresets'
import { DesignBarDropdownPortal } from '@/components/websites/DesignBarDropdownPortal'
import { InsertLayerButton } from '@/components/websites/InsertLayerButton'
import { ScrollAnimationControls } from '@/components/websites/ScrollAnimationControls'
import { OverlayLayerVisualControls } from '@/components/websites/OverlayLayerVisualControls'
import { OverlayIconsRibbonButton } from '@/components/websites/OverlayIconPicker'
import { VisualsDesignBarMenu } from '@/components/websites/MediaDesignBarTools'
import {
  visualMenuTrigger,
  visualSectionRow,
  visualTabMenuTrigger,
  visualTabShell,
  visualTabShellLayer,
  visualToolbarRow,
  visualToolbarRowWrap,
} from '@/components/websites/designBarVisualUi'
import { animationOptionLabel } from '@storefront/lib/builderScrollAnimations'
import { sectionSupportsBgStyle, sectionSupportsEdgeShapes } from '@storefront/lib/designBarCapabilities'
import type { OverlayLayerItem } from '@/lib/builderOverlayVisual'
import type { OverlayBox } from '@/lib/overlayAlignmentSnap'
import type { BlockProps } from '@/types/websites'

type VisualDropdown = 'insert' | 'icons' | 'anim' | 'origins' | 'shadow' | 'background' | null

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
        visualTabMenuTrigger(active || open, accent),
        open && 'ring-1 ring-primary/30',
      )}
    >
      {icon ?? <span className="w-3 shrink-0" aria-hidden />}
      <span>{label}</span>
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
  overlayCount,
  selectedOverlay,
  overlaySiblings,
  overlayContainerWidth,
  overlayContainerHeight,
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
  primaryImageField,
  canvasImageField,
  onSectionImagePick,
  onSectionImageLibrary,
  onFocusPrimaryImage,
}: {
  blockType: string
  blockProps: Record<string, unknown>
  blockAnimation?: string | null
  blockAnimationDelay?: number
  overlayCount: number
  selectedOverlay?: OverlayLayerItem | null
  overlaySiblings?: OverlayBox[]
  overlayContainerWidth?: number
  overlayContainerHeight?: number
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
  primaryImageField?: string | null
  canvasImageField?: string | null
  onSectionImagePick?: () => void
  onSectionImageLibrary?: () => void
  onFocusPrimaryImage?: () => void
}) {
  const p = blockProps
  const showEdgeShapes = sectionSupportsEdgeShapes(blockType)
  const showBgStyle = sectionSupportsBgStyle(blockType)
  const [openMenu, setOpenMenu] = useState<VisualDropdown>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const iconsBtnRef = useRef<HTMLButtonElement>(null)
  const animBtnRef = useRef<HTMLButtonElement>(null)
  const originsBtnRef = useRef<HTMLButtonElement>(null)
  const shadowBtnRef = useRef<HTMLButtonElement>(null)
  const bgBtnRef = useRef<HTMLButtonElement>(null)

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

  const iconsControl = (
    <OverlayIconsRibbonButton
      btnRef={iconsBtnRef}
      active={selectedIsIcon}
      open={openMenu === 'icons'}
      onToggle={() => toggle('icons')}
      selectedIconId={selectedIsIcon ? selectedOverlay?.iconName : null}
      onPickIcon={handlePickIcon}
      visualTab
    />
  )

  const quickInsertStrip = (
    <>
      <InsertLayerButton
        overlayCount={overlayCount}
        onAddOverlay={onAddOverlay}
        onClearOverlays={onClearOverlays}
        visualTab
      />
      {!selectedIsIcon ? iconsControl : null}
    </>
  )

  const visualsMenu = (
    <VisualsDesignBarMenu
      blockType={blockType}
      blockProps={p}
      primaryImageField={primaryImageField}
      canvasImageField={canvasImageField}
      selectedOverlay={selectedOverlay}
      onUpdate={onUpdate}
      onPickImage={onSectionImagePick}
      onOpenMediaLibrary={onSectionImageLibrary}
      onFocusPrimaryImage={onFocusPrimaryImage}
      onOverlayPickImage={onOverlayPickImage}
      onOverlayOpenLibrary={onOverlayOpenLibrary}
      onOverlaySetImageUrl={onOverlaySetImageUrl}
      visualTab
    />
  )

  const sectionMenus = !hasLayer ? (
    <div className={visualSectionRow}>
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
      ) : null}
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
      ) : null}
    </div>
  ) : null

  return (
    <>
      <div className={hasLayer ? visualTabShellLayer : visualTabShell}>
        {hasLayer ? (
          <OverlayLayerVisualControls
            leading={(
              <>
                {quickInsertStrip}
                {visualsMenu}
              </>
            )}
            item={selectedOverlay!}
            blockBackgroundColor={blockBackgroundColor}
            onUpdate={onUpdateOverlay!}
            onBringToFront={onOverlayBringToFront}
            onSendToBack={onOverlaySendToBack}
            onEditLink={onOverlayEditLink}
            onEditText={onOverlayEditText}
            onEditDescription={onOverlayEditDescription}
            siblings={overlaySiblings}
            containerWidth={overlayContainerWidth}
            containerHeight={overlayContainerHeight}
          />
        ) : (
          <div className={visualToolbarRow}>
            {quickInsertStrip}
            {visualsMenu}
            {sectionMenus}
          </div>
        )}
      </div>

      {/* Dropdowns (portalled) */}
      <DesignBarDropdownPortal
        open={openMenu === 'anim'}
        anchorRef={animBtnRef}
        menuRef={menuRef}
        className="bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl p-2 w-[14rem] max-h-[90vh] overflow-y-auto"
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
        className="bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl p-2 w-[15rem] max-h-[90vh] overflow-y-auto"
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
        className="bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl p-2 w-[13rem] max-h-[90vh] overflow-y-auto"
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
          className="bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl p-2 w-[11rem]"
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
    </>
  )
}
