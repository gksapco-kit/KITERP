import { mediaUrl } from '@/lib/utils'
import type { RegistrationTheme } from './registrationFormTemplates'

export function RegistrationFormLetterhead({
  theme,
  fallbackTitle,
  fallbackSubtitle,
}: {
  theme?: RegistrationTheme | Record<string, string | undefined> | null
  fallbackTitle?: string
  fallbackSubtitle?: string
}) {
  const accent = theme?.accent || '#111827'
  const logo = theme?.logo_url ? mediaUrl(theme.logo_url) : ''
  const company = (theme?.company_name || '').trim()
  const phone = (theme?.company_phone || '').trim()
  const address = (theme?.company_address || '').trim()
  const title = (theme?.cover_title || fallbackTitle || 'Registration').trim()
  const subtitle = (theme?.cover_subtitle || fallbackSubtitle || '').trim()
  const branded = Boolean(logo || company || phone || address)

  if (!branded) {
    return (
      <div className="px-5 py-5 text-white" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}b3)` }}>
        <h3 className="text-xl font-bold">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-white/85">{subtitle}</p> : null}
      </div>
    )
  }

  return (
    <div className="overflow-hidden bg-white text-slate-900">
      <div className="flex items-center gap-3 px-4 py-3">
        {logo ? (
          <img src={logo} alt={company || 'Company logo'} className="h-14 w-14 shrink-0 rounded-md object-contain" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-100 text-lg font-bold text-slate-500">
            {(company || title).slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 text-center">
          {company ? <p className="text-base font-bold tracking-wide sm:text-lg">{company}</p> : null}
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-800">{title}</p>
          {subtitle && !company ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {phone ? (
          <p className="hidden max-w-[9.5rem] shrink-0 text-right text-[11px] leading-4 text-slate-600 sm:block">
            Phone/WhatsApp:
            <span className="mt-0.5 block font-semibold text-slate-800">{phone}</span>
          </p>
        ) : null}
      </div>
      {phone ? (
        <p className="px-4 pb-2 text-center text-[11px] text-slate-600 sm:hidden">Phone/WhatsApp: {phone}</p>
      ) : null}
      {address ? (
        <div className="px-3 py-2 text-center text-[11px] leading-4 text-white" style={{ background: accent }}>
          {address}
        </div>
      ) : (
        <div className="h-1" style={{ background: accent }} />
      )}
    </div>
  )
}
