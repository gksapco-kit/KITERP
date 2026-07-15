import { useMemo, useState } from 'react'
import {
  Monitor, Smartphone, Mail, Info, Play, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVendorStore } from '@/stores/vendorStore'
import { useAuthStore } from '@/stores/authStore'
import type { TemplateAttachment } from '@/api/crm'
import {
  formatRichMessageToHtml,
  headerAttachment,
  readTemplateSettings,
  resolveEmailBodyHtml,
  type TemplateSettings,
} from './marketingTemplateRich'

export type TemplatePreviewData = {
  name?: string
  subject: string
  body_html: string
  body_text?: string
  channel?: string
  attachments?: TemplateAttachment[]
  settings?: TemplateSettings | Record<string, unknown> | null
}

const SAMPLE_CONTACT = {
  first_name: 'Priya',
  last_name: 'Sharma',
  email: 'priya.sharma@example.com',
  company: 'Acme Industries',
}

export function renderTemplateMergeTags(text: string, vendorName?: string, userName?: string): string {
  if (!text) return ''
  const map: Record<string, string> = {
    '{{contact.first_name}}': SAMPLE_CONTACT.first_name,
    '{{contact.last_name}}': SAMPLE_CONTACT.last_name,
    '{{contact.email}}': SAMPLE_CONTACT.email,
    '{{contact.company}}': SAMPLE_CONTACT.company,
    '{{user.name}}': userName || 'Alex Kumar',
    '{{vendor.name}}': vendorName || 'Your Business',
  }
  let out = text
  for (const [tag, value] of Object.entries(map)) {
    out = out.split(tag).join(value)
  }
  return out
}

function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
}

const PREVIEW_CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'Email' },
  { id: 'sms', label: 'SMS' },
] as const

export type PreviewChannel = (typeof PREVIEW_CHANNELS)[number]['id']

export function PreviewChannelTabs({
  value, onChange, size = 'sm',
}: {
  value: string
  onChange: (v: PreviewChannel) => void
  size?: 'sm' | 'xs'
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {PREVIEW_CHANNELS.map(ch => (
        <button
          key={ch.id}
          type="button"
          onClick={() => onChange(ch.id)}
          className={cn(
            'rounded-md font-medium transition-colors whitespace-nowrap',
            size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
            value === ch.id
              ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200'
              : 'text-gray-500 hover:text-gray-800 hover:bg-white/60',
          )}
        >
          {ch.label}
        </button>
      ))}
    </div>
  )
}

function PreviewToolbar({
  view, onView, channel, sampleNote = true,
}: {
  view: 'desktop' | 'mobile'
  onView: (v: 'desktop' | 'mobile') => void
  channel: string
  sampleNote?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-1 rounded-lg border bg-white p-0.5">
        <button
          type="button"
          onClick={() => onView('desktop')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            view === 'desktop' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50',
          )}
        >
          <Monitor className="w-3.5 h-3.5" /> Desktop
        </button>
        <button
          type="button"
          onClick={() => onView('mobile')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            view === 'mobile' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50',
          )}
        >
          <Smartphone className="w-3.5 h-3.5" /> Mobile
        </button>
      </div>
      {sampleNote && (
        <p className="text-[11px] text-gray-500 flex items-center gap-1">
          <Info className="w-3 h-3 shrink-0" />
          {channel === 'whatsapp' ? 'WhatsApp marketing preview' : channel === 'sms' ? 'SMS preview' : 'Sample contact data'}
        </p>
      )}
    </div>
  )
}

