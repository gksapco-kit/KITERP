import { useState, useEffect, useRef } from 'react'
import { X, Globe, Link2, Mail, Copy, ExternalLink, AlertCircle, BadgeCheck, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { Vendor } from '@/types'
import type { UseMutationResult } from '@tanstack/react-query'

const REGISTRAR_OPTIONS = [
  'GoDaddy', 'Namecheap', 'Cloudflare', 'Google Domains', 'BigRock',
  'Hostinger', 'Bluehost', 'HostGator', 'Reseller Club', 'Net4India', 'Other',
]

const ACCESS_STATUS_META: Record<string, { label: string; color: string }> = {
  not_requested: { label: 'Not requested',       color: 'text-gray-500 bg-gray-100 border-gray-200' },
  pending:        { label: 'Pending verification', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  active:         { label: 'Access active',        color: 'text-green-700 bg-green-50 border-green-200' },
  revoked:        { label: 'Revoked',              color: 'text-red-600 bg-red-50 border-red-200' },
}

const KIT_ERP_SUPPORT_EMAIL = 'support@kiterp.com'

const selectCls =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

interface Props {
  vendor: Vendor | null
  onClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: UseMutationResult<any, any, any, any>
}

export function ExternalDomainModal({ vendor, onClose, onSave }: Props) {
  const v = vendor as any
  const [enabled, setEnabled] = useState(v?.external_domain_enabled ?? false)
  const [domainName, setDomainName] = useState(v?.external_domain_name ?? '')
  const [registrar, setRegistrar] = useState(v?.external_domain_registrar ?? '')
  const [regEmail, setRegEmail] = useState(v?.external_domain_reg_email ?? '')
  const [holder, setHolder] = useState(v?.external_domain_holder ?? '')
  const [expiry, setExpiry] = useState(v?.external_domain_expiry ?? '')
  const [accessStatus, setAccessStatus] = useState(v?.external_domain_access_status ?? 'not_requested')
  const [recoveryContact, setRecoveryContact] = useState(v?.external_domain_recovery_contact ?? '')
  const [notes, setNotes] = useState(v?.external_domain_notes ?? '')
  const savingRef = useRef(false)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (enabled && !domainName.trim()) { toast.error('Domain name is required'); return }
    if (enabled && !registrar) { toast.error('Please select the registrar'); return }
    savingRef.current = true
    onSave.mutate({
      external_domain_enabled: enabled,
      external_domain_name: domainName.trim() || undefined,
      external_domain_registrar: registrar || undefined,
      external_domain_reg_email: regEmail.trim() || undefined,
      external_domain_holder: holder.trim() || undefined,
      external_domain_expiry: expiry || undefined,
      external_domain_access_status: accessStatus,
      external_domain_recovery_contact: recoveryContact.trim() || undefined,
      external_domain_notes: notes.trim() || undefined,
    }, { onSettled: () => { savingRef.current = false; onClose() } })
  }

  const handleGrantedAccess = () => {
    savingRef.current = true
    onSave.mutate({ external_domain_access_status: 'pending' }, {
      onSettled: () => { savingRef.current = false },
      onSuccess: () => { setAccessStatus('pending'); toast.success('Marked as pending — KIT ERP team will verify') },
    })
  }

  const handleRevokeAccess = () => {
    savingRef.current = true
    onSave.mutate({ external_domain_access_status: 'revoked' }, {
      onSettled: () => { savingRef.current = false },
      onSuccess: () => { setAccessStatus('revoked'); toast.info('Access revoked') },
    })
  }

  const statusMeta = ACCESS_STATUS_META[accessStatus] ?? ACCESS_STATUS_META.not_requested
  const registrarGuides: Record<string, string> = {
    GoDaddy:    'https://www.godaddy.com/help/invite-a-delegate-15087',
    Namecheap:  'https://www.namecheap.com/support/knowledgebase/article.aspx/567',
    Cloudflare: 'https://developers.cloudflare.com/fundamentals/account-and-billing/account-setup/create-account/',
  }
  const guideUrl = registrar ? (registrarGuides[registrar] ?? null) : null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden rounded-2xl bg-card shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">External Domain</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Toggle */}
          <label className="flex cursor-pointer items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((v: boolean) => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${enabled ? 'bg-primary' : 'bg-gray-200'}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm font-medium text-foreground">Use an external domain</span>
          </label>

          {enabled && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Domain name <span className="text-red-500">*</span></Label>
                  <Input value={domainName} onChange={e => setDomainName(e.target.value)} placeholder="yourbusiness.com" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Registrar <span className="text-red-500">*</span></Label>
                  <select value={registrar} onChange={e => setRegistrar(e.target.value)} className={selectCls}>
                    <option value="">Select registrar…</option>
                    {REGISTRAR_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Registrar login email <span className="text-red-500">*</span></Label>
                  <Input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="your-email@example.com" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Account holder name</Label>
                  <Input value={holder} onChange={e => setHolder(e.target.value)} placeholder="Name on the registration" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Domain expiry date</Label>
                  <Input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">2FA recovery contact</Label>
                  <Input value={recoveryContact} onChange={e => setRecoveryContact(e.target.value)} placeholder="Phone or backup email" />
                </div>
              </div>

              {/* KIT ERP access instructions */}
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2.5">
                <div className="flex items-start gap-2">
                  <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">Grant KIT ERP team access</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Add <strong className="text-foreground">{KIT_ERP_SUPPORT_EMAIL}</strong> as a delegated user in your {registrar || 'registrar'} account.
                    </p>
                  </div>
                </div>
                {guideUrl && (
                  <a href={guideUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-white px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
                    <ExternalLink className="h-3 w-3" /> How to add a delegate in {registrar}
                  </a>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1">
                    <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="text-xs font-mono text-foreground">{KIT_ERP_SUPPORT_EMAIL}</span>
                  </div>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(KIT_ERP_SUPPORT_EMAIL); toast.success('Email copied') }}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors">
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
              </div>

              {/* Access status */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {accessStatus === 'active' ? <BadgeCheck className="h-4 w-4 text-green-600" /> :
                   accessStatus === 'pending' ? <AlertCircle className="h-4 w-4 text-amber-600" /> :
                   <Globe className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-medium text-foreground">Access status</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusMeta.color}`}>
                    {statusMeta.label}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {accessStatus === 'not_requested' && (
                    <Button type="button" size="sm" variant="outline" onClick={handleGrantedAccess}>
                      <Plus className="mr-1 h-3 w-3" /> I've granted access
                    </Button>
                  )}
                  {accessStatus === 'pending' && <span className="text-xs text-muted-foreground">Waiting for KIT ERP to verify…</span>}
                  {accessStatus === 'active' && (
                    <Button type="button" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={handleRevokeAccess}>
                      <X className="mr-1 h-3 w-3" /> Revoke access
                    </Button>
                  )}
                  {accessStatus === 'revoked' && (
                    <Button type="button" size="sm" variant="outline" onClick={handleGrantedAccess}>Re-grant access</Button>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs font-medium">Notes for KIT ERP team</Label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="Any special instructions…"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={onSave.isPending} onClick={handleSubmit as any}>
            {onSave.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
