import { useState, useMemo, useRef, useEffect, type ElementType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useAuthStore } from '@/stores/authStore'
import {
  useMe, useUpdateMe, useChangePassword, useUploadAvatar, useLogout,
  useResendEmailVerification, useVerifyEmailCode,
  useRequestEmailChange, useConfirmEmailChange,
  useSendPhoneOtp, useVerifyPhoneOtp,
} from '@/hooks/useAuth'
import { authApi } from '@/api/auth'
import { useMyVendor, useVendorDocuments, useUploadVendorDocument, useSubmitVendorForReview } from '@/hooks/useVendor'
import {
  User as UserIcon, Mail, Phone as PhoneIcon, Camera, Loader2, Save, ShieldCheck,
  KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle,
  Activity, LogOut, Bell, Store as StoreIcon, UsersRound, CreditCard, ShieldAlert,
  Lock, Clock, Monitor, Smartphone, Calendar, FileCheck2, Upload, Hash, FileText,
  ExternalLink, RefreshCcw, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { SingleImagePreview } from '@/components/common/CatalogMediaLightbox'
import { CollapsibleSection } from '@/components/common/CollapsibleSection'
import { toast } from 'sonner'
import {
  IdChip, formatShortId, formatVendorCode, VerifiedBadge,
  vendorVerificationLevel, userVerificationLevel,
  ALL_DOCUMENT_TYPES, REQUIRED_DOCUMENT_TYPES, DOCUMENT_LABELS, documentForType,
} from '@/lib/verification'
import type { VendorDocumentType } from '@/types'
import type { OtpSendResponse } from '@/api/auth'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1').replace('/api/v1', '')
function mediaUrl(url?: string | null) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${API_BASE}${url}`
}

type Section = 'identifiers' | 'personal' | 'verify' | 'security' | 'business' | 'role' | 'activity'

export default function ProfilePage() {
  useMe()
  const { user } = useAuthStore()
  const [openSection, setOpenSection] = useState<Section | null>('personal')

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary/80" />
      </div>
    )
  }

  const toggle = (s: Section) => setOpenSection(openSection === s ? null : s)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage your personal information, security, and account preferences.
        </p>
      </div>

      <ProfileHero />

      <div className="flex flex-col gap-4">
        <IdentifiersSection
          open={openSection === 'identifiers'}
          toggle={() => toggle('identifiers')}
        />
        <PersonalInfoSection
          open={openSection === 'personal'}
          toggle={() => toggle('personal')}
        />
        <VerificationSection
          open={openSection === 'verify'}
          toggle={() => toggle('verify')}
        />
        <SecuritySection
          open={openSection === 'security'}
          toggle={() => toggle('security')}
        />
        <BusinessVerificationSection
          open={openSection === 'business'}
          toggle={() => toggle('business')}
        />
        <RolePermissionsSection
          open={openSection === 'role'}
          toggle={() => toggle('role')}
        />
        <ActivitySection
          open={openSection === 'activity'}
          toggle={() => toggle('activity')}
        />
      </div>

      <QuickLinks />

      <DangerZone />

      <div className="flex justify-end border-t border-border pt-4">
        <Link
          to="/about"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
          App version &amp; support info
        </Link>
      </div>
    </div>
  )
}

function SectionWrapper({
  title, subtitle, icon: Icon, open, toggle, children, badge,
}: {
  title: string
  subtitle?: string
  icon: ElementType
  open: boolean
  toggle: () => void
  children: ReactNode
  badge?: ReactNode
}) {
  return (
    <CollapsibleSection
      title={title}
      subtitle={subtitle}
      icon={Icon}
      open={open}
      toggle={toggle}
      badge={badge}
    >
      {children}
    </CollapsibleSection>
  )
}

function ProfileHero() {
  const { user } = useAuthStore()
  const { data: vendor } = useMyVendor()
  const upload = useUploadAvatar()

  const uploadAvatarFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (JPEG, PNG, WebP, or GIF).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image is too large (max 5 MB).')
      return
    }
    upload.mutate(file)
  }

  const { openPicker, fileInput, modal } = useImageSourcePicker({
    title: 'Profile photo',
    accept: 'image/jpeg,image/png,image/webp,image/gif',
    onFile: uploadAvatarFile,
  })

  const initials = useMemo(() => {
    const name = user?.full_name || user?.email || 'U'
    return name
      .split(/\s+/)
      .map(p => p.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('')
  }, [user?.full_name, user?.email])

  const memberSince = useMemo(() => {
    if (!user?.created_at) return ''
    try {
      return new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    } catch { return '' }
  }, [user?.created_at])

  const onPickFile = () => openPicker()

  const role = user?.vendor_role?.role_name || 'Member'

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-primary via-primary to-info h-24" />
      <CardContent className="p-6 -mt-12">
        <div className="flex flex-col sm:flex-row sm:items-end gap-5">
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-info ring-4 ring-white shadow-lg flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
              {user?.avatar_url ? (
                <SingleImagePreview
                  url={user.avatar_url}
                  resolveUrl={mediaUrl}
                  alt={user.full_name || 'Profile photo'}
                  editable
                  onSave={async (file) => { uploadAvatarFile(file) }}
                  className="h-full w-full"
                  imgClassName="h-full w-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={onPickFile}
              disabled={upload.isPending}
              className={cn(
                'absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors',
                upload.isPending && 'opacity-70 cursor-not-allowed',
              )}
              title="Change photo"
            >
              {upload.isPending ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : (
                <Camera className="w-4 h-4 text-primary" />
              )}
            </button>
            {fileInput}
            {modal}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900 truncate">{user?.full_name}</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-accent text-primary border border-primary/30">
                <ShieldCheck className="w-3 h-3" />
                {role}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1 truncate">{user?.email}</p>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              <VerifiedChip
                label="Email"
                verified={!!user?.is_email_verified}
              />
              <VerifiedChip
                label="Phone"
                verified={!!user?.is_phone_verified}
              />
              <VerifiedBadge level={vendorVerificationLevel(vendor)} label={`Business ${vendorVerificationLevel(vendor) === 'verified' ? 'verified' : vendorVerificationLevel(vendor) === 'in_review' ? 'in review' : vendorVerificationLevel(vendor) === 'rejected' ? 'rejected' : 'unverified'}`} />
              {memberSince && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  Member since {memberSince}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {user?.id && (
                <IdChip label="User" code={formatShortId('USR', user.id)} fullValue={user.id} />
              )}
              {vendor && (
                <IdChip
                  label="Business"
                  code={formatVendorCode(vendor)}
                  fullValue={vendor.id}
                />
              )}
            </div>
          </div>

          <div className="hidden sm:block">
            <Button variant="outline" size="sm" onClick={onPickFile} disabled={upload.isPending}>
              {upload.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading…</>
              ) : (
                <><Camera className="w-3.5 h-3.5 mr-1.5" /> Change photo</>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function VerifiedChip({ label, verified }: { label: string; verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
      <CheckCircle2 className="w-3 h-3" />
      {label} verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
      <AlertCircle className="w-3 h-3" />
      {label} not verified
    </span>
  )
}

function PersonalInfoSection({ open, toggle }: { open: boolean; toggle: () => void }) {
  const { user } = useAuthStore()
  const update = useUpdateMe()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [phone, setPhone] = useState(user?.phone || '')

  useEffect(() => {
    setFullName(user?.full_name || '')
    setPhone(user?.phone || '')
  }, [user?.full_name, user?.phone])

  const dirty =
    fullName.trim() !== (user?.full_name || '').trim() ||
    (phone || '') !== (user?.phone || '')

  const onSave = () => {
    if (!fullName.trim()) {
      toast.error('Full name is required')
      return
    }
    update.mutate({
      full_name: fullName.trim(),
      phone: phone.trim() || null,
    })
  }

  const onReset = () => {
    setFullName(user?.full_name || '')
    setPhone(user?.phone || '')
  }

  return (
    <SectionWrapper
      title="Personal Information"
      subtitle="Your name and contact details"
      icon={UserIcon}
      open={open}
      toggle={toggle}
    >
      <div className="space-y-5 pt-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                id="email"
                value={user?.email || ''}
                readOnly
                disabled
                className="pl-9 bg-gray-50 text-gray-600"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              To change your email, use the <span className="font-medium">Verification &amp; contact</span> section below.
            </p>
          </div>
        </div>

        <div>
          <PhoneInput
            id="phone"
            label="Phone number"
            value={phone}
            onChange={setPhone}
            placeholder="Mobile number"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          {dirty && (
            <Button variant="cancel" size="sm" onClick={onReset} disabled={update.isPending}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={onSave}
            disabled={!dirty || update.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {update.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…</>
            ) : (
              <><Save className="w-3.5 h-3.5 mr-1.5" /> Save changes</>
            )}
          </Button>
        </div>
      </div>
    </SectionWrapper>
  )
}

function TwoFactorPanel() {
  const { user, setUser } = useAuthStore()
  const [setupUri, setSetupUri] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const enabled = Boolean(user?.is_2fa_enabled)

  const startSetup = async () => {
    setBusy(true)
    try {
      const res = await authApi.setup2fa()
      setSecret(res.secret)
      setSetupUri(res.provisioning_uri)
      toast.success('Scan the QR code or enter the secret in your authenticator app')
    } catch {
      toast.error('Could not start 2FA setup')
    } finally {
      setBusy(false)
    }
  }

  const confirmEnable = async () => {
    if (code.length < 6) return
    setBusy(true)
    try {
      await authApi.enable2fa(code)
      if (user) setUser({ ...user, is_2fa_enabled: true })
      setSetupUri(null)
      setSecret(null)
      setCode('')
      toast.success('Two-factor authentication enabled')
    } catch {
      toast.error('Invalid code — try again')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    if (code.length < 6) {
      toast.error('Enter your current authenticator code to disable 2FA')
      return
    }
    setBusy(true)
    try {
      await authApi.disable2fa(code)
      if (user) setUser({ ...user, is_2fa_enabled: false })
      setCode('')
      toast.success('Two-factor authentication disabled')
    } catch {
      toast.error('Invalid code')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-700">Two-factor authentication</p>
          <p className="text-xs text-gray-500">
            {enabled ? 'Your account requires an authenticator code at sign-in.' : 'Protect your account with an authenticator app.'}
          </p>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded border shrink-0 ${enabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
          {enabled ? 'On' : 'Off'}
        </span>
      </div>
      {!enabled && !setupUri && (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={startSetup}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          Set up authenticator
        </Button>
      )}
      {setupUri && !enabled && (
        <div className="rounded-lg border bg-gray-50 p-3 space-y-2 text-xs">
          <p className="text-gray-600">Manual key: <code className="font-mono bg-white px-1 rounded">{secret}</code></p>
          <Input
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            className="h-9 font-mono tracking-widest"
          />
          <Button type="button" size="sm" disabled={busy || code.length < 6} onClick={confirmEnable}>
            Confirm & enable
          </Button>
        </div>
      )}
      {enabled && (
        <div className="flex flex-wrap gap-2 items-end">
          <Input
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Code to disable"
            className="h-9 w-40 font-mono tracking-widest"
          />
          <Button type="button" size="sm" variant="outline" className="text-red-600" disabled={busy} onClick={disable}>
            Disable 2FA
          </Button>
        </div>
      )}
    </div>
  )
}

function SecuritySection({ open, toggle }: { open: boolean; toggle: () => void }) {
  const change = useChangePassword()
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState({ current: false, next: false, confirm: false })

  const strength = useMemo(() => passwordStrength(newPwd), [newPwd])
  const matches = newPwd.length > 0 && newPwd === confirm
  const canSubmit =
    currentPwd.length >= 1 &&
    newPwd.length >= 8 &&
    matches &&
    newPwd !== currentPwd

  const reset = () => {
    setCurrentPwd(''); setNewPwd(''); setConfirm('')
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    change.mutate(
      { current_password: currentPwd, new_password: newPwd },
      { onSuccess: reset },
    )
  }

  return (
    <SectionWrapper
      title="Security"
      subtitle="Password and account protection"
      icon={Lock}
      open={open}
      toggle={toggle}
    >
      <form onSubmit={onSubmit} className="space-y-5 pt-3">
        <div>
          <Label htmlFor="current-pwd">Current password</Label>
          <PasswordField
            id="current-pwd"
            value={currentPwd}
            onChange={setCurrentPwd}
            show={show.current}
            onToggle={() => setShow(s => ({ ...s, current: !s.current }))}
            placeholder="Enter current password"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="new-pwd">New password</Label>
            <PasswordField
              id="new-pwd"
              value={newPwd}
              onChange={setNewPwd}
              show={show.next}
              onToggle={() => setShow(s => ({ ...s, next: !s.next }))}
              placeholder="At least 8 characters"
            />
            {newPwd.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1 h-1.5">
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={cn(
                        'flex-1 rounded-full transition-colors',
                        i < strength.score ? strength.color : 'bg-gray-200',
                      )}
                    />
                  ))}
                </div>
                <p className={cn('text-xs font-medium', strength.textColor)}>
                  {strength.label}
                </p>
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="confirm-pwd">Confirm new password</Label>
            <PasswordField
              id="confirm-pwd"
              value={confirm}
              onChange={setConfirm}
              show={show.confirm}
              onToggle={() => setShow(s => ({ ...s, confirm: !s.confirm }))}
              placeholder="Repeat new password"
            />
            {confirm.length > 0 && !matches && (
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Passwords don't match
              </p>
            )}
            {confirm.length > 0 && matches && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Passwords match
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          {(currentPwd || newPwd || confirm) && (
            <Button type="button" variant="outline" size="sm" onClick={reset} disabled={change.isPending}>
              Clear
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit || change.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {change.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Updating…</>
            ) : (
              <><KeyRound className="w-3.5 h-3.5 mr-1.5" /> Change password</>
            )}
          </Button>
        </div>

        <TwoFactorPanel />
      </form>
    </SectionWrapper>
  )
}

function PasswordField({
  id, value, onChange, show, onToggle, placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        className="pr-10"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

function passwordStrength(pwd: string): { score: number; label: string; color: string; textColor: string } {
  if (!pwd) return { score: 0, label: 'Too short', color: 'bg-gray-200', textColor: 'text-gray-400' }
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++
  const map = [
    { label: 'Very weak', color: 'bg-red-500', textColor: 'text-red-600' },
    { label: 'Weak', color: 'bg-orange-500', textColor: 'text-orange-600' },
    { label: 'Fair', color: 'bg-yellow-500', textColor: 'text-yellow-600' },
    { label: 'Good', color: 'bg-green-500', textColor: 'text-green-600' },
    { label: 'Strong', color: 'bg-emerald-500', textColor: 'text-emerald-600' },
  ]
  const m = map[score] || map[0]
  return { score, ...m }
}

function RolePermissionsSection({ open, toggle }: { open: boolean; toggle: () => void }) {
  const { user } = useAuthStore()
  const role = user?.vendor_role
  const [filter, setFilter] = useState('')

  const grouped = useMemo(() => {
    const perms = role?.permissions || []
    const map = new Map<string, string[]>()
    for (const p of perms) {
      const ns = p.includes('.') ? p.split('.')[0] : 'general'
      if (!map.has(ns)) map.set(ns, [])
      map.get(ns)!.push(p)
    }
    return Array.from(map.entries())
      .map(([ns, items]) => ({ ns, items: items.sort() }))
      .sort((a, b) => a.ns.localeCompare(b.ns))
  }, [role?.permissions])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return grouped
    return grouped
      .map(g => ({ ns: g.ns, items: g.items.filter(p => p.toLowerCase().includes(q)) }))
      .filter(g => g.items.length > 0)
  }, [grouped, filter])

  const totalPerms = role?.permissions?.length || 0

  return (
    <SectionWrapper
      title="Role & Permissions"
      subtitle={role ? `${role.role_name} — ${totalPerms} permission${totalPerms === 1 ? '' : 's'}` : 'No vendor role assigned'}
      icon={ShieldCheck}
      open={open}
      toggle={toggle}
      badge={role && (
        <span className="text-xs font-medium px-2 py-1 rounded bg-accent text-primary border border-primary/30">
          {role.role_name}
        </span>
      )}
    >
      {!role ? (
        <p className="text-sm text-gray-500 py-4">You don't have a vendor role yet.</p>
      ) : (
        <div className="space-y-4 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InfoTile label="Role" value={role.role_name} />
            <InfoTile label="System role" value={role.role || '—'} />
            <InfoTile label="Permissions" value={String(totalPerms)} />
          </div>

          {totalPerms > 0 && (
            <>
              <Input
                placeholder="Filter permissions…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No permissions match "{filter}"</p>
                ) : filtered.map(group => (
                  <div key={group.ns}>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                      {group.ns}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map(p => (
                        <span
                          key={p}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono bg-gray-50 text-gray-700 border border-gray-200"
                        >
                          <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </SectionWrapper>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{value}</p>
    </div>
  )
}

function ActivitySection({ open, toggle }: { open: boolean; toggle: () => void }) {
  const { user } = useAuthStore()

  const events = useMemo(() => {
    const now = new Date()
    const fmt = (d: Date) =>
      d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    return [
      {
        icon: Monitor,
        title: 'Signed in from this device',
        meta: 'Web · Just now',
        time: fmt(now),
        color: 'text-green-600 bg-green-50 border-green-200',
      },
      ...(user?.updated_at
        ? [{
            icon: UserIcon,
            title: 'Profile last updated',
            meta: 'Account information',
            time: fmt(new Date(user.updated_at)),
            color: 'text-blue-600 bg-blue-50 border-blue-200',
          }]
        : []),
      ...(user?.created_at
        ? [{
            icon: CheckCircle2,
            title: 'Account created',
            meta: 'Welcome to KITERP',
            time: fmt(new Date(user.created_at)),
            color: 'text-primary bg-accent border-primary/30',
          }]
        : []),
    ]
  }, [user?.updated_at, user?.created_at])

  return (
    <SectionWrapper
      title="Recent Activity"
      subtitle="Sign-ins and account events"
      icon={Activity}
      open={open}
      toggle={toggle}
    >
      <div className="pt-3 space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            Detailed login history with device and IP info is coming soon.
          </div>
        </div>
        <ol className="relative border-l border-gray-200 ml-3 space-y-4 pl-5 pt-1">
          {events.map((e, i) => (
            <li key={i} className="relative">
              <span className={cn(
                'absolute -left-[30px] top-0 w-6 h-6 rounded-full border flex items-center justify-center',
                e.color,
              )}>
                <e.icon className="w-3.5 h-3.5" />
              </span>
              <div className="flex flex-col">
                <p className="text-sm font-medium text-gray-900">{e.title}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                  <span>{e.meta}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {e.time}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </SectionWrapper>
  )
}

function QuickLinks() {
  const items: { to: string; icon: ElementType; label: string; desc: string }[] = [
    { to: '/notifications/settings', icon: Bell, label: 'Notification preferences', desc: 'Channels, schedule, sounds' },
    { to: '/team', icon: UsersRound, label: 'Staff Access Control', desc: 'Users, roles, and permissions' },
    { to: '/stores', icon: StoreIcon, label: 'Stores & locations', desc: 'Switch or manage stores' },
    { to: '/plans', icon: CreditCard, label: 'Plans & billing', desc: 'Subscription and invoices' },
  ]
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-accent" />
          <h3 className="text-sm font-semibold text-gray-900">Quick links</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-primary/40 hover:bg-accent/80 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-primary/15 flex items-center justify-center shrink-0 transition-colors">
                <item.icon className="w-4 h-4 text-gray-500 group-hover:text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                <p className="text-xs text-gray-500 truncate">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Identifiers ─────────────────────────────────────────────────────
function IdentifiersSection({ open, toggle }: { open: boolean; toggle: () => void }) {
  const { user } = useAuthStore()
  const { data: vendor } = useMyVendor()

  const rows: { label: string; code: string; full: string; description: string }[] = []
  if (user?.id) {
    rows.push({
      label: 'Business User ID',
      code: formatShortId('USR', user.id),
      full: user.id,
      description: 'Use this when contacting support about your account.',
    })
  }
  if (vendor) {
    rows.push({
      label: 'Business / Vendor ID',
      code: formatVendorCode(vendor),
      full: vendor.id,
      description: 'Identifies your business across orders, invoices, and integrations.',
    })
    if (vendor.subdomain) {
      rows.push({
        label: 'Subdomain',
        code: vendor.subdomain,
        full: vendor.subdomain,
        description: 'Public business front subdomain.',
      })
    }
  }

  return (
    <SectionWrapper
      title="Identifiers"
      subtitle="Your unique IDs across KITERP"
      icon={Hash}
      open={open}
      toggle={toggle}
    >
      <div className="pt-3 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">No identifiers available yet.</p>
        ) : (
          rows.map((r) => (
            <div
              key={r.label}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50/60"
            >
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{r.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
              </div>
              <IdChip label="" code={r.code} fullValue={r.full} className="shrink-0" />
            </div>
          ))
        )}
      </div>
    </SectionWrapper>
  )
}

// ── Verification (email + phone OTP + change-email) ─────────────────
function VerificationSection({ open, toggle }: { open: boolean; toggle: () => void }) {
  const { user } = useAuthStore()
  const level = userVerificationLevel(user)
  return (
    <SectionWrapper
      title="Verification & Contact"
      subtitle="Verify your email and phone, or change your email address"
      icon={ShieldCheck}
      open={open}
      toggle={toggle}
      badge={<VerifiedBadge level={level} />}
    >
      <div className="pt-3 space-y-4">
        <EmailVerifyCard />
        <PhoneVerifyCard />
        <EmailChangeCard />
      </div>
    </SectionWrapper>
  )
}

function EmailVerifyCard() {
  const { user } = useAuthStore()
  const send = useResendEmailVerification()
  const verify = useVerifyEmailCode()
  const [code, setCode] = useState('')
  const [hint, setHint] = useState<string | undefined>()

  const onSend = () => {
    send.mutate(undefined, {
      onSuccess: (res: OtpSendResponse) => {
        if (res.dev_hint) {
          setHint(res.dev_hint)
          setCode(res.dev_hint)
        }
      },
    })
  }
  const onVerify = () => {
    if (code.length !== 6) return
    verify.mutate(code, {
      onSuccess: () => { setCode(''); setHint(undefined) },
    })
  }

  if (user?.is_email_verified) {
    return (
      <VerifyRow
        icon={Mail}
        title="Email"
        value={user.email || ''}
        action={<VerifiedBadge level="verified" size="md" />}
      />
    )
  }

  return (
    <VerifyRow
      icon={Mail}
      title="Email"
      value={user?.email || 'No email on file'}
      action={
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-32 font-mono tracking-widest text-center"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onSend} disabled={send.isPending || !user?.email}>
              {send.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5 mr-1" />}
              Send code
            </Button>
            <Button size="sm" onClick={onVerify} disabled={verify.isPending || code.length !== 6}>
              {verify.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Verify'}
            </Button>
          </div>
        </div>
      }
      footer={
        hint ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
            Dev mode — no SMTP configured. Auto-filled code: <span className="font-mono font-semibold">{hint}</span>
          </p>
        ) : null
      }
    />
  )
}

function PhoneVerifyCard() {
  const { user } = useAuthStore()
  const send = useSendPhoneOtp()
  const verify = useVerifyPhoneOtp()
  const [code, setCode] = useState('')
  const [hint, setHint] = useState<string | undefined>()

  const onSend = () => {
    send.mutate(undefined, {
      onSuccess: (res: OtpSendResponse) => {
        if (res.dev_hint) {
          setHint(res.dev_hint)
          setCode(res.dev_hint)
        }
      },
    })
  }
  const onVerify = () => {
    if (code.length !== 6) return
    verify.mutate(code, {
      onSuccess: () => { setCode(''); setHint(undefined) },
    })
  }

  if (user?.is_phone_verified) {
    return (
      <VerifyRow
        icon={PhoneIcon}
        title="Phone"
        value={user.phone || ''}
        action={<VerifiedBadge level="verified" size="md" />}
      />
    )
  }

  return (
    <VerifyRow
      icon={PhoneIcon}
      title="Phone"
      value={user?.phone || 'No phone on file'}
      action={
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="6-digit OTP"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-32 font-mono tracking-widest text-center"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onSend} disabled={send.isPending || !user?.phone}>
              {send.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5 mr-1" />}
              Send OTP
            </Button>
            <Button size="sm" onClick={onVerify} disabled={verify.isPending || code.length !== 6}>
              {verify.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Verify'}
            </Button>
          </div>
        </div>
      }
      footer={
        <>
          {hint && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
              Dev mode — no SMS provider configured. Auto-filled OTP: <span className="font-mono font-semibold">{hint}</span>
            </p>
          )}
          {!user?.phone && (
            <p className="text-xs text-gray-500 mt-2">
              Add a phone number above in Personal Information first.
            </p>
          )}
        </>
      }
    />
  )
}

function EmailChangeCard() {
  const request = useRequestEmailChange()
  const confirm = useConfirmEmailChange()
  const [step, setStep] = useState<'idle' | 'code'>('idle')
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [hint, setHint] = useState<string | undefined>()

  const onRequest = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.includes('@') || password.length < 1) return
    request.mutate(
      { new_email: newEmail.trim().toLowerCase(), password },
      {
        onSuccess: (res: OtpSendResponse) => {
          setStep('code')
          if (res.dev_hint) {
            setHint(res.dev_hint)
            setCode(res.dev_hint)
          }
        },
      },
    )
  }

  const onConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) return
    confirm.mutate(code, {
      onSuccess: () => {
        setStep('idle')
        setNewEmail(''); setPassword(''); setCode(''); setHint(undefined)
      },
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-gray-900">Change email address</h4>
      </div>

      {step === 'idle' ? (
        <form onSubmit={onRequest} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="new-email">New email</Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new.email@example.com"
            />
          </div>
          <div>
            <Label htmlFor="cur-pwd-email">Current password</Label>
            <Input
              id="cur-pwd-email"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Confirm with password"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" size="sm" disabled={request.isPending || !newEmail.includes('@') || !password}>
              {request.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending…</> : 'Send confirmation code'}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={onConfirm} className="space-y-3">
          <p className="text-xs text-gray-600">
            We sent a 6-digit code to <span className="font-semibold">{newEmail}</span>. Enter it below to swap your email.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="email-change-code">Confirmation code</Label>
              <Input
                id="email-change-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-36 font-mono tracking-widest text-center"
              />
            </div>
            <Button type="submit" size="sm" disabled={confirm.isPending || code.length !== 6}>
              {confirm.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setStep('idle'); setCode(''); setHint(undefined) }}
            >
              Cancel
            </Button>
          </div>
          {hint && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Dev mode — auto-filled code: <span className="font-mono font-semibold">{hint}</span>
            </p>
          )}
        </form>
      )}
    </div>
  )
}

function VerifyRow({
  icon: Icon, title, value, action, footer,
}: {
  icon: ElementType
  title: string
  value: string
  action: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 bg-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500 truncate">{value || '—'}</p>
          </div>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
      {footer}
    </div>
  )
}

// ── Business verification (KYC documents + submit for review) ───────
function BusinessVerificationSection({ open, toggle }: { open: boolean; toggle: () => void }) {
  const { data: vendor, isLoading: vendorLoading } = useMyVendor()
  const { data: docs, isLoading: docsLoading } = useVendorDocuments()
  const submit = useSubmitVendorForReview()
  const level = vendorVerificationLevel(vendor)

  const requiredCount = REQUIRED_DOCUMENT_TYPES.filter(
    t => documentForType(docs, t)?.status === 'approved' || documentForType(docs, t)?.status === 'pending',
  ).length

  const canSubmit =
    !!vendor &&
    requiredCount === REQUIRED_DOCUMENT_TYPES.length &&
    level !== 'verified' &&
    level !== 'in_review'

  return (
    <SectionWrapper
      title="Business Verification"
      subtitle="Upload KYC documents to get a verified badge on your business and stores"
      icon={FileCheck2}
      open={open}
      toggle={toggle}
      badge={<VerifiedBadge level={level} />}
    >
      <div className="pt-3 space-y-4">
        {level === 'rejected' && vendor?.rejection_reason && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Verification rejected</p>
              <p className="text-xs mt-1">{vendor.rejection_reason}</p>
              <p className="text-xs mt-1">Please re-upload the required documents and resubmit.</p>
            </div>
          </div>
        )}
        {level === 'in_review' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Submitted — pending review</p>
              <p className="text-xs mt-1">Our team typically reviews within 1–2 business days. We will email you when it's done.</p>
            </div>
          </div>
        )}

        {(vendorLoading || docsLoading) ? (
          <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading documents…</div>
        ) : (
          <div className="space-y-3">
            {ALL_DOCUMENT_TYPES.map((type) => (
              <DocumentRow key={type} type={type} doc={documentForType(docs, type)} />
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t">
          <p className="text-xs text-gray-500">
            {requiredCount} / {REQUIRED_DOCUMENT_TYPES.length} required documents uploaded.
            {level === 'verified' && ' Your business is verified.'}
          </p>
          <Button
            size="sm"
            onClick={() => submit.mutate()}
            disabled={!canSubmit || submit.isPending}
            className="bg-primary hover:bg-primary/90 disabled:opacity-50"
          >
            {submit.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Submitting…</> : 'Submit for review'}
          </Button>
        </div>
      </div>
    </SectionWrapper>
  )
}

function DocumentRow({
  type, doc,
}: {
  type: VendorDocumentType
  doc: import('@/types').VendorDocument | undefined
}) {
  const upload = useUploadVendorDocument()
  const fileRef = useRef<HTMLInputElement>(null)
  const meta = DOCUMENT_LABELS[type]
  const required = REQUIRED_DOCUMENT_TYPES.includes(type)

  const onPick = () => fileRef.current?.click()
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File is too large (max 10 MB).')
      return
    }
    upload.mutate({ documentType: type, file: f }, {
      onSettled: () => { if (fileRef.current) fileRef.current.value = '' },
    })
  }

  const statusBadge = doc ? (
    doc.status === 'approved' ? <VerifiedBadge level="verified" label="Approved" />
      : doc.status === 'rejected' ? <VerifiedBadge level="rejected" />
        : <VerifiedBadge level="in_review" label="Pending" />
  ) : (
    <VerifiedBadge level="unverified" label="Not uploaded" />
  )

  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-white">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-gray-500" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
              {required && (
                <span className="text-xs font-medium uppercase text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">Required</span>
              )}
              {statusBadge}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{meta.hint}</p>
            {doc && (
              <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                <span className="truncate max-w-[200px]" title={doc.file_name || ''}>{doc.file_name || 'Document'}</span>
                {doc.file_url && (
                  <a
                    href={doc.file_url.startsWith('http') ? doc.file_url : `${API_BASE}${doc.file_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:text-primary"
                  >
                    <ExternalLink className="w-3 h-3" /> View
                  </a>
                )}
              </div>
            )}
            {doc?.status === 'rejected' && doc.rejection_reason && (
              <p className="text-xs text-red-600 mt-1">Rejected: {doc.rejection_reason}</p>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={onFile}
          />
          <Button size="sm" variant="outline" onClick={onPick} disabled={upload.isPending}>
            {upload.isPending ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Uploading…</>
            ) : doc ? (
              <><Upload className="w-3.5 h-3.5 mr-1.5" /> Replace</>
            ) : (
              <><Upload className="w-3.5 h-3.5 mr-1.5" /> Upload</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function DangerZone() {
  const logout = useLogout()
  return (
    <Card className="border-red-200">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-red-200 bg-red-50/40">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">Sign out</p>
            <p className="text-xs text-gray-500">End your current session on this device.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 shrink-0"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
