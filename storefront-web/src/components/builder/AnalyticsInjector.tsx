/**
 * AnalyticsInjector — reads tracking IDs from the published site config and
 * injects the corresponding scripts into <head> once.
 *
 * Tracking providers supported:
 *   - Google Analytics 4 (GA4)
 *   - Meta Pixel (Facebook)
 *   - Google Tag Manager (GTM) — through `custom_head_code`
 *   - Custom head code
 *   - Custom body code
 *
 * Consent: tracking is allowed by default. Scripts are removed only if the
 * visitor explicitly Declines via an optional Cookie Consent block. When the
 * user later flips their choice, this component injects (or removes)
 * scripts on the fly without a page reload by listening to the consent
 * change event from `@/lib/consent`.
 *
 * Important: scripts inserted via `innerHTML` do not execute in browsers.
 * All `<script>` nodes are re-created with `createElement` so gtag / pixels run.
 */
import { useEffect, useState } from 'react'
import type { PublicSite } from '@/blocks/registry'
import { hasGrantedConsent, onConsentChange } from '@/lib/consent'

interface Props {
  site: PublicSite
}

const SCRIPT_IDS = ['ga4-script', 'ga4-init', 'meta-pixel', 'custom-head-code', 'custom-body-code']

/** Append a real <script> so the browser executes it (unlike innerHTML). */
function appendExecutableScript(
  parent: ParentNode,
  source: HTMLScriptElement,
  id?: string,
): void {
  const el = document.createElement('script')
  if (id) el.id = id
  for (const attr of Array.from(source.attributes)) {
    if (attr.name === 'id' && id) continue
    el.setAttribute(attr.name, attr.value)
  }
  if (source.textContent) el.textContent = source.textContent
  parent.appendChild(el)
}

/**
 * Inject HTML snippets (custom head/body). Non-script nodes keep their markup;
 * script tags are re-created so they actually run.
 */
function injectHtml(id: string, html: string, target: 'head' | 'body'): void {
  if (document.getElementById(id)) return
  const parent = target === 'body' ? document.body : document.head
  const wrapper = document.createElement('div')
  wrapper.id = id
  wrapper.setAttribute('data-kiterp-analytics', '1')

  const parsed = document.createElement('div')
  parsed.innerHTML = html

  for (const node of Array.from(parsed.childNodes)) {
    if (node.nodeName === 'SCRIPT') {
      appendExecutableScript(wrapper, node as HTMLScriptElement)
    } else {
      wrapper.appendChild(node.cloneNode(true))
    }
  }

  parent.appendChild(wrapper)
}

function injectExternalScript(id: string, src: string): void {
  if (document.getElementById(id)) return
  const el = document.createElement('script')
  el.id = id
  el.async = true
  el.src = src
  document.head.appendChild(el)
}

function injectInlineScript(id: string, code: string): void {
  if (document.getElementById(id)) return
  const el = document.createElement('script')
  el.id = id
  el.textContent = code
  document.head.appendChild(el)
}

/** Remove any tracking we previously injected. Used when consent is revoked. */
function removeAllInjected(): void {
  for (const id of SCRIPT_IDS) {
    document.getElementById(id)?.remove()
  }
  // Best-effort: clear known global functions so they don't keep buffering.
  try {
    if ('fbq' in window) delete (window as unknown as Record<string, unknown>).fbq
  } catch {
    /* noop */
  }
}

export default function AnalyticsInjector({ site }: Props) {
  // Track consent in state so the effect re-runs when the user clicks
  // accept/decline mid-session.
  const [consentGranted, setConsentGranted] = useState<boolean>(() => hasGrantedConsent(site.id))

  useEffect(() => {
    return onConsentChange(state => setConsentGranted(state !== 'denied'), site.id)
  }, [site.id])

  useEffect(() => {
    if (!consentGranted) {
      removeAllInjected()
      return
    }

    if (site.google_analytics_id) {
      const gid = site.google_analytics_id.trim()
      // Only accept GA4 measurement IDs (avoids injecting arbitrary strings as JS).
      if (/^G-[A-Z0-9]+$/i.test(gid)) {
        injectExternalScript(
          'ga4-script',
          `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gid)}`,
        )
        injectInlineScript(
          'ga4-init',
          [
            'window.dataLayer = window.dataLayer || [];',
            'function gtag(){dataLayer.push(arguments);}',
            'gtag("js", new Date());',
            `gtag("config", ${JSON.stringify(gid)}, { anonymize_ip: true });`,
          ].join('\n'),
        )
      }
    }

    if (site.meta_pixel_id) {
      const pid = site.meta_pixel_id.trim()
      if (/^\d{5,20}$/.test(pid)) {
        injectInlineScript(
          'meta-pixel',
          [
            '!function(f,b,e,v,n,t,s)',
            '{if(f.fbq)return;n=f.fbq=function(){n.callMethod?',
            'n.callMethod.apply(n,arguments):n.queue.push(arguments)};',
            "if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';",
            'n.queue=[];t=b.createElement(e);t.async=!0;',
            't.src=v;s=b.getElementsByTagName(e)[0];',
            's.parentNode.insertBefore(t,s)}(window,document,"script",',
            '"https://connect.facebook.net/en_US/fbevents.js");',
            `fbq("init", ${JSON.stringify(pid)});`,
            'fbq("track", "PageView");',
          ].join('\n'),
        )
      }
    }

    if (site.custom_head_code) {
      injectHtml('custom-head-code', site.custom_head_code, 'head')
    }

    if (site.custom_body_code) {
      injectHtml('custom-body-code', site.custom_body_code, 'body')
    }
  }, [
    consentGranted,
    site.id,
    site.google_analytics_id,
    site.meta_pixel_id,
    site.custom_head_code,
    site.custom_body_code,
  ])

  return null
}

// ── GA4 ecommerce event helpers (called from commerce blocks) ─────────────────

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

function trackingAllowed(siteId?: string | null): boolean {
  return hasGrantedConsent(siteId)
}

export function ga4Event(eventName: string, params: Record<string, unknown> = {}): void {
  if (!trackingAllowed()) return
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params)
  }
}

export function ga4ViewItem(product: { id?: string | null; title: string; price?: number | null; currency?: string }): void {
  ga4Event('view_item', {
    currency: product.currency || 'USD',
    value: product.price || 0,
    items: [{ item_id: product.id, item_name: product.title, price: product.price }],
  })
}

export function ga4AddToCart(product: { id?: string | null; title: string; price?: number | null; currency?: string; quantity?: number }): void {
  ga4Event('add_to_cart', {
    currency: product.currency || 'USD',
    value: (product.price || 0) * (product.quantity || 1),
    items: [{ item_id: product.id, item_name: product.title, price: product.price, quantity: product.quantity || 1 }],
  })
}

export function ga4Purchase(order: { id: string; total: number; currency: string }): void {
  ga4Event('purchase', {
    transaction_id: order.id,
    value: order.total,
    currency: order.currency,
  })
}
