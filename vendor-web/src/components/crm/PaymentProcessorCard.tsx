import type { Integration } from '@/api/crm'
import { PaymentProviderBanner, paymentProviderMeta, type PaymentProviderId } from './PaymentProviderLogo'
import {
  IntegrationActivateButton,
  IntegrationCardActionRow,
  IntegrationCardBody,
  IntegrationCardContent,
  IntegrationCardNotice,
  IntegrationCardShell,
  IntegrationCardSummary,
  IntegrationConnectActionRow,
  IntegrationDeactivateButton,
  IntegrationDeleteIconButton,
  IntegrationSettingsIconButton,
  IntegrationStatusRow,
  IntegrationTagList,
} from './IntegrationCardShared'

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
  onDelete,
}: Props) {
  const meta = paymentProviderMeta(providerId)

  const statusLabel = isConnected ? 'Connected' : 'Not connected'
  const statusTone = isConnected ? 'connected' : 'disconnected'

  const notice = conn?.last_error
    ?? (activateBlocked && isConnected
      ? `Deactivate ${activeProviderLabel} first`
      : undefined)

  return (
    <IntegrationCardShell connected={isConnected} highlighted={isLive}>
      <PaymentProviderBanner provider={providerId} isLive={isLive} className="shrink-0 rounded-none" />

      <IntegrationCardBody>
        <IntegrationCardContent>
          <h3 className="sr-only">{meta.label || label}</h3>

          <IntegrationStatusRow tone={statusTone} label={statusLabel} />

          <IntegrationCardSummary>{meta.summary}</IntegrationCardSummary>
          <IntegrationTagList tags={meta.regionTags} max={2} />
          <IntegrationCardNotice>{notice}</IntegrationCardNotice>
        </IntegrationCardContent>

        {!isConnected ? (
          <IntegrationConnectActionRow onClick={onConnect} />
        ) : (
          <IntegrationCardActionRow
            primary={
              <>
                <IntegrationActivateButton
                  active={!isLive && !activateBlocked}
                  disabled={busy || isLive || activateBlocked}
                  busy={busy && !isLive}
                  title={
                    activateBlocked
                      ? `Deactivate ${activeProviderLabel} before activating another gateway`
                      : `Activate ${meta.label || label} on checkout`
                  }
                  onClick={onActivate}
                />
                <IntegrationDeactivateButton
                  active={isLive}
                  disabled={busy || !isLive}
                  busy={busy && isLive}
                  title={`Deactivate ${meta.label || label} on checkout`}
                  onClick={onDeactivate}
                />
              </>
            }
            secondary={<IntegrationSettingsIconButton onClick={onConnect} />}
            tertiary={<IntegrationDeleteIconButton onClick={onDelete} />}
          />
        )}
      </IntegrationCardBody>
    </IntegrationCardShell>
  )
}
