import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { IntegrationIconImage, IntegrationLogoImage, integrationLogoPath } from './integrationLogos'
import {
  INTEGRATION_PROVIDER_BRAND_LOCKUP_CLASS,
  INTEGRATION_PROVIDER_ICON_INNER_CLASS,
  INTEGRATION_PROVIDER_ICON_SLOT_CLASS,
  INTEGRATION_PROVIDER_ICON_SLOT_LARGE_CLASS,
} from './IntegrationCardShared'

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
  accent: string
  iconBg: string
  icon: ReactNode
  /** When true, render PNG wordmark in the icon tile instead of SVG */
  useWordmarkImage?: boolean
  /** When true, render PNG brand icon in the icon tile instead of SVG */
  usePngIcon?: boolean
}

const TWILIO_ICON = (
  <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
    <circle cx="16" cy="16" r="16" fill="#F22F46" />
    <circle cx="11.5" cy="11.5" r="3" fill="#FFFFFF" />
    <circle cx="20.5" cy="11.5" r="3" fill="#FFFFFF" />
    <circle cx="11.5" cy="20.5" r="3" fill="#FFFFFF" />
    <circle cx="20.5" cy="20.5" r="3" fill="#FFFFFF" />
  </svg>
)

const SENDGRID_ICON = (
  <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
    <rect width="32" height="32" rx="6" fill="#1A82E2" />
    <path fill="#FFFFFF" d="M8 22 L16 10 L16 22 Z" opacity="0.95" />
    <path fill="#99CCFF" d="M14 22 L22 10 L22 22 Z" />
  </svg>
)

const WHATSAPP_ICON = (
  <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
    <circle cx="16" cy="16" r="16" fill="#128C7E" />
    <path
      fill="#FFFFFF"
      d="M16 6a10 10 0 0 0-8.66 15l-1.34 4.9 5.05-1.32A10 10 0 1 0 16 6zm0 2a8 8 0 0 1 6.93 12.02l-.35.2-.2.35-.72 2.64-2.64.69-.35-.2A8 8 0 1 1 16 8zm-2.2 4.5c-.12 0-.28.04-.42.2-.14.16-1.12 1.1-1.12 2.68 0 1.58 1.14 3.1 1.3 3.32.16.22 2.2 3.54 5.38 4.82 2.66 1.06 3.2.85 3.78.8.58-.06 1.88-.77 2.14-1.52.26-.74.26-1.38.18-1.52-.08-.14-.3-.22-.64-.38-.34-.16-2.02-.98-2.34-1.1-.32-.12-.56-.18-.8.18-.24.36-.92 1.1-1.12 1.32-.2.22-.42.26-.76.08-.34-.16-1.44-.53-2.74-1.7-1.02-.9-1.7-2.02-1.9-2.36-.2-.34-.02-.52.14-.68.14-.14.32-.36.48-.54.16-.18.22-.3.32-.5.1-.2.06-.38-.02-.54-.08-.16-.72-1.74-.98-2.38-.26-.62-.52-.54-.8-.54z"
    />
  </svg>
)

const OPENAI_ICON = (
  <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
    <rect width="32" height="32" rx="6" fill="#0D0D0D" />
    <path
      fill="#FFFFFF"
      d="M16 8.5c3.2 0 5.8 2.1 6.7 5.1-.9.4-1.6 1-2.1 1.8-.5-.8-1.3-1.4-2.3-1.7v4.8c2.5.7 4.3 3 4.3 5.7 0 3.3-2.7 6-6 6s-6-2.7-6-6c0-2.7 1.8-5 4.3-5.7v-4.8c-1 .3-1.8.9-2.3 1.7-.5-.8-1.2-1.4-2.1-1.8.9-3 3.5-5.1 6.7-5.1zm0 11.2c-1.8 0-3.2 1.4-3.2 3.2s1.4 3.2 3.2 3.2 3.2-1.4 3.2-3.2-1.4-3.2-3.2-3.2z"
    />
  </svg>
)

