/**
 * MasterDataNew — full-page wrapper for creating a new master-data record.
 *
 * Opened from POS via the "Full Record" button.
 * After creation the record is stored in sessionStorage so POS can auto-select it.
 * The user can also navigate here from anywhere else; the returnTo query-param
 * controls where "Back" and post-save navigation go.
 */
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AddPartyModal } from '@/components/parties/AddPartyModal'

const SESSION_KEY = 'pos_pending_customer'
const PO_PENDING_SUPPLIER_KEY = 'po_pending_supplier'

export default function MasterDataNew() {
  const navigate      = useNavigate()
  const [params]      = useSearchParams()
  const returnTo      = params.get('returnTo') || '/master-data'
  const returnPath    = returnTo.startsWith('/') ? returnTo : `/${returnTo}`
  // Track whether we're already navigating so we don't double-fire
  const navigated     = useRef(false)

  // Auto-scroll to top so the modal (fixed-overlay) looks clean
  useEffect(() => { window.scrollTo(0, 0) }, [])

  const goBack = () => {
    if (navigated.current) return
    navigated.current = true
    navigate(returnPath, { replace: true })
  }

  const handleCreated = (record: Record<string, unknown>) => {
    if (navigated.current) return
    navigated.current = true

    // Persist new customer for POS to pick up
    if (returnPath === '/pos') {
      try {
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            id:        record.id        ?? record.id,
            full_name: record.full_name ?? record.name,
            phone:     record.phone,
            email:     record.email,
          })
        )
      } catch { /* ignore */ }
    }

    // Persist new supplier for Purchase Orders to pick up
    if (returnPath === '/purchase-orders') {
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
      isOpen={true}
      onClose={goBack}
      onCreated={handleCreated as any}
    />
  )
}

// Re-export the session keys so other pages can import them without duplication
export { SESSION_KEY as POS_PENDING_CUSTOMER_KEY }
export { PO_PENDING_SUPPLIER_KEY }
