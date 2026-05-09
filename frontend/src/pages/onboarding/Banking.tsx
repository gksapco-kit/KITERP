import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function OnboardingBanking() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Banking Details</h2>
        <p className="text-sm text-gray-600 mt-1">
          Add your bank account for payouts
        </p>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Bank account details will be required before you can receive payouts.
          You can skip this step for now and add banking details later.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={() => navigate('/onboarding/documents')}>
          Back
        </Button>
        <Button onClick={() => navigate('/onboarding/review')}>
          Continue
        </Button>
      </div>
    </div>
  )
}
