import type { ReactNode } from 'react'
import { Loader2, SlidersHorizontal, Trash2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const INTEGRATION_GRID_CLASS =
  'grid grid-cols-2 items-stretch gap-2 sm:grid-cols-3 lg:grid-cols-5'

/** Uniform height for every integration card (connected and unconnected). */
export const INTEGRATION_ROW_CARD_HEIGHT = 'h-[5.25rem]'

/** @deprecated use INTEGRATION_ROW_CARD_HEIGHT — all cards share the same height */
export const INTEGRATION_ROW_CARD_HEIGHT_WITH_ACTIONS = INTEGRATION_ROW_CARD_HEIGHT

export const INTEGRATION_ROW_CARD_CLASS =
  'relative flex overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md'

/** Card body: row 1 grows to fill space above the action row */
export const INTEGRATION_ROW_BODY_CLASS =
  'flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1 py-1.5 pl-3 pr-3'

export const INTEGRATION_ROW_MAIN_CLASS =
  'flex min-h-0 flex-1 items-center gap-2'

export const INTEGRATION_ROW_ACTIONS_CLASS =
  'flex shrink-0 items-center justify-end gap-1.5'

/** @deprecated use INTEGRATION_ROW_ACTIONS_CLASS */
export const INTEGRATION_ROW_FOOTER_ACTIONS_CLASS = INTEGRATION_ROW_ACTIONS_CLASS

/** Communication logos — same row fill inside the card. */
export const INTEGRATION_PROVIDER_ICON_SLOT_CLASS =
  'flex h-full max-h-10 w-10 shrink-0 items-center justify-center overflow-visible'

/** Larger centered card logo (e.g. Google Calendar). */
export const INTEGRATION_PROVIDER_ICON_SLOT_LARGE_CLASS =
  'flex h-12 w-12 shrink-0 items-center justify-center overflow-visible'

/** Payment logos — fill row 1 height inside the fixed card (max ~40px). */
export const PAYMENT_PROVIDER_ICON_SLOT_CLASS =
  'flex h-full max-h-10 w-10 shrink-0 items-center justify-center overflow-visible'

export const PAYMENT_PROVIDER_ICON_SLOT_AMAZON_CLASS =
  'flex h-11 w-11 shrink-0 items-center justify-center overflow-visible'

/** @deprecated use PAYMENT_PROVIDER_ICON_SLOT_AMAZON_CLASS */
export const PAYMENT_PROVIDER_ICON_SLOT_WIDE_CLASS = PAYMENT_PROVIDER_ICON_SLOT_AMAZON_CLASS

export const PAYMENT_PROVIDER_AMAZON_ICON_INNER_CLASS =
  'flex size-full items-center justify-center'

export const PAYMENT_PROVIDER_AMAZON_IMG_CLASS =
  'size-full max-w-none object-contain object-center'

export const INTEGRATION_PROVIDER_ICON_INNER_CLASS =
  'flex size-full items-center justify-center [&>svg]:size-full [&>svg]:max-h-full [&>svg]:max-w-full'

export const INTEGRATION_PROVIDER_BRAND_LOCKUP_CLASS =
  'flex shrink-0 items-center gap-2.5'

export const INTEGRATION_PROVIDER_BRAND_LOCKUP_AMAZON_CLASS =
  'flex shrink-0 items-center gap-2.5'

/** Absolutely positioned logo column — vertically centers icon in the card. */
export const INTEGRATION_ROW_CENTERED_LOGO_CLASS =
  'pointer-events-none absolute bottom-0 left-4 top-0 z-[1] flex items-center justify-center'

export const INTEGRATION_ROW_BADGE_CLASS =
  'inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[10px] font-medium leading-none'

export const INTEGRATION_ROW_ICON_BTN_CLASS = 'h-8 w-8 shrink-0 rounded-md'

export const INTEGRATION_ROW_TEXT_ACTION_CLASS =
  'hidden h-8 shrink-0 items-center whitespace-nowrap px-2 text-xs text-muted-foreground xl:inline-flex'

export const INTEGRATION_ROW_CONNECT_BTN_CLASS =
  'h-7 shrink-0 rounded-md px-4 text-xs font-semibold shadow-sm whitespace-nowrap'

/** Odoo-style primary action (Connect / Activate / Install) */
export const INTEGRATION_ROW_PRIMARY_ACTION_CLASS = INTEGRATION_ROW_CONNECT_BTN_CLASS

export const INTEGRATION_ROW_CONFIGURE_BTN_CLASS =
  'h-7 shrink-0 gap-1 rounded-md px-3 text-xs font-medium whitespace-nowrap'

/** Soft destructive — stays inside card on the action row */
export const INTEGRATION_ROW_DISCONNECT_BTN_CLASS =
  'h-7 shrink-0 gap-1 rounded-md px-3 text-xs font-medium whitespace-nowrap shadow-sm ' +
  'border border-red-200/80 bg-red-50 text-red-700 ' +
  'hover:border-red-300 hover:bg-red-100 hover:text-red-800 ' +
  'active:scale-[0.98] active:bg-red-100/90'

/** Pairs with Disconnect — same size/shape, green tint for Activate */
export const INTEGRATION_ROW_ACTIVATE_BTN_CLASS =
  'h-7 shrink-0 gap-1 rounded-md px-3 text-xs font-medium whitespace-nowrap shadow-sm ' +
  'border border-emerald-200/80 bg-emerald-50 text-emerald-800 ' +
  'hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-900 ' +
  'active:scale-[0.98] active:bg-emerald-100/90'

export const INTEGRATION_ROW_DISABLE_BTN_CLASS =
  'h-7 shrink-0 gap-1 rounded-md px-3 text-xs font-medium whitespace-nowrap shadow-sm ' +
  'border border-amber-200/80 bg-amber-50 text-amber-900 ' +
  'hover:border-amber-300 hover:bg-amber-100 hover:text-amber-950 ' +
  'active:scale-[0.98] active:bg-amber-100/90'

export const INTEGRATION_PILL_BUTTON_CLASS =
  'h-7 min-w-0 flex-1 rounded-full px-2 text-xs font-medium shadow-sm'

export const INTEGRATION_ICON_BUTTON_CLASS =
  'h-7 w-7 shrink-0 rounded-lg border border-border/80 bg-white p-0 shadow-sm'

/** Same 3-column footer grid on every card: primary | icon | icon */
const INTEGRATION_FOOTER_GRID =
  'mt-auto grid w-full grid-cols-[minmax(0,1fr)_1.75rem_1.75rem] items-center gap-1 border-t border-border/50 pt-1.5 min-h-8'

export function IntegrationCardShell({
  connected,
  highlighted,
  children,
  className,
}: {
  connected?: boolean
  highlighted?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <article
      className={cn(
        'group flex h-full min-h-[148px] flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200',
        'hover:border-border hover:shadow-md',
        connected && !highlighted && 'border-emerald-500/25 ring-1 ring-emerald-500/10',
        highlighted && 'border-primary/35 ring-1 ring-primary/15 shadow-md shadow-primary/5',
        !connected && !highlighted && 'border-border/60',
        className,
      )}
    >
      {children}
    </article>
  )
}

export function IntegrationStatusRow({
  tone,
  label,
  extra,
}: {
  tone: 'connected' | 'disconnected' | 'warning' | 'live'
  label: string
  extra?: ReactNode
}) {
  const dotClass = {
    connected: 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]',
    live: 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]',
    warning: 'bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.15)]',
    disconnected: 'bg-muted-foreground/35',
  }[tone]

  return (
    <div className="flex h-4 shrink-0 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass)} aria-hidden />
        <span className="truncate text-[11px] font-medium text-foreground/85">{label}</span>
      </div>
      {extra}
    </div>
  )
}

