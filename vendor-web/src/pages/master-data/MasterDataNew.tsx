/**
 * MasterDataNew — full-page wrapper for creating a new master-data record.
 *
 * Opened from POS via the "Full Record" button.
 * After creation the record is stored in sessionStorage so POS can auto-select it.
 * The user can also navigate here from anywhere else; the returnTo query-param
 * controls where "Back" and post-save navigation go.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AddPartyModal } from '@/components/parties/AddPartyModal'
import type { PartyType } from '@/types'

const SESSION_KEY = 'pos_pending_customer'
const PO_PENDING_SUPPLIER_KEY = 'po_pending_supplier'
const INVOICE_PENDING_CUSTOMER_KEY = 'invoice_pending_customer'
const QUICK_CREATE_DRAFT_KEY = 'quick_create_customer_draft'

export default function MasterDataNew() {
  const navigate      = useNavigate()
  const [params]      = useSearchParams()
  const returnTo      = params.get('returnTo') || '/master-data'
  const returnPath    = returnTo.startsWith('/') ? returnTo : `/${returnTo}`
  const kindParam     = (params.get('kind') || 'customer').toLowerCase()
  const defaultType: PartyType = kindParam === 'supplier' || kindParam === 'vendor' ? 'supplier' : 'customer'
  const [draftPrefill, setDraftPrefill] = useState<{
    full_name?: string
    phone?: string
    email?: string
  } | null>(null)
  // Track whether we're already navigating so we don't double-fire
  const navigated     = useRef(false)

  // Auto-scroll to top so the modal (fixed-overlay) looks clean
  useEffect(() => { window.scrollTo(0, 0) }, [])

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(QUICK_CREATE_DRAFT_KEY)
      if (!raw) return
      sessionStorage.removeItem(QUICK_CREATE_DRAFT_KEY)
      setDraftPrefill(JSON.parse(raw) as { full_name?: string; phone?: string; email?: string })
    } catch { /* ignore */ }
  }, [])

  const goBack = () => {
    if (navigated.current) return
    navigated.current = true
    navigate(returnPath, { replace: true })
  }

  const handleCreated = (record: Record<string, unknown>) => {
    if (navigated.current) return
    navigated.current = true

    // Persist new customer for POS to pick up
    const customerPayload = {
      id: record.id as string,
      full_name: (record.full_name ?? record.name) as string,
      phone: record.phone as string | undefined,
      email: record.email as string | undefined,
    }

    if (returnPath === '/pos') {
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(customerPayload))
      } catch { /* ignore */ }
    }

    if (returnPath === '/invoices' || returnPath.startsWith('/invoices')) {
      try {
        sessionStorage.setItem(INVOICE_PENDING_CUSTOMER_KEY, JSON.stringify(customerPayload))
      } catch { /* ignore */ }
    }

    // Persist new supplier for Purchase Orders / Procurement to pick up
    if (returnPath === '/purchase-orders' || returnPath.startsWith('/procurement/')) {
      try {
        sessionStorage.setItem(
          PO_PENDING_SUPPLIER_KEY,
          JSON.stringify({
            id:   record.id,
            name: (record.name ?? record.full_name) as string,
          })
        )
      } catch { /* ignore */ }
    }

    navigate(returnPath, { replace: true })
  }

  return (
    <AddPartyModal
      onClose={goBack}
      onCreated={handleCreated as any}
      defaultType={defaultType}
      initialDraft={draftPrefill ?? undefined}
    />
  )
}

// Re-export the session keys so other pages can import them without duplication
export { SESSION_KEY as POS_PENDING_CUSTOMER_KEY }
export { PO_PENDING_SUPPLIER_KEY }
export { INVOICE_PENDING_CUSTOMER_KEY }
