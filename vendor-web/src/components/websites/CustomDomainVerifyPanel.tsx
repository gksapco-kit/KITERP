import { useState } from 'react'
import { BadgeCheck, Copy, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { websiteApi } from '@/api/websites'
import { toast } from 'sonner'

interface Props {
  siteId: string
  customDomain?: string | null
  domainVerified?: boolean
  onUpdated?: () => void
}

export function CustomDomainVerifyPanel({ siteId, customDomain, domainVerified, onUpdated }: Props) {
  const [domain, setDomain] = useState(customDomain || '')
  const [dns, setDns] = useState<{
    dns_record_name: string
    dns_record_value: string
    instructions: string
  } | null>(null)
  const [checking, setChecking] = useState(false)
  const [initing, setIniting] = useState(false)

  const handleInit = async () => {
    const d = domain.trim().toLowerCase()
    if (!d || !d.includes('.')) {
      toast.error('Enter a valid domain (e.g. shop.example.com)')
      return
    }
    setIniting(true)
    try {
      const res = await websiteApi.domainVerifyInit(siteId, d)
      setDns({
        dns_record_name: res.dns_record_name,
        dns_record_value: res.dns_record_value,
        instructions: res.instructions,
      })
      toast.success('DNS record generated — add it at your registrar')
      onUpdated?.()
    } catch {
      toast.error('Could not start domain verification')
    } finally {
      setIniting(false)
    }
  }

  const handleCheck = async () => {
    setChecking(true)
    try {
      const res = await websiteApi.domainVerifyCheck(siteId)
      if (res.verified) {
        toast.success('Domain verified!')
        onUpdated?.()
      } else {
        toast.message(res.message || 'TXT record not found yet — try again in a few minutes')
      }
    } catch {
      toast.error('DNS check failed')
    } finally {
      setChecking(false)
    }
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied'))
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BadgeCheck className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Custom domain (DNS)</p>
        {domainVerified && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
            Verified
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Your domain</Label>
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="shop.yourbusiness.com"
          className="h-9 text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={initing} onClick={handleInit}>
          {initing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          Generate TXT record
        </Button>
        <Button size="sm" disabled={checking || !customDomain} onClick={handleCheck}>
          {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
          Check DNS
        </Button>
      </div>
      {dns && (
        <div className="rounded-lg border bg-card p-3 text-xs space-y-2">
          <p className="text-muted-foreground">{dns.instructions}</p>
          <div className="flex items-center justify-between gap-2 font-mono bg-muted/50 rounded px-2 py-1">
            <span className="truncate">{dns.dns_record_name}</span>
            <button type="button" onClick={() => copy(dns.dns_record_name)} className="shrink-0 text-primary">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 font-mono bg-muted/50 rounded px-2 py-1">
            <span className="truncate">{dns.dns_record_value}</span>
            <button type="button" onClick={() => copy(dns.dns_record_value)} className="shrink-0 text-primary">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