export function IntegrationTagList({ tags, max = 3 }: { tags: string[]; max?: number }) {
  const visible = tags.slice(0, max)
  const extra = tags.length - visible.length

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      {visible.map(tag => (
        <span
          key={tag}
          className="inline-flex rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {tag}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
          +{extra}
        </span>
      )}
    </div>
  )
}

export function IntegrationCardBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('flex min-h-0 flex-1 flex-col p-2', className)}>{children}</div>
}

export function IntegrationCardContent({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col gap-1">{children}</div>
}

export function IntegrationCardSummary({ children }: { children: ReactNode }) {
  return (
    <p className="line-clamp-1 text-[11px] leading-snug text-muted-foreground">{children}</p>
  )
}

export function IntegrationCardNotice({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="line-clamp-1 text-[10px] text-muted-foreground">{children}</p>
}

function IntegrationFooterSlot({ children }: { children?: ReactNode }) {
  return <div className="flex items-center justify-center">{children ?? <span className="inline-block h-7 w-7" aria-hidden />}</div>
}

/** Connected cards: primary pills + up to two icon buttons in fixed columns */
export function IntegrationCardActionRow({
  primary,
  secondary,
  tertiary,
}: {
  primary: ReactNode
  secondary?: ReactNode | null
  tertiary?: ReactNode | null
}) {
  return (
    <div className={INTEGRATION_FOOTER_GRID}>
      <div className="col-start-1 flex min-w-0 items-center gap-1">{primary}</div>
      <IntegrationFooterSlot>{secondary}</IntegrationFooterSlot>
      <IntegrationFooterSlot>{tertiary}</IntegrationFooterSlot>
    </div>
  )
}

/** Not connected: full-width Connect pill spanning all footer columns */
export function IntegrationConnectActionRow({ onClick }: { onClick: () => void }) {
  return (
    <div className={INTEGRATION_FOOTER_GRID}>
      <Button
        variant="default"
        size="sm"
        className="col-span-3 flex h-7 w-full max-w-none rounded-full text-xs font-medium shadow-sm"
        onClick={onClick}
      >
        <Zap className="h-3.5 w-3.5 shrink-0" />
        Connect
      </Button>
    </div>
  )
}

export function IntegrationConfigureButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(INTEGRATION_PILL_BUTTON_CLASS, 'w-full border-border/80 bg-white')}
      onClick={onClick}
    >
      <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
      Configure
    </Button>
  )
}

