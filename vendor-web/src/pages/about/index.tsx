import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Globe, Phone, CheckCircle2, ChevronDown, ChevronUp, ArrowLeft,
  MessageCircle, ExternalLink, Info,
} from 'lucide-react'
import { APP_VERSION, APP_BUILD, LAST_UPDATED, CHANGELOG } from '@/constants/vendorAppMeta'
import { Card, CardContent } from '@/components/ui/card'

const SUPPORT_PHONE = (import.meta.env.VITE_SUPPORT_PHONE as string | undefined)?.trim()
const SUPPORT_CHAT_URL =
  (import.meta.env.VITE_SUPPORT_CHAT_URL as string | undefined)?.trim() ||
  'mailto:support@kiterp.com?subject=Vendor%20Dashboard%20Help'

export default function AboutPage() {
  const [showChangelog, setShowChangelog] = useState(false)
  const navigate = useNavigate()
  const telHref = SUPPORT_PHONE ? `tel:${SUPPORT_PHONE.replace(/[^\d+]/g, '')}` : ''

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      <h1 className="text-xl font-bold text-foreground">About & Version</h1>

      {/* App info card */}
      <Card className="overflow-hidden">
        <CardContent className="p-5 space-y-5">
          {/* Version row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Vendor Admin — KITERP</p>
                <p className="text-xs text-muted-foreground">Build {APP_BUILD}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-lg font-bold text-foreground">v{APP_VERSION}</p>
              <p className="text-xs text-muted-foreground">{LAST_UPDATED}</p>
            </div>
          </div>

          {/* Up to date badge */}
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            You're on the latest version
          </div>

          {/* Support actions */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Support</p>
            <div className="flex flex-wrap gap-2">
              {SUPPORT_PHONE && (
                <a
                  href={telHref}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
                >
                  <Phone className="h-4 w-4" /> Call support
                </a>
              )}
              <a
                href={SUPPORT_CHAT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <MessageCircle className="h-4 w-4 text-green-500" /> Chat with support
              </a>
              <a
                href="https://docs.kiterp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <ExternalLink className="h-4 w-4 text-blue-500" /> Documentation
              </a>
            </div>
            {!SUPPORT_PHONE && (
              <p className="mt-2 text-xs text-muted-foreground">
                Optional: set <code className="rounded bg-muted px-1 font-mono">VITE_SUPPORT_PHONE</code> in
                your environment for a one-tap call button.
              </p>
            )}
          </div>

          {/* Release notes toggle */}
          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setShowChangelog(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              {showChangelog ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showChangelog ? 'Hide' : 'Show'} release notes
            </button>

            {showChangelog && (
              <div className="mt-3 overflow-hidden rounded-xl border border-border divide-y divide-border">
                {CHANGELOG.map(e => (
                  <div key={e.version} className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-semibold text-foreground">v{e.version}</span>
                      <span className="text-xs text-muted-foreground">{e.date}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{e.notes}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Legal / info footer */}
      <p className="text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} KITERP. All rights reserved.
      </p>
    </div>
  )
}
