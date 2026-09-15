import { useParams, useNavigate } from 'react-router-dom'
import { usePurchaseOrder } from '@/hooks/useVendor'
import { PurchaseOrderForm } from '@/components/procurement/PurchaseOrderForm'
import { Loader2 } from 'lucide-react'

export default function PurchaseOrderEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: po, isLoading, isError } = usePurchaseOrder(id ?? '')

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (isError || !po) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-gray-500">
        Purchase order not found.
      </div>
    )
  }

  if (po.status !== 'draft') {
    navigate(`/purchase-orders/${id}`, { replace: true })
    return null
  }

  return (
    <PurchaseOrderForm
      editingPO={po}
      onSuccess={poId => navigate(`/purchase-orders/${poId}`)}
      onCancel={() => navigate(`/purchase-orders/${id}`)}
    />
  )
}
