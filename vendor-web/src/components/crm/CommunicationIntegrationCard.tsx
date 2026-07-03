import { Settings2, Unplug } from 'lucide-react'
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
  INTEGRATION_ROW_CONFIGURE_BTN_CLASS,
  INTEGRATION_ROW_CONNECT_BTN_CLASS,
  INTEGRATION_ROW_DISCONNECT_BTN_CLASS,
  INTEGRATION_ROW_MAIN_CLASS,
} from './IntegrationCardShared'
import {
  CommunicationProviderBrandLockup,
  CommunicationProviderIcon,
  communicationProviderBrandColor,
  communicationProviderLabel,
  communicationUsesCenteredLogo,
  type CommunicationProviderId,
} from './CommunicationProviderLogo'

export const COMMUNICATION_INTEGRATION_GRID_CLASS =
  'grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3'

type Props = {
  providerId: CommunicationProviderId
  label: string
  conn?: Integration
  onConnect: () => void
  onDelete: () => void
}

export function CommunicationIntegrationCard({
  providerId,
  label,
  conn,
  onConnect,
  onDelete,
}: Props) {
  const isConnected = conn?.status === 'connected'
  const hasWarning = Boolean(conn && conn.status !== 'connected')
  const accent = communicationProviderBrandColor(providerId)
  const title = communicationProviderLabel(providerId) || label
  const isCenteredLogo = communicationUsesCenteredLogo(providerId)

  const warningLabel = hasWarning ? conn!.status.replace(/_/g, ' ') : null

  return (
    <article
      className={cn(
        INTEGRATION_ROW_CARD_HEIGHT,
        INTEGRATION_ROW_CARD_CLASS,
        isConnected && 'border-emerald-500/20',
        hasWarning && 'border-amber-500/25',
        !conn && 'border-border/70',
      )}
      title={conn?.last_error}
    >
      <div className="w-1 shrink-0 self-stretch rounded-l-lg" style={{ backgroundColor: accent }} aria-hidden />

      {isCenteredLogo ? (
        <div className={cn(INTEGRATION_ROW_CENTERED_LOGO_CLASS, 'w-12')} aria-hidden>
          <CommunicationProviderIcon providerId={providerId} large />
        </div>
      ) : null}

      <div className={INTEGRATION_ROW_BODY_CLASS}>
        <div className={INTEGRATION_ROW_MAIN_CLASS}>
          <CommunicationProviderBrandLockup providerId={providerId} hideIcon={isCenteredLogo} />

          {isConnected && (
            <div className="hidden shrink-0 items-center gap-1 sm:flex">
              <Badge variant="success" className={INTEGRATION_ROW_BADGE_CLASS}>
                Enabled
              </Badge>
              <Badge variant="success" className={cn(INTEGRATION_ROW_BADGE_CLASS, 'hidden md:inline-flex')}>
                Connected
              </Badge>
            </div>
          )}

          {hasWarning && warningLabel && (
            <Badge variant="warning" className={cn(INTEGRATION_ROW_BADGE_CLASS, 'shrink-0 capitalize')}>
              {warningLabel}
            </Badge>
          )}
        </div>

        <div className={INTEGRATION_ROW_ACTIONS_CLASS}>
          {conn ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className={INTEGRATION_ROW_DISCONNECT_BTN_CLASS}
                title={`Disconnect ${title}`}
                onClick={onDelete}
              >
                <Unplug className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Disconnect
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={INTEGRATION_ROW_CONFIGURE_BTN_CLASS}
                title={`Configure ${title}`}
                onClick={onConnect}
              >
                <Settings2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Configure
              </Button>
            </>
          ) : (
            <Button size="sm" className={INTEGRATION_ROW_CONNECT_BTN_CLASS} onClick={onConnect}>
              Connect
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
