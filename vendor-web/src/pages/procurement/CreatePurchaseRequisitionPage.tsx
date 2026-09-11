import { useNavigate } from 'react-router-dom'
import { PurchaseRequisitionForm } from '@/components/procurement/PurchaseRequisitionForm'

export default function CreatePurchaseRequisitionPage() {
  const navigate = useNavigate()
  return (
    <PurchaseRequisitionForm
      layout="page"
      onSuccess={() => navigate('/procurement/requisitions')}
      onCancel={() => navigate('/procurement/requisitions')}
    />
  )
}
