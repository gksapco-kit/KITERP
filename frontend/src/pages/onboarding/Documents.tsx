import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function OnboardingDocuments() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Verification Documents</h2>
        <p className="text-sm text-gray-600 mt-1">Upload required documents for verification</p>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Document upload will be available after initial registration.
          You can skip this step for now and upload documents later.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={() => navigate('/onboarding/address')}>Back</Button>
        <Button onClick={() => navigate('/onboarding/banking')}>Continue</Button>
      </div>
    </div>
  )
}
