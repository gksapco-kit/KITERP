import { Users, Mail, Phone, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import type { Order } from '@/types'
import { StaffPicker, type StaffPickerValue } from '@/components/commission/StaffPicker'
import { SectionLabel } from './OrderDetailPrimitives'

interface DeliveryStaffPanelProps {
  order: Pick<Order,
    'status' | 'shipping_address' | 'delivery_staff_name' | 'delivery_status' |
    'delivery_assigned_at' | 'delivery_staff_email' | 'delivery_staff_phone'
  >
  isBooking: boolean
  isTerminal: boolean
  expanded: boolean
  onToggleExpanded: () => void
  selectedStaff: StaffPickerValue | null
  onSelectStaff: (val: StaffPickerValue | null) => void
  assigning: boolean
  onAssign: () => void
}

/** Delivery staff assignment + contact column of the order detail card. */
export function DeliveryStaffPanel({
  order, isBooking, isTerminal, expanded, onToggleExpanded,
  selectedStaff, onSelectStaff, assigning, onAssign,
}: DeliveryStaffPanelProps) {
  return (
    <div className="xl:col-span-3 flex flex-col border-t xl:border-t-0">
      <div className="px-4 py-3 border-b bg-muted/20">
        <SectionLabel icon={Users}>Delivery staff</SectionLabel>
      </div>
      <div className="flex-1 px-4 py-4 flex flex-col">
        {isBooking || isTerminal || !order.shipping_address ? (
          <p className="text-sm text-gray-400 italic">Not applicable for this order.</p>
        ) : (
          <>
            {order.delivery_staff_name ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 mb-3 overflow-hidden">
                <button
                  type="button"
                  onClick={onToggleExpanded}
                  aria-expanded={expanded}
                  className="w-full text-left flex items-start gap-3 p-3 hover:bg-primary/10 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {order.delivery_staff_name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{order.delivery_staff_name}</p>
                    <p className="text-xs text-primary capitalize">
                      {order.delivery_status || 'Assigned'}
                      {order.delivery_assigned_at && ` · ${formatDate(order.delivery_assigned_at)}`}
                    </p>
                    {!expanded && (order.delivery_staff_email || order.delivery_staff_phone) && (
                      <p className="text-[11px] text-gray-400 mt-1">Tap to view contact details</p>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-primary shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-primary/15 space-y-1 ml-12">
                    {order.delivery_staff_email ? (
                      <a href={`mailto:${order.delivery_staff_email}`}
                        className="text-xs text-gray-600 flex items-center gap-1.5 hover:text-primary truncate">
                        <Mail className="w-3.5 h-3.5 shrink-0" />{order.delivery_staff_email}
                      </a>
                    ) : (
                      <p className="text-xs text-gray-400 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 shrink-0" />No email on file</p>
                    )}
                    {order.delivery_staff_phone ? (
                      <a href={`tel:${order.delivery_staff_phone}`}
                        className="text-xs text-gray-600 flex items-center gap-1.5 hover:text-primary">
                        <Phone className="w-3.5 h-3.5 shrink-0" />{order.delivery_staff_phone}
                      </a>
                    ) : (
                      <p className="text-xs text-gray-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" />No phone on file</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-4 text-center mb-3">
                <Users className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                <p className="text-xs text-gray-500">No delivery staff assigned yet</p>
              </div>
            )}
            {['confirmed', 'processing', 'shipped'].includes(order.status) && (
              <div className="mt-auto space-y-2">
                <StaffPicker
                  selected={selectedStaff}
                  onSelect={onSelectStaff}
                  disabled={assigning}
                  placeholder="Search by name…"
                />
                <Button className="w-full gap-1.5" size="sm" disabled={!selectedStaff || assigning} onClick={onAssign}>
                  {assigning
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : (order.delivery_staff_name ? 'Reassign' : 'Assign to order')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
