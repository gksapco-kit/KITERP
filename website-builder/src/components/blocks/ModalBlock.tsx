import { useEffect, useState } from 'react'
import { Bell, Gift, Mail, Percent, Sparkles, X } from 'lucide-react'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import { MODAL_DEFAULTS } from '../../lib/modalDefaults'
import {
  MODAL_ICON_STYLES,
  modalBackdropStyle,
  modalPanelStyle,
  modalPrimaryButtonStyle,
  type ModalIcon,
  type ModalLayout,
} from '../../lib/modalStyles'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { Block } from '../../types/builder'

const ICON_MAP = {
  gift: Gift,
  sparkles: Sparkles,
  bell: Bell,
  percent: Percent,
  mail: Mail,
} as const

interface ModalBlockProps {
  block: Block
  interactive?: boolean
  onNavigate?: (slug: string) => void
}

function ModalBody({
  block,
  layout,
  iconKey,
  showSecondary,
  showClose,
  onClose,
  interactive,
  onNavigate,
}: {
  block: Block
  layout: ModalLayout
  iconKey: ModalIcon
  showSecondary: boolean
  showClose: boolean
  onClose?: () => void
  interactive?: boolean
  onNavigate?: (slug: string) => void
}) {
  const pages = useBuilderStore((s) => s.pages)
  const { props, styles } = block
  const iconTheme = iconKey !== 'none' ? MODAL_ICON_STYLES[iconKey] : null
  const Icon = iconKey !== 'none' ? ICON_MAP[iconKey] : null
  const primaryStyle = modalPrimaryButtonStyle(
    styles,
    iconTheme?.gradient ?? 'linear-gradient(135deg, #4f46e5, #7c3aed)',
  )

  const linkHandler = createLinkClickHandler({
    interactive: !!interactive,
    link: props.buttonLink ?? '#',
    pages,
    onNavigate,
  })

  const primaryClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    linkHandler(e as unknown as React.MouseEvent<HTMLAnchorElement>)
    if (interactive) onClose?.()
  }

  const secondaryClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClose?.()
  }

  return (
    <>
      {layout === 'sheet' && (
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200 dark:bg-gray-700" aria-hidden />
      )}

      {Icon && iconTheme && (
        <span
          className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm"
          style={{ backgroundColor: iconTheme.iconBg, color: iconTheme.accent }}
        >
          <Icon className="h-7 w-7" aria-hidden />
        </span>
      )}

      {props.text && (
        <h2 id={`modal-title-${block.id}`} className="pr-8 text-xl font-bold tracking-tight sm:text-2xl">
          {props.text}
        </h2>
      )}
      {props.subtitle && (
        <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{props.subtitle}</p>
      )}

      <div className={`mt-6 flex flex-col gap-2.5 sm:flex-row ${layout === 'sheet' ? 'sm:flex-col' : ''}`}>
        <button
          type="button"
          onClick={primaryClick}
          style={primaryStyle}
          className="inline-flex flex-1 items-center justify-center px-5 py-3 text-sm font-semibold shadow-md transition hover:opacity-90 hover:shadow-lg"
        >
          {props.buttonText ?? 'Continue'}
        </button>
        {showSecondary && (
          <button
            type="button"
            onClick={secondaryClick}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {props.buttonText2 ?? 'Cancel'}
          </button>
        )}
      </div>

      {showClose && onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </>
  )
}

