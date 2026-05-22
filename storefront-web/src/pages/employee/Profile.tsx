import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useESSProfile, useESSUpdateProfile } from '@/hooks/useESS'
import { useHrAuthStore } from '@/stores/hrAuthStore'
import { hrApiClient } from '@/api/hrClient'
import { useVendor } from '@/contexts/VendorContext'
import { User, Phone, Mail, AlertCircle, KeyRound, Eye, EyeOff, Loader2, Save, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border p-6 mb-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b">
        <Icon className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">{value || <span className="text-gray-400">—</span>}</p>
    </div>
  )
}

export default function ESSProfile() {
  const { storePath } = useVendor()
  const navigate = useNavigate()
  const { employee } = useHrAuthStore()
  const { data: profile, isLoading } = useESSProfile()
  const updateProfile = useESSUpdateProfile()

  const emp = profile?.employee as Record<string, unknown> | undefined

  // ── Contact edit ────────────────────────────────────────────────────────────
  const [editContact, setEditContact] = useState(false)
  const [contactForm, setContactForm] = useState({
    personal_email: '',
    personal_phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
  })

  function openContactEdit() {
    setContactForm({
      personal_email: String(emp?.personal_email ?? ''),
      personal_phone: String(emp?.personal_phone ?? ''),
      emergency_contact_name: String(emp?.emergency_contact_name ?? ''),
      emergency_contact_phone: String(emp?.emergency_contact_phone ?? ''),
      emergency_contact_relation: String(emp?.emergency_contact_relation ?? ''),
    })
    setEditContact(true)
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault()
    const data: Record<string, unknown> = {}
    Object.entries(contactForm).forEach(([k, v]) => { if (v.trim()) data[k] = v.trim() })
    await updateProfile.mutateAsync(data)
    setEditContact(false)
  }

  // ── Change password ──────────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState({ current: false, next: false })
  const [pwSaving, setPwSaving] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.next.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    setPwSaving(true)
    try {
      await hrApiClient.post('/store/hr/change-password', {
        current_password: pwForm.current,
        new_password: pwForm.next,
      })
      toast.success('Password changed successfully')
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } }
      toast.error(ax.response?.data?.detail ?? 'Could not change password')
    } finally {
      setPwSaving(false)
    }
  }

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading…</div>

  const designation = (emp?.designation as { name?: string } | undefined)?.name ?? ''
  const department = (emp?.department as { name?: string } | undefined)?.name ?? ''

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">My Profile</h1>

      {/* ── Identity ── */}
      <Section title="Employee Information" icon={User}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full name" value={employee?.full_name} />
          <Field label="Employee code" value={String(emp?.employee_code ?? '')} />
          {(emp?.employee_code_custom as string | undefined) && (
            <Field label="Custom code / username" value={emp.employee_code_custom as string} />
          )}
          <Field label="Department" value={department} />
          <Field label="Designation" value={designation} />
          <Field label="Employment type" value={String(emp?.employment_type ?? '').replace('_', ' ')} />
          <Field label="Status" value={String(emp?.status ?? '')} />
          <Field label="Date of joining" value={emp?.date_of_joining as string | null} />
          <Field label="Login (email)" value={employee?.email} />
        </div>
      </Section>

      {/* ── Contact ── */}
      <Section title="Personal Contact" icon={Phone}>
        {!editContact ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Personal email" value={emp?.personal_email as string | null} />
              <Field label="Personal phone" value={emp?.personal_phone as string | null} />
              <Field label="Emergency contact" value={emp?.emergency_contact_name as string | null} />
              <Field label="Emergency phone" value={emp?.emergency_contact_phone as string | null} />
              <Field label="Relationship" value={emp?.emergency_contact_relation as string | null} />
            </div>
            <button
              type="button"
              onClick={openContactEdit}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit contact details
            </button>
          </>
        ) : (
          <form onSubmit={saveContact} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Personal email</label>
                <input type="email" value={contactForm.personal_email} onChange={e => setContactForm(f => ({ ...f, personal_email: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Personal phone</label>
                <input type="tel" value={contactForm.personal_phone} onChange={e => setContactForm(f => ({ ...f, personal_phone: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Emergency contact name</label>
                <input value={contactForm.emergency_contact_name} onChange={e => setContactForm(f => ({ ...f, emergency_contact_name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Emergency phone</label>
                <input type="tel" value={contactForm.emergency_contact_phone} onChange={e => setContactForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Relationship</label>
                <input value={contactForm.emergency_contact_relation} onChange={e => setContactForm(f => ({ ...f, emergency_contact_relation: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" placeholder="e.g. Spouse, Parent" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={updateProfile.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                {updateProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
              <button type="button" onClick={() => setEditContact(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          </form>
        )}
      </Section>

      {/* ── Change password ── */}
      <Section title="Change Password" icon={KeyRound}>
        <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
          {[
            { id: 'cur', label: 'Current password', field: 'current' as const, show: showPw.current, toggle: () => setShowPw(p => ({ ...p, current: !p.current })) },
            { id: 'nxt', label: 'New password', field: 'next' as const, show: showPw.next, toggle: () => setShowPw(p => ({ ...p, next: !p.next })) },
          ].map(({ id, label, field, show, toggle }) => (
            <div key={id}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} autoComplete={field === 'current' ? 'current-password' : 'new-password'}
                  value={pwForm[field]} onChange={e => setPwForm(p => ({ ...p, [field]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm pr-9 outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder={field === 'next' ? 'Min 8 characters' : ''} />
                <button type="button" onClick={toggle} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Confirm new password</label>
            <input type="password" autoComplete="new-password" value={pwForm.confirm}
              onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <button type="submit" disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
            {pwSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
            Change password
          </button>
        </form>
      </Section>

      {/* ── Account / logout ── */}
      <Section title="Account" icon={Mail}>
        <p className="text-sm text-gray-500 mb-3">
          Your HR portal login: <span className="font-mono text-gray-800">{employee?.email ?? employee?.employee_code ?? '—'}</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { useHrAuthStore.getState().logout(); navigate(storePath('/hr/login'), { replace: true }) }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
          >
            Sign out
          </button>
        </div>
      </Section>
    </div>
  )
}
