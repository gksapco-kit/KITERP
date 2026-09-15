import { useNavigate } from 'react-router-dom'
import { PurchaseOrderForm } from '@/components/procurement/PurchaseOrderForm'

export default function CreatePurchaseOrderPage() {
  const navigate = useNavigate()
  return (
    <PurchaseOrderForm
      onSuccess={poId => navigate(`/purchase-orders/${poId}`)}
      onCancel={() => navigate('/purchase-orders')}
    />
  )
}