export function IntegrationSettingsIconButton({ onClick, title = 'Configure integration' }: { onClick: () => void; title?: string }) {
  return (
    <Button
      variant="outline"
      size="icon-sm"
      className={INTEGRATION_ICON_BUTTON_CLASS}
      title={title}
      onClick={onClick}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
    </Button>
  )
}

export function IntegrationDeleteIconButton({ onClick, title = 'Remove integration' }: { onClick: () => void; title?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="h-7 w-7 shrink-0 rounded-lg p-0 text-muted-foreground hover:bg-red-50 hover:text-red-600"
      title={title}
      onClick={onClick}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )
}

export function IntegrationActivateButton({
  active,
  disabled,
  busy,
  title,
  onClick,
}: {
  active?: boolean
  disabled?: boolean
  busy?: boolean
  title?: string
  onClick: () => void
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        INTEGRATION_PILL_BUTTON_CLASS,
        active
          ? 'border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700'
          : 'border-border/80 bg-muted/50 text-muted-foreground',
      )}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : null}
      Activate
    </Button>
  )
}

export function IntegrationDeactivateButton({
  active,
  disabled,
  busy,
  title,
  onClick,
}: {
  active?: boolean
  disabled?: boolean
  busy?: boolean
  title?: string
  onClick: () => void
}) {
  return (
    <Button
      variant={active ? 'cancel' : 'outline'}
      size="sm"
      className={cn(
        INTEGRATION_PILL_BUTTON_CLASS,
        !active && 'border-border/80 bg-muted/50 text-muted-foreground',
      )}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : null}
      Deactivate
    </Button>
  )
}