function EmailInboxPreview({
  subject, bodyHtml, fromName, toName, view,
}: {
  subject: string
  bodyHtml: string
  fromName: string
  toName: string
  view: 'desktop' | 'mobile'
}) {
  const now = new Date().toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  return (
    <div className={cn('mx-auto transition-all duration-200', view === 'mobile' ? 'max-w-[320px]' : 'max-w-full')}>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gray-50 border-b px-4 py-2 flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Inbox preview</span>
        </div>
        <div className="px-4 py-4 border-b border-gray-100 space-y-3">
          <h3 className="text-base font-semibold text-gray-900 leading-snug break-words">
            {subject || 'No subject'}
          </h3>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold shrink-0">
              {fromName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-gray-900">{fromName}</span>
              <p className="text-xs text-gray-500 mt-0.5">to <span className="text-gray-700">{toName}</span></p>
            </div>
            <span className="text-[11px] text-gray-400 shrink-0">{now}</span>
          </div>
        </div>
        <div className="px-4 py-5 bg-white min-h-[160px]">
          {bodyHtml ? (
            <div
              className="prose prose-sm max-w-none text-gray-800 leading-relaxed
                prose-p:my-2 prose-img:rounded-lg prose-img:my-3 prose-video:rounded-lg prose-a:text-emerald-600"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">Your email content will appear here</p>
          )}
        </div>
      </div>
    </div>
  )
}

function MediaHeader({ media, vendorName }: { media: TemplateAttachment; vendorName: string }) {
  return (
    <div className="relative w-full aspect-[16/10] bg-gray-900 overflow-hidden">
      {media.type === 'video' ? (
        <video src={media.url} className="w-full h-full object-cover" muted playsInline />
      ) : (
        <img src={media.url} alt="" className="w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/50 text-white text-[10px] font-bold tracking-wide">
        {vendorName.slice(0, 12).toUpperCase()}
      </div>
      {media.type === 'video' && (
        <>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="w-5 h-5 text-gray-900 ml-0.5" fill="currentColor" />
            </div>
          </div>
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-white text-[10px] font-medium">
            <span className="px-1 py-0.5 rounded bg-black/60">HD</span>
            <span className="px-1 py-0.5 rounded bg-black/60">0:20</span>
          </div>
        </>
      )}
    </div>
  )
}

function RichMarketingCard({
  messageHtml,
  footerText,
  ctaLabel,
  ctaUrl,
  headerMedia,
  vendorName,
  dark = false,
}: {
  messageHtml: string
  footerText?: string
  ctaLabel?: string
  ctaUrl?: string
  headerMedia?: TemplateAttachment | null
  vendorName: string
  dark?: boolean
}) {
  const time = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="w-full max-w-[300px]">
      <div className={cn(
        'rounded-lg overflow-hidden shadow-md',
        dark ? 'bg-[#1f2c34] text-[#e9edef]' : 'bg-white text-gray-900',
      )}>
        {headerMedia && <MediaHeader media={headerMedia} vendorName={vendorName} />}
        <div className="px-3.5 py-3 space-y-1">
          {messageHtml ? (
            <div
              className={cn('text-[13px] leading-[1.45]', dark ? 'text-[#e9edef]' : 'text-gray-800')}
              dangerouslySetInnerHTML={{ __html: messageHtml }}
            />
          ) : (
            <p className={cn('text-sm', dark ? 'text-gray-400' : 'text-gray-400')}>Your message will appear here…</p>
          )}
          {footerText && (
            <div className={cn('text-[11px] pt-2 whitespace-pre-line', dark ? 'text-gray-400' : 'text-gray-500')}
              dangerouslySetInnerHTML={{ __html: formatRichMessageToHtml(footerText) }}
            />
          )}
          <p className={cn('text-[10px] text-right pt-1', dark ? 'text-gray-500' : 'text-gray-400')}>{time}</p>
        </div>
      </div>
      {ctaLabel && (
        <a
          href={ctaUrl || '#'}
          target="_blank"
          rel="noreferrer"
          onClick={e => !ctaUrl && e.preventDefault()}
          className={cn(
            'mt-1 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border text-sm font-medium transition-colors',
            dark
              ? 'border-[#00a884] text-[#00a884] hover:bg-[#00a884]/10'
              : 'border-emerald-500 text-emerald-600 hover:bg-emerald-50 bg-white',
          )}
        >
          {ctaLabel}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  )
}

function WhatsAppMarketingPreview({
  messageHtml, settings, headerMedia, vendorName, view,
}: {
  messageHtml: string
  settings: TemplateSettings
  headerMedia?: TemplateAttachment | null
  vendorName: string
  view: 'desktop' | 'mobile'
}) {
  return (
    <div className={cn('mx-auto', view === 'mobile' ? 'max-w-[340px]' : 'max-w-[380px]')}>
      <div className="rounded-[1.75rem] border-[5px] border-gray-800 bg-[#0b141a] p-2 shadow-2xl">
        <div className="rounded-[1.25rem] overflow-hidden bg-[#0b141a] min-h-[360px] flex flex-col">
          <div className="bg-[#1f2c34] px-3 py-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center text-white text-xs font-bold">
              {vendorName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#e9edef] truncate">{vendorName}</p>
              <p className="text-[10px] text-[#8696a0]">Business account</p>
            </div>
          </div>
          <div
            className="flex-1 p-3 flex flex-col items-start justify-start"
            style={{ background: '#0b141a' }}
          >
            <RichMarketingCard
              messageHtml={messageHtml}
              footerText={settings.footer_text}
              ctaLabel={settings.cta_label}
              ctaUrl={settings.cta_url}
              headerMedia={headerMedia}
              vendorName={vendorName}
              dark
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function SmsMarketingPreview({
  messageHtml, settings, headerMedia, vendorName, view,
}: {
  messageHtml: string
  settings: TemplateSettings
  headerMedia?: TemplateAttachment | null
  vendorName: string
  view: 'desktop' | 'mobile'
}) {
  return (
    <div className={cn('mx-auto', view === 'mobile' ? 'max-w-[320px]' : 'max-w-[360px]')}>
      <div className="rounded-[2rem] border-[6px] border-gray-800 bg-gray-900 p-2 shadow-xl">
        <div className="rounded-[1.4rem] bg-gray-100 overflow-hidden min-h-[340px] flex flex-col">
          <div className="bg-white border-b px-4 py-3 text-center">
            <p className="text-xs font-semibold text-gray-900">Messages</p>
            <p className="text-[10px] text-gray-400">{SAMPLE_CONTACT.first_name} {SAMPLE_CONTACT.last_name}</p>
          </div>
          <div className="flex-1 p-3 flex flex-col items-start">
            <RichMarketingCard
              messageHtml={messageHtml}
              footerText={settings.footer_text}
              ctaLabel={settings.cta_label}
              ctaUrl={settings.cta_url}
              headerMedia={headerMedia}
              vendorName={vendorName}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function MarketingTemplatePreview({
  tpl,
  channel: channelOverride,
  defaultView = 'mobile',
  showToolbar = true,
  className,
}: {
  tpl: TemplatePreviewData
  channel?: string
  defaultView?: 'desktop' | 'mobile'
  showToolbar?: boolean
  className?: string
}) {
  const [view, setView] = useState<'desktop' | 'mobile'>(defaultView)
  const vendor = useVendorStore(s => s.vendor)
  const user = useAuthStore(s => s.user)
  const channel = channelOverride || tpl.channel || 'email'
  const settings = readTemplateSettings(tpl.settings)
  const headerMedia = headerAttachment(tpl.attachments)

  const vendorName = vendor?.display_name || vendor?.business_name || 'Your Business'
  const userName = user?.full_name

  const renderedSubject = useMemo(
    () => renderTemplateMergeTags(tpl.subject, vendorName, userName),
    [tpl.subject, vendorName, userName],
  )
  const renderedBody = useMemo(() => {
    const html = resolveEmailBodyHtml(tpl.body_html || '', tpl.body_text || '')
    return renderTemplateMergeTags(html, vendorName, userName)
  }, [tpl.body_html, tpl.body_text, vendorName, userName])
  const richMessageHtml = useMemo(() => {
    const raw = tpl.body_text?.trim() || htmlToPlainText(tpl.body_html)
    const merged = renderTemplateMergeTags(raw, vendorName, userName)
    return formatRichMessageToHtml(merged)
  }, [tpl.body_text, tpl.body_html, vendorName, userName])

  const renderedSettings = useMemo(() => ({
    ...settings,
    footer_text: settings.footer_text
      ? renderTemplateMergeTags(settings.footer_text, vendorName, userName)
      : undefined,
    cta_label: settings.cta_label
      ? renderTemplateMergeTags(settings.cta_label, vendorName, userName)
      : undefined,
  }), [settings, vendorName, userName])

  const toName = `${SAMPLE_CONTACT.first_name} ${SAMPLE_CONTACT.last_name}`
  const isRich = channel === 'whatsapp' || channel === 'sms'

  return (
    <div className={cn('flex flex-col', className)}>
      {showToolbar && (
        <PreviewToolbar view={view} onView={setView} channel={channel} />
      )}

      <div className={cn(
        'rounded-xl p-4 min-h-[320px] flex items-start justify-center',
        isRich ? 'bg-gray-900/95' : 'bg-gradient-to-b from-gray-100/80 to-gray-50/50',
      )}>
        {channel === 'whatsapp' && (
          <WhatsAppMarketingPreview
            messageHtml={richMessageHtml}
            settings={renderedSettings}
            headerMedia={headerMedia}
            vendorName={vendorName}
            view={view}
          />
        )}
        {channel === 'sms' && (
          <SmsMarketingPreview
            messageHtml={richMessageHtml}
            settings={renderedSettings}
            headerMedia={headerMedia}
            vendorName={vendorName}
            view={view}
          />
        )}
        {channel !== 'sms' && channel !== 'whatsapp' && (
          <EmailInboxPreview
            subject={renderedSubject}
            bodyHtml={renderedBody}
            fromName={vendorName}
            toName={toName}
            view={view}
          />
        )}
      </div>

      {isRich && (
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          Add a header video/image, offer list with ✅, and a CTA button — like promotional WhatsApp messages
        </p>
      )}
      {channel === 'email' && (
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          Merge tags like {'{{contact.first_name}}'} are replaced with sample values above
        </p>
      )}
    </div>
  )
}