const GOOGLE_CALENDAR_ICON = (
  <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
    <rect x="4" y="6" width="24" height="22" rx="3" fill="#FFFFFF" stroke="#DADCE0" strokeWidth="0.6" />
    <path fill="#4285F4" d="M4 9.25C4 7.46 5.46 6 7.25 6h17.5C26.54 6 28 7.46 28 9.25V12H4V9.25Z" />
    <rect x="9" y="3.5" width="2" height="5.5" rx="1" fill="#70757A" />
    <rect x="21" y="3.5" width="2" height="5.5" rx="1" fill="#70757A" />
    <text
      x="16"
      y="22.5"
      textAnchor="middle"
      fill="#3C4043"
      fontSize="11"
      fontWeight="700"
      fontFamily="Roboto, 'Google Sans', Arial, sans-serif"
    >
      31
    </text>
  </svg>
)

const OUTLOOK_ICON = (
  <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
    <rect width="32" height="32" rx="6" fill="#0078D4" />
    <rect x="7" y="9" width="12" height="14" rx="1.5" fill="#FFFFFF" opacity="0.95" />
    <path fill="#0078D4" d="M10 13h6v1.5H10V13zm0 3h6v1.5H10V16zm0 3h4v1.5h-4V19z" />
    <path fill="#28A8EA" d="M19 11h6c1.1 0 2 .9 2 2v6c0 1.1-.9 2-2 2h-6V11z" opacity="0.9" />
  </svg>
)

const SMTP_ICON = (
  <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
    <rect width="32" height="32" rx="6" fill="#475569" />
    <path
      fill="#FFFFFF"
      d="M6 11h20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm0 2.8 10 6.2 10-6.2V13L16 19.2 6 13v-.2z"
    />
  </svg>
)

const PROVIDERS: Record<CommunicationProviderId, ProviderMeta> = {
  sendgrid: {
    title: 'SendGrid',
    subtitle: 'Transactional email',
    summary: 'Deliver transactional and marketing email at scale',
    capabilityTags: ['Email', 'Templates', 'Analytics'],
    accent: '#1A82E2',
    iconBg: 'bg-transparent',
    icon: SENDGRID_ICON,
  },
  smtp: {
    title: 'SMTP',
    subtitle: 'Custom mail server',
    summary: 'Send email through your own SMTP server or relay',
    capabilityTags: ['Email', 'Custom host', 'Any provider'],
    accent: '#475569',
    iconBg: 'bg-transparent',
    icon: SMTP_ICON,
  },
  twilio: {
    title: 'Twilio',
    subtitle: 'SMS · WhatsApp · Voice',
    summary: 'Reach customers by SMS, WhatsApp and voice calls',
    capabilityTags: ['SMS', 'WhatsApp', 'Voice'],
    accent: '#F22F46',
    iconBg: 'bg-transparent',
    icon: TWILIO_ICON,
  },
  meta_whatsapp: {
    title: 'WhatsApp',
    subtitle: 'WhatsApp Cloud API',
    summary: 'Send WhatsApp messages through Meta Cloud API',
    capabilityTags: ['WhatsApp', 'Cloud API', 'Templates'],
    accent: '#128C7E',
    iconBg: 'bg-transparent',
    icon: WHATSAPP_ICON,
    usePngIcon: true,
  },
  openai: {
    title: 'OpenAI',
    subtitle: 'AI features',
    summary: 'Power AI-assisted CRM workflows and automations',
    capabilityTags: ['Chat', 'Completions', 'Assistants'],
    accent: '#0D0D0D',
    iconBg: 'bg-transparent',
    icon: OPENAI_ICON,
  },
  google_calendar: {
    title: 'Google Calendar',
    subtitle: 'Calendar sync',
    summary: 'Sync meetings and events with Google Calendar',
    capabilityTags: ['Calendar', 'Events', 'Two-way sync'],
    accent: '#4285F4',
    iconBg: 'bg-transparent',
    icon: GOOGLE_CALENDAR_ICON,
  },
  outlook_calendar: {
    title: 'Outlook Calendar',
    subtitle: 'Calendar sync',
    summary: 'Sync meetings and events with Microsoft Outlook',
    capabilityTags: ['Calendar', 'Events', 'Microsoft 365'],
    accent: '#0078D4',
    iconBg: 'bg-transparent',
    icon: OUTLOOK_ICON,
  },
}

