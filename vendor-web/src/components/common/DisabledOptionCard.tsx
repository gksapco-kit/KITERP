import type { ElementType, ReactNode, RefObject } from 'react'
import { cn } from '@/lib/utils'
import { useFieldHelpUi } from '@/lib/fieldHelpUi'

type Props = {
  active: boolean
  disabled: boolean
  title: string
  description: string
  /** Shown on hover and in the F1 help popup when disabled. */
  helpText: string
  icon?: ElementType
  onClick: () => void
  children?: ReactNode
}

export function DisabledOptionCard({
  active,
  disabled,
  title,
  description,
  helpText,
  icon: Icon,
  onClick,
  children,
}: Props) {
  const {
    anchorRef,
    hoverTooltip,
    helpDialog,
    handlePointerEnter,
    handlePointerLeave,
    handleClick,
  } = useFieldHelpUi({
    hoverHint: helpText,
    fullHelp: helpText,
    title,
    footerNote:
      'This option is locked by your current Customer store websites setting. Change that setting above to unlock it.',
    enabled: disabled,
  })

  return (
    <>
      <div
        ref={anchorRef}
        className={cn('relative', disabled && 'cursor-pointer')}
        onMouseEnter={handlePointerEnter}
        onMouseLeave={handlePointerLeave}
        onClick={disabled ? handleClick : undefined}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return
            onClick()
          }}
          aria-disabled={disabled}
          className={cn(
            'flex w-full flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-colors',
            active
              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
              : disabled
                ? 'pointer-events-none cursor-not-allowed border-border bg-muted/25 opacity-60'
                : 'border-border bg-background hover:bg-muted/40',
          )}
        >
          {children ?? (
            <>
              <span
                className={cn(
                  'flex items-center gap-1.5 text-xs font-semibold',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {Icon ? (
                  <Icon
                    className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground')}
                  />
                ) : null}
                {title}
              </span>
              <span className="text-[10px] leading-snug text-muted-foreground">{description}</span>
            </>
          )}
        </button>
      </div>
      {hoverTooltip}
      {helpDialog}
    </>
  )
}
