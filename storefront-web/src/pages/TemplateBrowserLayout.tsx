/**
 * Layout wrapper for the template browser routes.
 * Provides a shared StorefrontProvider so the cart state is preserved
 * when navigating between the template preview, cart, checkout, and confirmation.
 */
import { Outlet, useParams } from 'react-router-dom'
import { StorefrontProvider } from '@/storefront/StorefrontContext'
import { mockAdapter } from '@/storefront/adapters/mock'

export default function TemplateBrowserLayout() {
  // The adapter is always the mock one for template browser previews.
  // Real business fronts (/store/:vendorSlug) use a different layout with the real adapter.
  return (
    <StorefrontProvider adapter={mockAdapter}>
      <Outlet />
    </StorefrontProvider>
  )
}
