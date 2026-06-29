import { useState, useMemo, useRef, useEffect, type ElementType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/authStore'
import {
  useMe, useUpdateMe, useChangePassword, useUploadAvatar, useLogout, useDeleteAccount, useRequestAccountDeleteOtp,
  useResendEmailVerification, useVerifyEmailCode,
  useSendPhoneOtp, useVerifyPhoneOtp,
} from '@/hooks/useAuth'
import {
  useMyContactChangeRequests,
  useCreateContactChangeRequest,
  useCancelContactChangeRequest,
  pendingContactChange,
} from '@/hooks/useContactChange'
import type { ContactChangeRequestRow, ContactFieldType } from '@/api/contactChange'
import { authApi } from '@/api/auth'
import { useMyVendor, useVendorDocuments, useUploadVendorDocument, useSubmitVendorForReview } from '@/hooks/useVendor'
import {
  User as UserIcon, Mail, Phone as PhoneIcon, Camera, Loader2, Save, ShieldCheck,
  KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle,
  Activity, LogOut, Bell, Store as StoreIcon, UsersRound, CreditCard, ShieldAlert,
  Lock, Clock, Monitor, Smartphone, Calendar, FileCheck2, Upload, Hash, FileText,
  ExternalLink, RefreshCcw, Info, X, Trash2,
} from 'lucide-react'
import { cn, mediaUrl } from '@/lib/utils'
import { useImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { CollapsibleSection } from '@/components/common/CollapsibleSection'
import { toast } from 'sonner'
import {
  IdChip, formatShortId, formatVendorCode, VerifiedBadge,
  vendorVerificationLevel, userVerificationLevel,
  ALL_DOCUMENT_TYPES, REQUIRED_DOCUMENT_TYPES, DOCUMENT_LABELS, documentForType,
} from '@/lib/verification'
import type { VendorDocumentType } from '@/types'
import type { OtpSendResponse } from '@/api/auth'

type Section = 'identifiers' | 'personal' | 'security' | 'business' | 'role' | 'activity'

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

  const { openPicker, modal } = useImageSourcePicker({
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

  const businessLevel = vendorVerificationLevel(vendor)
  const businessLabel =
    businessLevel === 'verified' ? 'verified'
    : businessLevel === 'in_review' ? 'in review'
    : businessLevel === 'rejected' ? 'rejected'
    : 'unverified'

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <div className="h-20 sm:h-24 bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--hero-via))_48%,hsl(var(--hero-to))_100%)]" />

      <CardContent className="px-4 pb-5 pt-0 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5 -mt-11 sm:-mt-12">
          <div className="relative shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={onPickFile}
              disabled={upload.isPending}
              aria-label={user?.avatar_url ? 'Change profile photo' : 'Add profile photo'}
              className={cn(
                'group relative flex h-[5.5rem] w-[5.5rem] sm:h-24 sm:w-24 items-center justify-center overflow-hidden rounded-full',
                'bg-[linear-gradient(140deg,hsl(var(--primary))_0%,hsl(var(--hero-via))_45%,hsl(var(--hero-to))_100%)]',
                'text-white shadow-lg ring-4 ring-card transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
                upload.isPending && 'cursor-wait opacity-80',
              )}
            >
              {user?.avatar_url ? (
                <img
                  src={mediaUrl(user.avatar_url)}
                  alt={user.full_name || 'Profile photo'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold tracking-tight sm:text-3xl">{initials}</span>
              )}

              <span
              className={cn(
                  'absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-full bg-black/45 text-white transition-opacity',
                  upload.isPending ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
              )}
            >
              {upload.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <>
                    <Camera className="h-4 w-4" aria-hidden />
                    <span className="text-[10px] font-medium leading-none">
                      {user?.avatar_url ? 'Change' : 'Add photo'}
                    </span>
                  </>
                )}
              </span>
            </button>
            {modal}
          </div>

          <div className="min-w-0 flex-1 space-y-3 pb-0.5">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="truncate text-xl font-bold leading-tight text-foreground">{user?.full_name}</h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-accent px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden />
                {role}
              </span>
            </div>
              {user?.email && (
                <p className="truncate text-sm text-muted-foreground" title={user.email}>
                  {user.email}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <VerifiedChip label="Email" verified={!!user?.is_email_verified} />
              <VerifiedChip label="Phone" verified={!!user?.is_phone_verified} />
              <VerifiedBadge level={businessLevel} label={`Business ${businessLabel}`} />
              {memberSince && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                  Member since {memberSince}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {user?.id && (
                <IdChip label="User" code={formatShortId('USR', user.id)} fullValue={user.id} />
              )}
              {vendor && (
                <IdChip label="Business" code={formatVendorCode(vendor)} fullValue={vendor.id} />
              )}
            </div>
          </div>

          <div className="shrink-0 sm:pb-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onPickFile}
              disabled={upload.isPending}
              className="h-9 w-full sm:w-auto"
            >
              {upload.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
                  Uploading…
                </>
              ) : (
                <>
                  <Camera className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {user?.avatar_url ? 'Change photo' : 'Add photo'}
                </>
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
    <span className="inline-flex items-center gap-1 rounded-full border border-green-200/80 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
      <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
      {label} verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />
      {label} not verified
    </span>
  )
}

function splitPersonName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  if (!trimmed) return { firstName: '', lastName: '' }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function joinPersonName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
}

function phoneForDisplay(stored: string | null | undefined): string {
  const raw = (stored ?? '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91') && /^[6789]/.test(digits.slice(2))) {
    return digits.slice(2)
  }
  return digits || raw
}

function phonesEquivalent(a: string, b: string): boolean {
  const da = phoneForDisplay(a)
  const db = phoneForDisplay(b)
  if (!da && !db) return true
  if (!da || !db) return false
  if (da === db) return true
  const shorter = da.length <= db.length ? da : db
  const longer = da.length <= db.length ? db : da
  return shorter.length >= 10 && longer.endsWith(shorter)
}

function PersonalInfoSection({ open, toggle }: { open: boolean; toggle: () => void }) {
  const { user } = useAuthStore()
  const update = useUpdateMe()
  const level = userVerificationLevel(user)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState(() => phoneForDisplay(user?.phone))
  const [phoneVerifiedReadyToSave, setPhoneVerifiedReadyToSave] = useState(false)

  useEffect(() => {
    const { firstName: first, lastName: last } = splitPersonName(user?.full_name || '')
    setFirstName(first)
    setLastName(last)
    setPhone(phoneForDisplay(user?.phone))
  }, [user?.full_name, user?.phone])

  const savedFullName = (user?.full_name || '').trim()
  const draftFullName = joinPersonName(firstName, lastName)
  const phoneChanged = !phonesEquivalent(phone, user?.phone || '')

  const dirty =
    draftFullName !== savedFullName ||
    phoneChanged ||
    (Boolean(phone.trim()) && !user?.is_phone_verified)

  const phoneNeedsVerification =
    Boolean(phone.trim()) && (phoneChanged || !user?.is_phone_verified)

  const canSave = (dirty || phoneVerifiedReadyToSave) && !phoneNeedsVerification

  const onSave = () => {
    if (!firstName.trim()) {
      toast.error('First name is required')
      return
    }
    if (phoneNeedsVerification) {
      toast.error('Verify your phone number with OTP before saving changes')
      return
    }
    const full_name = joinPersonName(firstName, lastName)
    if (full_name.length < 2) {
      toast.error('Name must be at least 2 characters')
      return
    }
    update.mutate(
      {
        full_name,
        phone: phone.trim() || null,
      },
      {
        onSuccess: () => {
          setPhoneVerifiedReadyToSave(false)
        },
      },
    )
  }

  const onReset = () => {
    const { firstName: first, lastName: last } = splitPersonName(user?.full_name || '')
    setFirstName(first)
    setLastName(last)
    setPhone(phoneForDisplay(user?.phone))
    setPhoneVerifiedReadyToSave(false)
  }

  return (
    <SectionWrapper
      title="Contact Information"
      subtitle="Your name, contact details, and verification"
      icon={UserIcon}
      open={open}
      toggle={toggle}
      badge={<VerifiedBadge level={level} />}
    >
      <div className="space-y-2 pt-0.5">
        <UnsavedChangesBar
          dirty={dirty || phoneVerifiedReadyToSave}
          onSave={onSave}
          onReset={onReset}
          saving={update.isPending}
          saveDisabled={!canSave}
          saveHint={
            phoneNeedsVerification
              ? 'Verify your phone with OTP before you can save changes.'
              : phoneVerifiedReadyToSave
                ? 'Phone verified — click Save changes to finish.'
                : undefined
          }
        />

        <div className="overflow-hidden rounded-xl border border-border/60 bg-muted/10">
          <div className="border-b border-border/50 bg-muted/20 px-3 py-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Profile & contact
            </p>
          </div>
          <div className="space-y-2.5 p-2.5">
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <div>
                <Label htmlFor="first-name" dbTable="user" dbField="full_name" className="text-xs">
                  First name
            </Label>
            <Input
                  id="first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  maxLength={60}
                  autoComplete="given-name"
                  className="mt-0.5 h-9"
            />
          </div>
          <div>
                <Label htmlFor="last-name" className="text-xs">
                  Last name
                </Label>
              <Input
                  id="last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  maxLength={60}
                  autoComplete="family-name"
                  className="mt-0.5 h-9"
                />
          </div>
        </div>

            <EmailFieldWithVerification />

            <PhoneFieldWithVerification
              phone={phone}
              onPhoneChange={(value) => {
                setPhone(value)
                setPhoneVerifiedReadyToSave(false)
              }}
              phoneDirty={phoneChanged}
              onPhoneVerified={() => setPhoneVerifiedReadyToSave(true)}
          />
        </div>
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

const verifyRowHeight = 'h-8 sm:h-9'
const verifyOtpInputClass = cn(
  verifyRowHeight,
  'w-[7.25rem] shrink-0 rounded-md border border-input bg-background px-2 text-center text-xs font-mono tracking-[0.18em] shadow-none focus-visible:ring-2 focus-visible:ring-ring',
)
const verifyActionBtnClass = cn(
  verifyRowHeight,
  'shrink-0 rounded-md px-2.5 text-xs font-medium',
)
const verifyActionsWrapClass = cn(
  'flex min-h-8 shrink-0 flex-wrap items-center gap-1.5 sm:min-h-9 sm:flex-nowrap',
)

function UnsavedChangesBar({
  dirty,
  onSave,
  onReset,
  saving,
  saveDisabled,
  saveHint,
}: {
  dirty: boolean
  onSave: () => void
  onReset: () => void
  saving: boolean
  saveDisabled?: boolean
  saveHint?: string
}) {
  return (
    <div className={cn(
      'flex flex-col gap-2 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between',
      dirty
        ? 'border-amber-200/80 bg-amber-50/90 dark:border-amber-500/30 dark:bg-amber-500/10'
        : 'border-border/60 bg-muted/20',
    )}>
      <div className="space-y-1">
        <p className={cn(
          'flex items-center gap-1.5 text-xs font-medium',
          dirty ? 'text-amber-900 dark:text-amber-100' : 'text-muted-foreground',
        )}>
          {dirty ? (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          {dirty ? 'You have unsaved changes' : 'No unsaved changes'}
        </p>
        {saveHint ? (
          <p className="text-xs text-amber-800/90 dark:text-amber-100/80">{saveHint}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={saving || !dirty}
          className="h-8 rounded-full px-3 text-xs"
        >
          Discard
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving || saveDisabled}
          className="h-8 rounded-full px-3 text-xs"
        >
          {saving ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…</>
          ) : (
            <><Save className="mr-1.5 h-3.5 w-3.5" /> Save changes</>
          )}
        </Button>
      </div>
    </div>
  )
}

function ContactFieldWithVerify({
  label,
  htmlFor,
  headerExtra,
  field,
  verify,
  footer,
}: {
  label: string
  htmlFor?: string
  headerExtra?: ReactNode
  field: ReactNode
  verify?: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-xs">{label}</Label>
        {headerExtra}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-2">
        <div className="min-w-0">{field}</div>
        {verify ? (
          <div className={verifyActionsWrapClass}>
            {verify}
          </div>
        ) : null}
      </div>
      {footer ? <div className="space-y-1 pt-1">{footer}</div> : null}
    </div>
  )
}

function VerificationOtpActions({
  code,
  onCodeChange,
  placeholder,
  sendLabel,
  onSend,
  onVerify,
  sendPending,
  verifyPending,
  sendDisabled,
  verifyDisabled,
}: {
  code: string
  onCodeChange: (value: string) => void
  placeholder: string
  sendLabel: string
  onSend: () => void
  onVerify: () => void
  sendPending: boolean
  verifyPending: boolean
  sendDisabled?: boolean
  verifyDisabled?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Input
        inputMode="numeric"
        maxLength={6}
        placeholder={placeholder}
        value={code}
        onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className={verifyOtpInputClass}
        aria-label={placeholder}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onSend}
        disabled={sendPending || sendDisabled}
        className={cn(verifyActionBtnClass, 'gap-1.5')}
      >
        {sendPending ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        ) : (
          <RefreshCcw className="h-3.5 w-3.5 shrink-0" />
        )}
        {sendLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={onVerify}
        disabled={verifyPending || verifyDisabled || code.length !== 6}
        className={verifyActionBtnClass}
      >
        {verifyPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Verify'}
      </Button>
    </div>
  )
}

function ChangeContactLink({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}

function PendingContactChangeBanner({
  request,
  onCancel,
  cancelling,
}: {
  request: ContactChangeRequestRow
  onCancel: () => void
  cancelling: boolean
}) {
  const label = request.field_type === 'email' ? 'email' : 'phone number'
  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-xs text-amber-900 dark:text-amber-100">
          <span className="font-medium">Pending {label} change</span>
          <span className="text-amber-800/90 dark:text-amber-100/90"> · {request.requested_value}</span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={cancelling}
          className="h-7 shrink-0 self-end rounded-full px-2.5 text-xs sm:self-auto"
        >
          {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Cancel'}
        </Button>
      </div>
    </div>
  )
}

function ContactChangeRequestPanel({
  fieldType,
  onClose,
}: {
  fieldType: ContactFieldType
  onClose: () => void
}) {
  const create = useCreateContactChangeRequest()
  const [newValue, setNewValue] = useState('')
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')

  const isEmail = fieldType === 'email'
  const title = isEmail ? 'Request email change' : 'Request phone number change'
  const Icon = isEmail ? Mail : PhoneIcon

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || !newValue.trim()) return
    if (isEmail && !newValue.includes('@')) return
    create.mutate(
      {
        field_type: fieldType,
        new_value: newValue.trim(),
        reason: reason.trim() || undefined,
        password,
      },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <div className="mt-1.5 rounded-lg border border-border/60 bg-background/80 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-semibold text-foreground">
          <Icon className="h-3.5 w-3.5 text-primary" />
          {title}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close change request form"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <Label htmlFor={`new-${fieldType}`} className="text-xs">
              {isEmail ? 'New email' : 'New phone'}
            </Label>
            {isEmail ? (
              <Input
                id={`new-${fieldType}`}
                type="email"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="new.email@example.com"
                className="mt-0.5 h-9"
              />
            ) : (
              <Input
                id={`new-${fieldType}`}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Mobile number"
                className="mt-0.5 h-9"
              />
            )}
          </div>
          <div>
            <Label htmlFor={`pwd-${fieldType}`} className="text-xs">Current password</Label>
            <Input
              id={`pwd-${fieldType}`}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Confirm identity"
              className="mt-0.5 h-9"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <Label htmlFor={`reason-${fieldType}`} className="text-xs">
              Reason (optional)
            </Label>
            <Input
              id={`reason-${fieldType}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you changing this?"
              className="mt-0.5 h-9"
              maxLength={500}
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-8 rounded-full px-2.5 text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={create.isPending || !password || !newValue.trim() || (isEmail && !newValue.includes('@'))}
              className="h-8 rounded-full px-2.5 text-xs"
            >
              {create.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Submit'
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

function EmailFieldWithVerification() {
  const { user } = useAuthStore()
  const send = useResendEmailVerification()
  const verify = useVerifyEmailCode()
  const { data: changeRequests } = useMyContactChangeRequests()
  const cancelChange = useCancelContactChangeRequest()
  const [code, setCode] = useState('')
  const [hint, setHint] = useState<string | undefined>()
  const [showChangeForm, setShowChangeForm] = useState(false)
  const pendingEmail = pendingContactChange(changeRequests, 'email')

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

    return (
    <div className="space-y-1.5">
      <ContactFieldWithVerify
        label="Email"
        htmlFor="email"
        headerExtra={
          user?.is_email_verified && !showChangeForm && !pendingEmail ? (
            <ChangeContactLink
              label="Change email"
              onClick={() => setShowChangeForm(true)}
            />
          ) : null
        }
        field={
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
              id="email"
              value={user?.email || ''}
              readOnly
              disabled
              className="h-8 bg-muted/40 pl-9 text-muted-foreground sm:h-9"
            />
        </div>
      }
        verify={
          user?.is_email_verified ? (
            <div className={cn('flex items-center', verifyRowHeight)}>
              <VerifiedBadge level="verified" size="sm" />
            </div>
          ) : (
            <VerificationOtpActions
              code={code}
              onCodeChange={setCode}
              placeholder="6-digit code"
              sendLabel="Send code"
              onSend={onSend}
              onVerify={onVerify}
              sendPending={send.isPending}
              verifyPending={verify.isPending}
              sendDisabled={!user?.email}
            />
          )
      }
      footer={
        hint ? (
            <p className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
              Dev mode — auto-filled code: <span className="font-mono font-semibold">{hint}</span>
          </p>
        ) : null
      }
    />

      {pendingEmail && (
        <PendingContactChangeBanner
          request={pendingEmail}
          onCancel={() => cancelChange.mutate(pendingEmail.id)}
          cancelling={cancelChange.isPending}
        />
      )}

      {showChangeForm && !pendingEmail && (
        <ContactChangeRequestPanel fieldType="email" onClose={() => setShowChangeForm(false)} />
      )}
    </div>
  )
}

function PhoneFieldWithVerification({
  phone,
  onPhoneChange,
  phoneDirty,
  onPhoneVerified,
}: {
  phone: string
  onPhoneChange: (value: string) => void
  phoneDirty: boolean
  onPhoneVerified?: () => void
}) {
  const { user, setUser } = useAuthStore()
  const send = useSendPhoneOtp()
  const verify = useVerifyPhoneOtp()
  const [code, setCode] = useState('')
  const [hint, setHint] = useState<string | undefined>()
  const [stagingPhone, setStagingPhone] = useState(false)

  const phoneDigits = phone.replace(/\D/g, '')
  const hasValidPhone = phoneDigits.length === 10
  const phoneChanged = phoneDirty
  const showVerifiedBadge = Boolean(user?.is_phone_verified && !phoneChanged && phone.trim())
  const needsOtp = Boolean(phone.trim()) && (!user?.is_phone_verified || phoneChanged)

  const onSend = async () => {
    if (!hasValidPhone) {
      toast.error('Enter a valid mobile number first')
      return
    }
    setStagingPhone(true)
    send.mutate(phone.trim(), {
      onSuccess: async (res: OtpSendResponse) => {
        if (res.dev_hint) {
          setHint(res.dev_hint)
          setCode(res.dev_hint)
        }
        try {
          const me = await authApi.getMe()
          setUser(me)
          if (me.phone) onPhoneChange(phoneForDisplay(me.phone))
        } catch {
          /* OTP sent; profile refresh is best-effort */
        }
      },
      onSettled: () => {
        setStagingPhone(false)
      },
    })
  }
  const onVerify = () => {
    if (code.length !== 6) return
    verify.mutate(code, {
      onSuccess: (updatedUser) => {
        setCode('')
        setHint(undefined)
        setUser(updatedUser)
        if (updatedUser.phone) {
          onPhoneChange(phoneForDisplay(updatedUser.phone))
        }
        onPhoneVerified?.()
      },
    })
  }

  const verifyBlocked = !hasValidPhone || stagingPhone || send.isPending
  const verifyHint = !phone.trim()
    ? 'Clear the field to remove your number, or enter a new one and verify with OTP.'
    : !hasValidPhone
      ? 'Enter a valid mobile number, then tap Send OTP.'
      : needsOtp
        ? 'Send OTP to verify this number, then save your profile.'
        : null

  return (
    <div className="space-y-1.5">
      <ContactFieldWithVerify
        label="Phone number"
        htmlFor="phone"
        headerExtra={
          phone.trim() ? (
            <button
              type="button"
              onClick={() => onPhoneChange('')}
              className="text-xs font-medium text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          ) : null
        }
        field={
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="Mobile number"
            className={cn(verifyRowHeight, 'font-mono tabular-nums')}
          />
        }
        verify={
          showVerifiedBadge ? (
            <div className={cn('flex items-center', verifyRowHeight)}>
              <VerifiedBadge level="verified" size="sm" />
            </div>
          ) : needsOtp ? (
            <VerificationOtpActions
              code={code}
              onCodeChange={setCode}
              placeholder="6-digit OTP"
              sendLabel="Send OTP"
              onSend={onSend}
              onVerify={onVerify}
              sendPending={send.isPending || stagingPhone}
              verifyPending={verify.isPending}
              sendDisabled={verifyBlocked}
            />
          ) : null
        }
        footer={
          <>
            {verifyHint ? (
              <p className="text-xs text-muted-foreground">{verifyHint}</p>
            ) : null}
            {hint ? (
              <p className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
                Dev mode — auto-filled OTP: <span className="font-mono font-semibold">{hint}</span>
              </p>
            ) : null}
          </>
        }
      />
    </div>
  )
}

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
  const requestDeleteOtp = useRequestAccountDeleteOtp()
  const deleteAccount = useDeleteAccount()
  const [showDeleteForm, setShowDeleteForm] = useState(false)
  const [deleteStep, setDeleteStep] = useState<'password' | 'otp'>('password')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteCode, setDeleteCode] = useState('')
  const [otpHint, setOtpHint] = useState<string | null>(null)
  const [otpDestination, setOtpDestination] = useState<string | null>(null)
  const [otpChannel, setOtpChannel] = useState<'email' | 'phone' | null>(null)

  const onSendDeleteOtp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!deletePassword) return
    requestDeleteOtp.mutate(deletePassword, {
      onSuccess: (res) => {
        setDeleteStep('otp')
        setOtpDestination(res.to)
        setOtpChannel(res.channel)
        setDeleteCode('')
        setOtpHint(res.dev_hint ?? null)
        if (res.dev_hint) setDeleteCode(res.dev_hint)
        toast.success(`Verification code sent to ${res.to}`)
      },
    })
  }

  const onConfirmDelete = (e: React.FormEvent) => {
    e.preventDefault()
    if (deleteCode.length !== 6) return
    deleteAccount.mutate(deleteCode)
  }

  const onResendDeleteOtp = () => {
    if (!deletePassword) return
    requestDeleteOtp.mutate(deletePassword, {
      onSuccess: (res) => {
        setOtpDestination(res.to)
        setOtpChannel(res.channel)
        setOtpHint(res.dev_hint ?? null)
        if (res.dev_hint) setDeleteCode(res.dev_hint)
        toast.success(`New code sent to ${res.to}`)
      },
    })
  }

  const closeDeleteForm = () => {
    setShowDeleteForm(false)
    setDeleteStep('password')
    setDeletePassword('')
    setDeleteCode('')
    setOtpHint(null)
    setOtpDestination(null)
    setOtpChannel(null)
  }

  const deleteBusy = requestDeleteOtp.isPending || deleteAccount.isPending

  return (
    <Card className="border-red-200">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
        </div>
        <div className="space-y-3">
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

          <div className="rounded-lg border border-red-200 bg-red-50/40 p-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">Delete account</p>
                <p className="text-xs text-gray-500">
                  Permanently delete your login and any business accounts you own with no customer orders.
                </p>
              </div>
              {!showDeleteForm && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteForm(true)}
                  className="text-red-700 border-red-300 hover:bg-red-100 hover:text-red-800 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete account
                </Button>
              )}
            </div>

            {showDeleteForm && deleteStep === 'password' && (
              <form onSubmit={onSendDeleteOtp} className="mt-3 space-y-2 border-t border-red-200/80 pt-3">
                <p className="text-xs text-red-800">
                  This cannot be undone. Enter your password — we&apos;ll send a verification code to confirm deletion.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <Label htmlFor="delete-account-password" className="text-xs">
                      Current password
                    </Label>
                    <Input
                      id="delete-account-password"
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Your password"
                      autoComplete="current-password"
                      className="mt-0.5 h-9"
                    />
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={closeDeleteForm}
                      disabled={deleteBusy}
                      className="h-8 rounded-full px-2.5 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={deleteBusy || !deletePassword}
                      className="h-8 rounded-full bg-red-600 px-2.5 text-xs hover:bg-red-700"
                    >
                      {requestDeleteOtp.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Send verification code'
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {showDeleteForm && deleteStep === 'otp' && (
              <form onSubmit={onConfirmDelete} className="mt-3 space-y-2 border-t border-red-200/80 pt-3">
                <p className="text-xs text-red-800">
                  Enter the 6-digit code sent to{' '}
                  <span className="font-medium">{otpDestination}</span>
                  {otpChannel === 'email' ? ' (email)' : otpChannel === 'phone' ? ' (SMS)' : ''}.
                </p>
                {otpHint && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                    Dev mode: code is <span className="font-mono font-semibold">{otpHint}</span>
                  </p>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <Label htmlFor="delete-account-otp" className="text-xs">
                      Verification code
                    </Label>
                    <Input
                      id="delete-account-otp"
                      inputMode="numeric"
                      maxLength={6}
                      value={deleteCode}
                      onChange={(e) => setDeleteCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code"
                      autoComplete="one-time-code"
                      className="mt-0.5 h-9 font-mono tracking-widest"
                    />
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeleteStep('password')
                        setDeleteCode('')
                        setOtpHint(null)
                      }}
                      disabled={deleteBusy}
                      className="h-8 rounded-full px-2.5 text-xs"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onResendDeleteOtp}
                      disabled={deleteBusy || !deletePassword}
                      className="h-8 rounded-full px-2.5 text-xs"
                    >
                      {requestDeleteOtp.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                          Resend
                        </>
                      )}
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={deleteBusy || deleteCode.length !== 6}
                      className="h-8 rounded-full bg-red-600 px-2.5 text-xs hover:bg-red-700"
                    >
                      {deleteAccount.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Delete permanently'
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