/** Brand icon at h-8 (2rem), used beside the provider name. */
export function CommunicationProviderIcon({
  providerId,
  className,
  large = false,
}: {
  providerId: CommunicationProviderId
  className?: string
  large?: boolean
}) {
  const meta = PROVIDERS[providerId]
  const wordmarkSrc = integrationLogoPath(providerId)
  const slotClass = large ? INTEGRATION_PROVIDER_ICON_SLOT_LARGE_CLASS : INTEGRATION_PROVIDER_ICON_SLOT_CLASS

  if (meta.usePngIcon) {
    return (
      <div className={cn(slotClass, meta.iconBg, className)} aria-hidden>
        <IntegrationIconImage
          providerId={providerId}
          fallback={<div className={INTEGRATION_PROVIDER_ICON_INNER_CLASS}>{meta.icon}</div>}
          className="size-full object-contain"
        />
      </div>
    )
  }

  if (meta.useWordmarkImage && wordmarkSrc) {
    return (
      <div className={cn(slotClass, meta.iconBg, className)}>
        <IntegrationLogoImage
          providerId={providerId}
          alt={meta.title}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    )
  }

  return (
    <div className={cn(slotClass, meta.iconBg, className)} aria-hidden>
      <div className={INTEGRATION_PROVIDER_ICON_INNER_CLASS}>{meta.icon}</div>
    </div>
  )
}

/** Icon + provider name, matching payment processor row layout. */
export function CommunicationProviderBrandLockup({
  providerId,
  className,
  hideIcon = false,
}: {
  providerId: CommunicationProviderId
  className?: string
  /** When true, only the label is shown (icon rendered elsewhere, e.g. card-centered). */
  hideIcon?: boolean
}) {
  const meta = PROVIDERS[providerId]

  return (
    <div
      className={cn(
        hideIcon ? 'flex shrink-0 items-center pl-12' : INTEGRATION_PROVIDER_BRAND_LOCKUP_CLASS,
        className,
      )}
    >
      {!hideIcon ? <CommunicationProviderIcon providerId={providerId} /> : null}
      <span className="whitespace-nowrap text-sm font-semibold leading-tight text-foreground">{meta.title}</span>
    </div>
  )
}

/** @deprecated use CommunicationProviderBrandLockup */
export function CommunicationProviderBanner({
  provider,
  className,
}: {
  provider: string
  className?: string
}) {
  const id = provider as CommunicationProviderId
  if (!PROVIDERS[id]) {
    return (
      <div className={cn('flex h-8 items-center justify-center bg-muted px-2', className)}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{provider}</span>
      </div>
    )
  }

  return <CommunicationProviderBrandLockup providerId={id} className={className} />
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

export function communicationProviderBrandColor(provider: string): string {
  return PROVIDERS[provider as CommunicationProviderId]?.accent ?? '#64748b'
}

export function communicationProviderLabel(provider: string): string {
  return PROVIDERS[provider as CommunicationProviderId]?.title ?? provider
}

const CENTERED_LOGO_PROVIDER_IDS = new Set<CommunicationProviderId>(['google_calendar', 'meta_whatsapp'])

export function communicationUsesCenteredLogo(providerId: CommunicationProviderId): boolean {
  return CENTERED_LOGO_PROVIDER_IDS.has(providerId)
}
