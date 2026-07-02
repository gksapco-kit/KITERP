import { cn } from '@/lib/utils'
import { IntegrationLogoImage } from './integrationLogos'

export type CommunicationProviderId =
  | 'sendgrid'
  | 'smtp'
  | 'twilio'
  | 'meta_whatsapp'
  | 'openai'
  | 'google_calendar'
  | 'outlook_calendar'

type ProviderMeta = {
  title: string
  subtitle: string
  summary: string
  capabilityTags: string[]
  bannerClassName: string
}

const PROVIDERS: Record<CommunicationProviderId, ProviderMeta> = {
  sendgrid: {
    title: 'SendGrid',
    subtitle: 'Transactional email',
    summary: 'Deliver transactional and marketing email at scale',
    capabilityTags: ['Email', 'Templates', 'Analytics'],
    bannerClassName: 'bg-[#1A82E2]',
  },
  smtp: {
    title: 'SMTP',
    subtitle: 'Custom mail server',
    summary: 'Send email through your own SMTP server or relay',
    capabilityTags: ['Email', 'Custom host', 'Any provider'],
    bannerClassName: 'bg-[#475569]',
  },
  twilio: {
    title: 'Twilio',
    subtitle: 'SMS · WhatsApp · Voice',
    summary: 'Reach customers by SMS, WhatsApp and voice calls',
    capabilityTags: ['SMS', 'WhatsApp', 'Voice'],
    bannerClassName: 'bg-[#F22F46]',
  },
  meta_whatsapp: {
    title: 'Meta WhatsApp',
    subtitle: 'WhatsApp Cloud API',
    summary: 'Send WhatsApp messages through Meta Cloud API',
    capabilityTags: ['WhatsApp', 'Cloud API', 'Templates'],
    bannerClassName: 'bg-[#128C7E]',
  },
  openai: {
    title: 'OpenAI',
    subtitle: 'AI features',
    summary: 'Power AI-assisted CRM workflows and automations',
    capabilityTags: ['Chat', 'Completions', 'Assistants'],
    bannerClassName: 'bg-[#0D0D0D]',
  },
  google_calendar: {
    title: 'Google Calendar',
    subtitle: 'Calendar sync',
    summary: 'Sync meetings and events with Google Calendar',
    capabilityTags: ['Calendar', 'Events', 'Two-way sync'],
    bannerClassName: 'bg-[#4285F4]',
  },
  outlook_calendar: {
    title: 'Outlook Calendar',
    subtitle: 'Calendar sync',
    summary: 'Sync meetings and events with Microsoft Outlook',
    capabilityTags: ['Calendar', 'Events', 'Microsoft 365'],
    bannerClassName: 'bg-[#0078D4]',
  },
}

export function CommunicationProviderBanner({
  provider,
  className,
}: {
  provider: string
  className?: string
}) {
  const meta = PROVIDERS[provider as CommunicationProviderId]
  if (!meta) {
    return (
      <div className={cn('flex h-8 items-center justify-center bg-muted px-2', className)}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{provider}</span>
      </div>
    )
  }

  return (
    <div className={cn('flex h-8 w-full items-center justify-start px-3', meta.bannerClassName, className)}>
      <IntegrationLogoImage providerId={provider} alt={meta.title} />
    </div>
  )
}

export function communicationProviderMeta(provider: string): {
  title: string
  subtitle: string
  summary: string
  capabilityTags: string[]
} {
  const meta = PROVIDERS[provider as CommunicationProviderId]
  if (!meta) {
    return { title: provider, subtitle: '', summary: 'Integration provider', capabilityTags: [] }
  }
  return {
    title: meta.title,
    subtitle: meta.subtitle,
    summary: meta.summary,
    capabilityTags: meta.capabilityTags,
  }
}