function ModalPanel({
  block,
  onClose,
  showClose,
  interactive,
  onNavigate,
}: {
  block: Block
  onClose?: () => void
  showClose: boolean
  interactive?: boolean
  onNavigate?: (slug: string) => void
}) {
  const { props, styles } = block
  const layout = (props.modalLayout ?? MODAL_DEFAULTS.modalLayout) as ModalLayout
  const iconKey = (props.modalIcon ?? MODAL_DEFAULTS.modalIcon) as ModalIcon
  const showSecondary = props.showModalSecondary !== false
  const iconTheme = iconKey !== 'none' ? MODAL_ICON_STYLES[iconKey] : null
  const panelStyle = modalPanelStyle(styles, layout)

  if (layout === 'split' && props.imageUrl) {
    return (
      <div style={panelStyle} className="mx-auto overflow-hidden">
        <div className="relative flex flex-col sm:flex-row">
          <div className="relative aspect-[16/10] shrink-0 sm:aspect-auto sm:w-[44%]">
            <img src={props.imageUrl} alt={props.imageAlt ?? ''} className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-black/10" />
          </div>
          <div className="relative flex flex-1 flex-col justify-center p-6 sm:p-8">
            <ModalBody
              block={block}
              layout={layout}
              iconKey={iconKey}
              showSecondary={showSecondary}
              showClose={showClose}
              onClose={onClose}
              interactive={interactive}
              onNavigate={onNavigate}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
      <div style={panelStyle} className="relative mx-auto">
      {layout !== 'glass' && iconTheme && (
        <div className="absolute inset-x-0 top-0 h-1 rounded-t-[inherit]" style={{ background: iconTheme.gradient }} aria-hidden />
      )}
      <div className="p-6 sm:p-8">
        <ModalBody
          block={block}
          layout={layout}
          iconKey={iconKey}
          showSecondary={showSecondary}
          showClose={showClose}
          onClose={onClose}
          interactive={interactive}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  )
}

export function ModalBlock({ block, interactive, onNavigate }: ModalBlockProps) {
  const autoShow = block.props.modalAutoShow !== false
  const showBackdrop = block.props.showModalBackdrop !== false
  const backdropBlur = block.props.modalBackdropBlur !== false
  const overlayOpacity = block.props.modalOverlayOpacity ?? MODAL_DEFAULTS.modalOverlayOpacity
  const layout = (block.props.modalLayout ?? MODAL_DEFAULTS.modalLayout) as ModalLayout
  const showClose = block.props.showModalClose !== false
  const triggerText = block.props.modalTriggerText ?? MODAL_DEFAULTS.modalTriggerText
  const [open, setOpen] = useState(autoShow)

  useEffect(() => {
    if (!interactive || !autoShow) return
    setOpen(true)
  }, [interactive, autoShow, block.props.text, block.props.subtitle, block.props.modalLayout, block.props.modalIcon])

  useEffect(() => {
    if (!interactive || !open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [interactive, open])

  const close = () => {
    if (interactive) setOpen(false)
  }

  const panel = (
    <ModalPanel
      block={block}
      showClose={showClose && !!interactive}
      onClose={interactive ? close : undefined}
      interactive={interactive}
      onNavigate={onNavigate}
    />
  )

  if (interactive) {
    if (!open) {
      return (
        <div className="pointer-events-none h-0 overflow-visible" aria-hidden>
          <div className="pointer-events-auto fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(true)
              }}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 shadow-md hover:border-brand-300 hover:text-brand-600"
            >
              {triggerText}
            </button>
          </div>
        </div>
      )
    }

    const isSheet = layout === 'sheet'
    const alignClass = isSheet ? 'items-end sm:items-center' : 'items-center'

    return (
      <div className="pointer-events-none h-0 overflow-visible" aria-hidden>
        <div className={`pointer-events-auto fixed inset-0 z-50 flex justify-center p-4 sm:p-6 ${alignClass}`}>
          <style>{`
            @keyframes modalEnter {
              from { opacity: 0; transform: scale(0.96) translateY(8px); }
              to { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes sheetEnter {
              from { opacity: 0; transform: translateY(100%); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {showBackdrop && (
            <button
              type="button"
              className="absolute inset-0"
              style={modalBackdropStyle(overlayOpacity, backdropBlur)}
              onClick={(e) => {
                e.stopPropagation()
                if (showClose) close()
              }}
              aria-label="Close dialog backdrop"
            />
          )}

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`modal-title-${block.id}`}
            className={`relative z-10 w-full ${isSheet ? 'animate-[sheetEnter_0.35s_ease-out]' : 'animate-[modalEnter_0.3s_ease-out]'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {panel}
          </div>
        </div>
      </div>
    )
  }

  const layoutLabel =
    layout === 'classic'
      ? 'centered card'
      : layout === 'glass'
        ? 'frosted glass card'
        : layout === 'sheet'
          ? 'bottom sheet'
          : 'split image + content'

  return (
    <div className="w-full" style={{ margin: block.styles.margin }}>
      <div className="overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100/80 p-6 dark:border-gray-600 dark:from-gray-900/60 dark:to-gray-900/30">
        <div className="mx-auto flex max-w-full justify-center">
          <div className="w-full scale-[0.98]">{panel}</div>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-400">Opens as a {layoutLabel} overlay in preview and live site</p>
    </div>
  )
}
