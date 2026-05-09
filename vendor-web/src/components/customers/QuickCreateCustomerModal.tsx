/**
 * QuickCreateCustomerModal
 *
 * A floating modal used everywhere a customer needs to be created on-the-fly
 * (POS, Bookings, Production Orders, etc.).
 *
 * Features
 * ─────────
 * • Name / PhoneInput / Email fields
 * • Debounced duplicate-check as the user types phone or email
 * • Shows CustomerDuplicateWarning with "Use this record" / "Add linked name" actions
 * • On successful create → passes the new Customer back via onSelect
 * • On 409 conflict → searches and selects the existing record automatically
 * • "Enter full details" link → navigates to the new-customer form
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { CustomerDuplicateWarning } from '@/components/customers/CustomerDuplicateWarning'
import { vendorApi } from '@/api/vendor'
import type { Customer, CustomerDuplicateMatch } from '@/types'
import { useCreateCustomer } from '@/hooks/useVendor'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import {
  X, UserPlus, Loader2, Plus, ExternalLink,
} from 'lucide-react'

interface Props {
  /** Called when a customer is selected (created or chosen from duplicates) */
  onSelect: (customer: Pick<Customer, 'id' | 'full_name' | 'phone' | 'email'>) => void
  onClose: () => void
  /** Optional path suffix for the "Enter full details" link, e.g. "?returnTo=pos" */
  returnTo?: string
}

export function QuickCreateCustomerModal({ onSelect, onClose, returnTo }: Props) {
  const navigate = useNavigate()
  const createCustomerMut = useCreateCustomer()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const [dupMatches, setDupMatches] = useState<CustomerDuplicateMatch[]>([])
  const [dupDismissed, setDupDismissed] = useState(false)
  const [dupLoading, setDupLoading] = useState(false)

  // ── Duplicate check ──────────────────────────────────────────────
  const runDupCheck = useCallback(async (p: string, e: string) => {
    if (!p && !e) { setDupMatches([]); return }
    setDupLoading(true)
    try {
      const matches = await vendorApi.checkCustomerDuplicates({
        phone: p || undefined,
        email: e || undefined,
      })
      setDupMatches(matches)
      if (matches.length) setDupDismissed(false)
    } catch {
      setDupMatches([])
    } finally {
      setDupLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => runDupCheck(phone, email), 500)
    return () => clearTimeout(t)
  }, [phone, email, runDupCheck])

  // ── Actions ──────────────────────────────────────────────────────
  const selectAndClose = (c: Pick<Customer, 'id' | 'full_name' | 'phone' | 'email'>) => {
    onSelect(c)
    onClose()
  }

  const handleSelectExisting = (match: CustomerDuplicateMatch) => {
    toast.success(`${match.full_name} selected`)
    selectAndClose({ id: match.id, full_name: match.full_name, phone: match.phone, email: match.email })
  }

  const handleLinkTo = (match: CustomerDuplicateMatch) => {
    if (!name.trim()) { toast.error('Enter the new customer name first'); return }
    createCustomerMut.mutate(
      {
        full_name: name.trim(),
        phone: phone || undefined,
        email: email || undefined,
        linked_customer_id: match.id,
      },
      {
        onSuccess: (data: any) => {
          selectAndClose({ id: data.id, full_name: data.full_name, phone: data.phone, email: data.email })
        },
        onError: (err: any) => {
          toast.error(extractApiError(err, 'Could not create linked customer'))
        },
      },
    )
  }

  const handleCreate = () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    if (!phone && !email) { toast.error('Phone or email is required'); return }

    createCustomerMut.mutate(
      { full_name: name.trim(), phone: phone || undefined, email: email || undefined },
      {
        onSuccess: (data: any) => {
          selectAndClose({ id: data.id, full_name: data.full_name, phone: data.phone, email: data.email })
        },
        onError: async (err: any) => {
          if (err?.response?.status === 409) {
            // Conflict — find and select the existing customer
            const term = phone || email || name
            try {
              const result = await vendorApi.listCustomers({ search: term, size: 10 })
              const found = (result.items || []).find((c: any) =>
                (phone && c.phone === phone) ||
                (email && c.email?.toLowerCase() === email.toLowerCase()),
              )
              if (found) {
                toast.success(`${found.full_name} selected (existing record)`)
                selectAndClose({ id: found.id, full_name: found.full_name, phone: found.phone, email: found.email })
                return
              }
            } catch { /* fall through */ }
          }
          toast.error(extractApiError(err, 'Could not create customer'))
        },
      },
    )
  }

  const visibleDups = dupDismissed ? [] : dupMatches

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 text-base">
            <UserPlus className="w-5 h-5 text-violet-600" />
            Quick Create Customer
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Full Name *</Label>
            <Input
              className="mt-1 h-9"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Customer name"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">
              Phone {!email ? '*' : ''}
              {dupLoading && <span className="ml-1 text-[10px] text-gray-400 font-normal">Checking…</span>}
            </Label>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              defaultCountryIso="IN"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Email {!phone ? '*' : ''}</Label>
            <Input
              className="mt-1 h-9"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>

          <p className="text-[11px] text-gray-400">Phone or email is required.</p>
        </div>

        {/* Duplicate warning */}
        {visibleDups.length > 0 && (
          <CustomerDuplicateWarning
            matches={visibleDups}
            onSelectExisting={handleSelectExisting}
            onLinkTo={handleLinkTo}
            onDismiss={() => setDupDismissed(true)}
          />
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              onClose()
              const path = returnTo ? `/customers/new${returnTo.startsWith('?') ? returnTo : `?returnTo=${returnTo}`}` : '/customers'
              navigate(path)
            }}
            className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Enter full details
          </button>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!name.trim() || createCustomerMut.isPending}
              className="gap-1.5 bg-violet-600 hover:bg-violet-700"
            >
              {createCustomerMut.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Plus className="w-3.5 h-3.5" />}
              Create &amp; Select
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
