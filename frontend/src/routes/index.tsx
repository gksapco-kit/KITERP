import { createBrowserRouter, Navigate } from 'react-router-dom'

// Layouts
import AuthLayout from '@/layouts/AuthLayout'
import DashboardLayout from '@/layouts/DashboardLayout'
import OnboardingLayout from '@/layouts/OnboardingLayout'
import StorefrontLayout from '@/layouts/StorefrontLayout'

// Auth Pages
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'

// Onboarding Pages
import OnboardingBasic from '@/pages/onboarding/index'
import OnboardingSubdomain from '@/pages/onboarding/Subdomain'
import OnboardingAddress from '@/pages/onboarding/Address'
import OnboardingDocuments from '@/pages/onboarding/Documents'
import OnboardingBanking from '@/pages/onboarding/Banking'
import OnboardingReview from '@/pages/onboarding/Review'

// Dashboard Pages
import Dashboard from '@/pages/dashboard/index'
import Vendors from '@/pages/dashboard/Vendors'
import VendorDetail from '@/pages/dashboard/VendorDetail'
import AddVendor from '@/pages/dashboard/AddVendor'
import VendorAppBuilds from '@/pages/dashboard/VendorAppBuilds'
import Plans from '@/pages/dashboard/Plans'
import Products from '@/pages/dashboard/Products'
import Services from '@/pages/dashboard/Services'
import Inventory from '@/pages/dashboard/Inventory'
import Settings from '@/pages/dashboard/Settings'
import PlatformTeam from '@/pages/dashboard/PlatformTeam'
import PlatformTeamMemberDetail from '@/pages/dashboard/PlatformTeamMemberDetail'
import AccountActivity from '@/pages/dashboard/AccountActivity'
import OrderDisputes from '@/pages/dashboard/OrderDisputes'
import ContactQueries from '@/pages/dashboard/ContactQueries'
import TableData from '@/pages/dashboard/TableData'
import AllTemplates from '@/pages/dashboard/AllTemplates'
import WebsiteAnalytics from '@/pages/dashboard/WebsiteAnalytics'

// Business Front Pages
import StorefrontHome from '@/pages/storefront/Home'
import StorefrontProducts from '@/pages/storefront/Products'
import StorefrontProductDetail from '@/pages/storefront/ProductDetail'
import StorefrontServices from '@/pages/storefront/Services'
import StorefrontServiceDetail from '@/pages/storefront/ServiceDetail'
import StorefrontCart from '@/pages/storefront/Cart'
import StorefrontCheckout from '@/pages/storefront/Checkout'
import StorefrontOrderTracking from '@/pages/storefront/OrderTracking'
import StorefrontAbout from '@/pages/storefront/About'
import StorefrontContact from '@/pages/storefront/Contact'

// Guards
import ProtectedRoute from './ProtectedRoute'
import VendorRoute from './VendorRoute'

const routerBasename = (import.meta.env.VITE_ROUTER_BASENAME || '').replace(/\/$/, '')

export const router = createBrowserRouter([
  // Auth Routes
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { index: true, element: <Navigate to="/login" replace /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
    ],
  },

  // Onboarding Routes
  {
    path: '/onboarding',
    element: (
      <ProtectedRoute>
        <OnboardingLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <OnboardingBasic /> },
      { path: 'subdomain', element: <OnboardingSubdomain /> },
      { path: 'address', element: <OnboardingAddress /> },
      { path: 'documents', element: <OnboardingDocuments /> },
      { path: 'banking', element: <OnboardingBanking /> },
      { path: 'review', element: <OnboardingReview /> },
    ],
  },

  // Dashboard Routes
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <VendorRoute>
          <DashboardLayout />
        </VendorRoute>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'vendors', element: <Vendors /> },
      { path: 'vendors/add', element: <AddVendor /> },
      { path: 'vendors/:id/app-builds', element: <VendorAppBuilds /> },
      { path: 'vendors/:id', element: <VendorDetail /> },
      { path: 'plans', element: <Plans /> },
      { path: 'templates', element: <AllTemplates /> },
      { path: 'website-analytics', element: <WebsiteAnalytics /> },
      { path: 'platform-team', element: <PlatformTeam /> },
      { path: 'platform-team/:userId', element: <PlatformTeamMemberDetail /> },
      { path: 'account-activity', element: <AccountActivity /> },
      { path: 'disputes', element: <OrderDisputes /> },
      { path: 'queries', element: <ContactQueries /> },
      { path: 'table-data', element: <TableData /> },
      { path: 'products', element: <Products /> },
      { path: 'services', element: <Services /> },
      { path: 'inventory', element: <Inventory /> },
      { path: 'settings', element: <Settings /> },
    ],
  },

  // Public Business Front Routes (no auth required)
  {
    path: '/store/:vendorSlug',
    element: <StorefrontLayout />,
    children: [
      { index: true, element: <StorefrontHome /> },
      { path: 'products', element: <StorefrontProducts /> },
      { path: 'products/:productSlug', element: <StorefrontProductDetail /> },
      { path: 'services', element: <StorefrontServices /> },
      { path: 'services/:serviceSlug', element: <StorefrontServiceDetail /> },
      { path: 'cart', element: <StorefrontCart /> },
      { path: 'checkout', element: <StorefrontCheckout /> },
      { path: 'orders/:orderId', element: <StorefrontOrderTracking /> },
      { path: 'about', element: <StorefrontAbout /> },
      { path: 'contact', element: <StorefrontContact /> },
    ],
  },
], {
  basename: routerBasename || undefined,
})
