import { useState } from 'react'
import { Store, UserCircle, Copy, ExternalLink, Check } from 'lucide-react'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
import { buildHrEssLoginUrl, isHrEssLinkVisibleForStore } from '@/lib/hrStorefrontLinks'
import { cn } from '@/lib/utils'

type Props = {
  vendorSlug: string
  /** Optional outlet / business unit (store code) — appended as `?branch=` on links when set */
  outletCode?: string | null
  /** Store id when on a unit detail panel — gates ESS link when HR is per business unit */
  storeId?: string | null
  vendorSettings?: Record<string, unknown> | null
  /** When true, do not render the outlet row (e.g. business unit is shown above this card on Store detail). */
  hideOutletRow?: boolean
  /** Flat layout without outer card chrome (use inside Business Units / store detail). */
  embedded?: boolean
}

type CopyKey = 'store' | 'hr' | 'outlet'

const iconBtnClass =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function LinkActions({
  copyKey,
  copied,
  copyValue,
  openHref,
  onCopy,
  copyLabel,
  openLabel,
}: {
  copyKey: CopyKey
  copied: CopyKey | null
  copyValue: string
  openHref: string
  onCopy: (key: CopyKey, text: string) => void
  copyLabel: string
  openLabel: string
}) {
  const isCopied = copied === copyKey
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => void onCopy(copyKey, copyValue)}
        className={cn(iconBtnClass, isCopied && 'border-emerald-200 text-emerald-700')}
        title={isCopied ? 'Copied' : copyLabel}
        aria-label={copyLabel}
      >
        {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <a
        href={openHref}
        target="_blank"
        rel="noopener noreferrer"
        className={iconBtnClass}
        title={openLabel}
        aria-label={openLabel}
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}

function LinkRow({
  href,
  icon: Icon,
  label,
  hint,
  iconClassName,
  copyKey,
  copied,
  onCopy,
}: {
  href: string
  icon: typeof Store
  label: string
  hint?: string
  iconClassName?: string
  copyKey: CopyKey
  copied: CopyKey | null
  onCopy: (key: CopyKey, text: string) => void
}) {
  return (
    <div className="flex items-start gap-2 px-2.5 py-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Icon className={cn('h-3.5 w-3.5 text-primary', iconClassName)} />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint ? (
          <span className="block text-[10px] text-muted-foreground">{hint}</span>
        ) : null}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 block truncate font-mono text-[11px] text-primary/90 underline-offset-2 hover:text-primary hover:underline"
          title={href}
        >
          {href}
        </a>
      </div>
      <LinkActions
        copyKey={copyKey}
        copied={copied}
        copyValue={href}
        openHref={href}
        onCopy={onCopy}
        copyLabel={`Copy ${label} link`}
        openLabel={`Open ${label}`}
      />
    </div>
  )
}

function MetaRow({
  label,
  value,
  displayUrl,
  copyValue: copyValueProp,
  copyKey,
  copied,
  openHref,
  onCopy,
}: {
  label: string
  value: string
  /** Full URL shown under the value (optional). */
  displayUrl?: string
  /** Text copied to clipboard; defaults to display URL or value. */
  copyValue?: string
  copyKey: CopyKey
  copied: CopyKey | null
  openHref: string
  onCopy: (key: CopyKey, text: string) => void
}) {
  const copyValue = copyValueProp ?? displayUrl ?? value
  return (
    <div className="flex items-start gap-2 border-t border-border bg-muted/20 px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <code className="mt-0.5 block truncate font-mono text-xs font-semibold text-foreground" title={value}>
          {value}
        </code>
        {displayUrl && displayUrl !== value ? (
          <a
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 block truncate font-mono text-[11px] text-primary/90 underline-offset-2 hover:text-primary hover:underline"
            title={displayUrl}
          >
            {displayUrl}
          </a>
        ) : null}
      </div>
      <LinkActions
        copyKey={copyKey}
        copied={copied}
        copyValue={copyValue}
        openHref={openHref}
        onCopy={onCopy}
        copyLabel={`Copy ${label}`}
        openLabel={`Open ${label}`}
      />
    </div>
  )
}

/**
 * Business front customer URL and employee HR / ESS login for a unit.
 */
export default function VendorStorefrontLinksCard({
  vendorSlug,
  outletCode,
  storeId,
  vendorSettings,
  hideOutletRow,
  embedded,
}: Props) {
  const slug = vendorSlug.trim()
  const [copied, setCopied] = useState<CopyKey | null>(null)

  const storeBase = getCustomerStorefrontBaseUrl(slug)
  const branchQ = outletCode ? `?branch=${encodeURIComponent(outletCode)}` : ''
  const storeUrl = `${storeBase}${branchQ}`
  const showHr =
    !storeId || isHrEssLinkVisibleForStore(storeId, vendorSettings ?? undefined)
  const hrUrl = showHr ? buildHrEssLoginUrl(slug, outletCode) : null

  async function copyText(key: CopyKey, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* ignore */
    }
  }

  const outlet = (outletCode ?? '').trim()
  const storeHint = outlet ? 'Includes branch filter' : 'Customer-facing shop'

  const cardBody = (
    <>
      <div className="divide-y divide-border">
        <LinkRow
          href={storeUrl}
          icon={Store}
          label="Customer store"
          hint={storeHint}
          copyKey="store"
          copied={copied}
          onCopy={copyText}
        />
        {hrUrl ? (
          <LinkRow
            href={hrUrl}
            icon={UserCircle}
            label="HR & employee login"
            hint={
              outletCode
                ? 'ESS portal for this business unit'
                : 'ESS portal for staff (vendor-wide)'
            }
            iconClassName="text-emerald-600"
            copyKey="hr"
            copied={copied}
            onCopy={copyText}
          />
        ) : null}
      </div>

      {outlet && !hideOutletRow ? (
        <MetaRow
          label="Branch"
          value={outlet}
          displayUrl={storeUrl}
          copyValue={outlet}
          copyKey="outlet"
          copied={copied}
          openHref={storeUrl}
          onCopy={copyText}
        />
      ) : null}
    </>
  )

  if (embedded) {
    return (
      <div className="space-y-1.5">
        <div className="overflow-hidden rounded-lg border border-border bg-background">{cardBody}</div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          Use the slug when your email is linked to more than one vendor account.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-3 mb-2 space-y-2 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm">
      <p className="text-xs font-medium text-foreground">Public links</p>
      <div className="overflow-hidden rounded-md border border-border">{cardBody}</div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Copy or open links in a new tab. Use the slug when your email is linked to more than one vendor account.
      </p>
    </div>
  )
}
