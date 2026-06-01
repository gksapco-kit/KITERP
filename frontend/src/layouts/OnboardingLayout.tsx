import { Outlet } from 'react-router-dom'

export default function OnboardingLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Set Up Your Store</h1>
          <p className="mt-2 text-gray-600">
            Complete the following steps to launch your online store
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-h-[90vh] overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
