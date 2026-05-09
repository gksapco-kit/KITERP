import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle, Store, Image } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useRegisterVendor } from '@/hooks/useVendor'
import type { VendorCreate } from '@/types/vendor'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
const fullImageUrl = (url: string) => {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${API_URL.replace('/api/v1', '')}${url}`
}

export default function OnboardingReview() {
  const navigate = useNavigate()
  const registerMutation = useRegisterVendor()
  
  // Get data from session storage
  const basicData = JSON.parse(sessionStorage.getItem('onboarding_basic') || '{}')
  const subdomain = sessionStorage.getItem('onboarding_subdomain') || ''
  const addressData = JSON.parse(sessionStorage.getItem('onboarding_address') || '{}')

  const handleSubmit = async () => {
    if (!basicData.business_name || !subdomain || !addressData.primary_email) {
      toast.error('Please complete all onboarding steps')
      return
    }

    const vendorData: VendorCreate = {
      business_name: basicData.business_name,
      display_name: basicData.display_name,
      slug: subdomain,
      business_type: basicData.business_type,
      industry: basicData.industry,
      description: basicData.description,
      primary_email: addressData.primary_email,
      primary_phone: addressData.primary_phone,
      owner_name: addressData.owner_name,
      logo_url: basicData.logo_url,
      banner_url: basicData.banner_url,
      address: {
        street_address: addressData.street_address,
        city: addressData.city,
        state: addressData.state,
        postal_code: addressData.postal_code,
        country: addressData.country || 'India',
        latitude: addressData.latitude,
        longitude: addressData.longitude,
        service_radius_km: addressData.service_radius_km ?? 10,
      },
    }

    registerMutation.mutate(vendorData, {
      onSuccess: () => {
        // Clear session storage
        sessionStorage.removeItem('onboarding_basic')
        sessionStorage.removeItem('onboarding_subdomain')
        sessionStorage.removeItem('onboarding_address')
        
        navigate('/dashboard')
      },
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review & Submit</h2>
        <p className="text-sm text-gray-600 mt-1">
          Review your information before submitting
        </p>
      </div>

      <div className="space-y-6">
        {/* Branding Preview */}
        {(basicData.logo_url || basicData.banner_url) && (
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Store Branding
            </h3>
            <div className="flex items-center gap-4">
              {basicData.logo_url ? (
                <img src={fullImageUrl(basicData.logo_url)} alt="Logo" className="w-16 h-16 rounded-lg object-cover border" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center border">
                  <Store className="w-6 h-6 text-gray-300" />
                </div>
              )}
              {basicData.banner_url ? (
                <img src={fullImageUrl(basicData.banner_url)} alt="Banner" className="flex-1 h-16 rounded-lg object-cover border" />
              ) : (
                <div className="flex-1 h-16 rounded-lg bg-gray-100 flex items-center justify-center border">
                  <Image className="w-6 h-6 text-gray-300" />
                  <span className="text-xs text-gray-400 ml-1">No banner</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Business Info */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Business Information
          </h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Business Name:</dt>
            <dd>{basicData.business_name || '-'}</dd>
            <dt className="text-gray-500">Display Name:</dt>
            <dd>{basicData.display_name || '-'}</dd>
            <dt className="text-gray-500">Industry:</dt>
            <dd>{basicData.industry || '-'}</dd>
            <dt className="text-gray-500">Type:</dt>
            <dd className="capitalize">{basicData.business_type || '-'}</dd>
          </dl>
        </div>

        {/* Store URL */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Store URL
          </h3>
          <p className="text-sm">
            https://<span className="font-medium text-blue-600">{subdomain}</span>.kiterp.com
          </p>
        </div>

        {/* Contact Info */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Contact Information
          </h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Owner:</dt>
            <dd>{addressData.owner_name || '-'}</dd>
            <dt className="text-gray-500">Email:</dt>
            <dd>{addressData.primary_email || '-'}</dd>
            <dt className="text-gray-500">Phone:</dt>
            <dd>{addressData.primary_phone || '-'}</dd>
            <dt className="text-gray-500">Address:</dt>
            <dd>
              {addressData.street_address}, {addressData.city}, {addressData.state} - {addressData.postal_code}
            </dd>
          </dl>
        </div>

        {/* Location & Radius */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <CheckCircle className={`w-5 h-5 ${addressData.latitude ? 'text-green-500' : 'text-gray-300'}`} />
            Location &amp; Service Radius
          </h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Coordinates:</dt>
            <dd>
              {addressData.latitude && addressData.longitude
                ? `${Number(addressData.latitude).toFixed(5)}, ${Number(addressData.longitude).toFixed(5)}`
                : 'Not set'}
            </dd>
            <dt className="text-gray-500">Service Radius:</dt>
            <dd>{addressData.service_radius_km ?? 10} km</dd>
          </dl>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={() => navigate('/onboarding/banking')}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={registerMutation.isPending}>
          {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create My Store
        </Button>
      </div>
    </div>
  )
}
