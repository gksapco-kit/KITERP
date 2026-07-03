import { Loader2, Plug, Settings2, Unplug } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Integration } from '@/api/crm'
import { cn } from '@/lib/utils'
import {
  INTEGRATION_ROW_ACTIONS_CLASS,
  INTEGRATION_ROW_BADGE_CLASS,
  INTEGRATION_ROW_BODY_CLASS,
  INTEGRATION_ROW_CARD_CLASS,
  INTEGRATION_ROW_CARD_HEIGHT,
  INTEGRATION_ROW_CENTERED_LOGO_CLASS,
  INTEGRATION_ROW_ACTIVATE_BTN_CLASS,
  INTEGRATION_ROW_CONFIGURE_BTN_CLASS,
  INTEGRATION_ROW_CONNECT_BTN_CLASS,
  INTEGRATION_ROW_DISCONNECT_BTN_CLASS,
  INTEGRATION_ROW_MAIN_CLASS,
} from './IntegrationCardShared'
import {
  PaymentProviderBrandLockup,
  PaymentProviderIcon,
  paymentProviderBrandColor,
  paymentProviderLabel,
  type PaymentProviderId,
} from './PaymentProviderLogo'

export const PAYMENT_INTEGRATION_GRID_CLASS =
  'grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3'

type Props = {
  providerId: PaymentProviderId
  label: string
  conn?: Integration
  isConnected: boolean
  isLive: boolean
  activateBlocked: boolean
  activeProviderLabel?: string | null
  busy: boolean
  onConnect: () => void
  onActivate: () => void
  onDeactivate: () => void
  onDelete: () => void
}

export function PaymentProcessorCard({
  providerId,
  label,
  conn,
  isConnected,
  isLive,
  activateBlocked,
  activeProviderLabel,
  busy,
  onConnect,
  onActivate,
  onDeactivate,
}: Props) {
  const accent = paymentProviderBrandColor(providerId)
  const title = paymentProviderLabel(providerId) || label
  const isAmazon = providerId === 'amazon_payment_services'

  const notice = conn?.last_error
    ?? (activateBlocked && isConnected
      ? `Disconnect ${activeProviderLabel} first`
      : undefined)

  return (
    <article
      className={cn(
        INTEGRATION_ROW_CARD_HEIGHT,
        INTEGRATION_ROW_CARD_CLASS,
        isLive && 'border-primary/30 ring-1 ring-primary/10',
        isConnected && !isLive && 'border-emerald-500/20',
        !isConnected && 'border-border/70',
      )}
      title={notice}
    >
      <div className="w-1 shrink-0 self-stretch rounded-l-lg" style={{ backgroundColor: accent }} aria-hidden />

      {isAmazon ? (
        <div className={cn(INTEGRATION_ROW_CENTERED_LOGO_CLASS, 'w-11')} aria-hidden>
          <PaymentProviderIcon providerId={providerId} />
        </div>
      ) : null}

      <div className={INTEGRATION_ROW_BODY_CLASS}>
        <div className={INTEGRATION_ROW_MAIN_CLASS}>
          <PaymentProviderBrandLockup providerId={providerId} hideIcon={isAmazon} />

          {isConnected && (
            <div className="hidden shrink-0 items-center gap-1 sm:flex">
              <Badge variant="success" className={INTEGRATION_ROW_BADGE_CLASS}>
                Enabled
              </Badge>
              {isLive ? (
                <Badge variant="success" className={cn(INTEGRATION_ROW_BADGE_CLASS, 'hidden md:inline-flex')}>
                  Activated
                </Badge>
              ) : (
                <Badge variant="warning" className={cn(INTEGRATION_ROW_BADGE_CLASS, 'hidden md:inline-flex')}>
                  Deactivated
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className={INTEGRATION_ROW_ACTIONS_CLASS}>
          {!isConnected ? (
            <Button size="sm" className={INTEGRATION_ROW_CONNECT_BTN_CLASS} onClick={onConnect}>
              Connect
            </Button>
          ) : isLive ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className={INTEGRATION_ROW_DISCONNECT_BTN_CLASS}
                disabled={busy}
                title={`Disconnect ${title}`}
                onClick={onDeactivate}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Unplug className="h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
                Disconnect
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={INTEGRATION_ROW_CONFIGURE_BTN_CLASS}
                title="Configure integration"
                onClick={onConnect}
              >
                <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Configure
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className={INTEGRATION_ROW_ACTIVATE_BTN_CLASS}
                disabled={busy || activateBlocked}
                title={
                  activateBlocked
                    ? `Disconnect ${activeProviderLabel} before activating another gateway`
                    : `Activate ${title}`
                }
                onClick={onActivate}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Plug className="h-3.5 w-3.5 shrink-0" aria-hidden />
                )}
                Activate
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={INTEGRATION_ROW_CONFIGURE_BTN_CLASS}
                title="Configure integration"
                onClick={onConnect}
              >
                <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Configure
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
