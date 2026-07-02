import type { Integration } from '@/api/crm'
import {
  CommunicationProviderBanner,
  communicationProviderMeta,
  type CommunicationProviderId,
} from './CommunicationProviderLogo'
import {
  IntegrationCardActionRow,
  IntegrationCardBody,
  IntegrationCardContent,
  IntegrationCardNotice,
  IntegrationCardShell,
  IntegrationCardSummary,
  IntegrationConfigureButton,
  IntegrationConnectActionRow,
  IntegrationDeleteIconButton,
  IntegrationStatusRow,
  IntegrationTagList,
} from './IntegrationCardShared'

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
  const meta = communicationProviderMeta(providerId)
  const isConnected = conn?.status === 'connected'
  const hasWarning = conn && conn.status !== 'connected'

  const statusLabel = isConnected
    ? 'Connected'
    : hasWarning
      ? conn.status.replace(/_/g, ' ')
      : 'Not connected'

  return (
    <IntegrationCardShell connected={isConnected}>
      <CommunicationProviderBanner provider={providerId} className="shrink-0 rounded-none" />

      <IntegrationCardBody>
        <IntegrationCardContent>
          <h3 className="sr-only">{meta.title || label}</h3>

          <IntegrationStatusRow
            tone={isConnected ? 'connected' : hasWarning ? 'warning' : 'disconnected'}
            label={statusLabel}
          />

          <IntegrationCardSummary>{meta.summary}</IntegrationCardSummary>
          <IntegrationTagList tags={meta.capabilityTags} max={3} />
          <IntegrationCardNotice>{conn?.last_error}</IntegrationCardNotice>
        </IntegrationCardContent>

        {conn ? (
          <IntegrationCardActionRow
            primary={<IntegrationConfigureButton onClick={onConnect} />}
            tertiary={<IntegrationDeleteIconButton onClick={onDelete} title="Disconnect integration" />}
          />
        ) : (
          <IntegrationConnectActionRow onClick={onConnect} />
        )}
      </IntegrationCardBody>
    </IntegrationCardShell>
  )
}
