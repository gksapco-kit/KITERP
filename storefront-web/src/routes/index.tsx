import { createBrowserRouter, Navigate, useLocation, useParams } from 'react-router-dom'
import { useEffect } from 'react'
import StoreLayout from '@/layouts/StoreLayout'
import DraftCatalogEmbedShell from '@/layouts/DraftCatalogEmbedShell'
import DraftCatalogEmbedBlocked from '@/pages/DraftCatalogEmbedBlocked'
import ProtectedRoute from './ProtectedRoute'
import ProtectedHrRoute from './ProtectedHrRoute'
import { useVendor } from '@/contexts/VendorContext'
import { setHrVendorContext } from '@/api/hrClient'
import TemplateBrowserPreview from '@/pages/TemplateBrowserPreview'
import TemplateBrowserLayout from '@/pages/TemplateBrowserLayout'
import StorefrontCartRoute from '@/checkout/pages/StorefrontCartRoute'
import StorefrontCheckoutRoute from '@/checkout/pages/StorefrontCheckoutRoute'
import StorefrontConfirmationRoute from '@/checkout/pages/StorefrontConfirmationRoute'
import Landing from '@/pages/Landing'
import Partners from '@/pages/Partners'
import PartnerDetail from '@/pages/PartnerDetail'
import VendorSignup from '@/pages/vendor/VendorSignup'
import VerifyEmail from '@/pages/vendor/VerifyEmail'
import { VENDOR_SIGNUP_PATH, VENDOR_VERIFY_EMAIL_PATH } from '@/lib/vendorSignupPaths'

import Home from '@/pages/Home'
import BuilderPage from '@/pages/BuilderPage'
import HomeOrBuilder from '@/pages/HomeOrBuilder'
import { BuilderSitePreviewShell } from '@/contexts/BuilderSiteContext'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ProductList from '@/pages/products/ProductList'
import ProductDetail from '@/pages/products/ProductDetail'
import ServiceList from '@/pages/services/ServiceList'
import ServiceDetail from '@/pages/services/ServiceDetail'
import ServiceBookingPage from '@/pages/services/ServiceBookingPage'
import CartPage from '@/pages/cart/CartPage'
import Checkout from '@/pages/cart/Checkout'
import Account from '@/pages/account/Account'
import MyOrders from '@/pages/account/MyOrders'
import OrderDetail from '@/pages/account/OrderDetail'
import MyBookings from '@/pages/account/MyBookings'
import ProfileSettings from '@/pages/account/ProfileSettings'
import AddressesPage from '@/pages/account/AddressesPage'
import MyWishlist from '@/pages/account/MyWishlist'
import MySubscriptions from '@/pages/account/MySubscriptions'
import MyMarketplace from '@/pages/account/MyMarketplace'
import RentalsPage from '@/pages/rentals/RentalsPage'
import MyNotifications from '@/pages/account/MyNotifications'
import BlogList from '@/pages/blog/BlogList'
import BlogPost from '@/pages/blog/BlogPost'
import Policies from '@/pages/Policies'
import ContactPage from '@/pages/Contact'
import LandingContact from '@/pages/LandingContact'
import OrderConfirmationPage from '@/checkout/pages/OrderConfirmationPage'
import OrderStatusPage from '@/checkout/pages/OrderStatusPage'
import UpiPaymentProofPage from '@/checkout/pages/UpiPaymentProofPage'
import TableOrderPage from '@/pages/restaurant/TableOrderPage'
import ZoneMenuPage from '@/pages/restaurant/ZoneMenuPage'
import ReservationPage from '@/pages/restaurant/ReservationPage'

// Employee Self-Service (ESS)
import ESSLayout from '@/pages/employee/ESSLayout'
import ESSDashboard from '@/pages/employee/Dashboard'
import ESSAttendance from '@/pages/employee/Attendance'
import ESSLeaves from '@/pages/employee/Leaves'
import ESSPayslips from '@/pages/employee/Payslips'
import ESSTraining from '@/pages/employee/Training'
import ESSCourseLearning from '@/pages/employee/CourseLearning'
import ESSPerformance from '@/pages/employee/Performance'
import ESSReviewDetail from '@/pages/employee/ReviewDetail'
import ESSPolicyDetail from '@/pages/employee/PolicyDetail'
import ESSTicketDetail from '@/pages/employee/TicketDetail'
import ESSExpenses from '@/pages/employee/Expenses'
import ESSHelpdesk from '@/pages/employee/Helpdesk'
import ESSAnnouncements from '@/pages/employee/Announcements'
import ESSOnboarding from '@/pages/employee/Onboarding'
import ESSPolicies from '@/pages/employee/Policies'
import ESSProfilePage from '@/pages/employee/Profile'
import HrLogin from '@/pages/hr/HrLogin'
import HrChangePassword from '@/pages/hr/HrChangePassword'
import DevEmployeeHrLinks from '@/pages/DevEmployeeHrLinks'

function LegacyEmployeeToHrRedirect() {
  const { vendorSlug } = useParams<{ vendorSlug: string }>()
  const { pathname } = useLocation()
  const idx = pathname.indexOf('/employee')
  const tail = idx >= 0 ? pathname.slice(idx + '/employee'.length) : ''
  return <Navigate to={`/store/${vendorSlug}/hr${tail || ''}`} replace />
}

function HrPortalLayout() {
  const { vendorSlug, vendor } = useVendor()
  useEffect(() => {
    if (vendorSlug && vendor?.id) {
      setHrVendorContext(vendorSlug, vendor.id)
    }
  }, [vendorSlug, vendor?.id])
  return (
    <ProtectedHrRoute>
      <ESSLayout />
    </ProtectedHrRoute>
  )
}

/** Catalog shell routes allowed in draft preview — no home, blog, or builder catch-all. */
const draftCatalogShellChildren = [
  { path: 'login', element: <Login /> },
  { path: 'register', element: <Register /> },
  { path: 'forgot-password', element: <ForgotPassword /> },
  { path: 'products', element: <ProductList /> },
  { path: 'products/:slug', element: <ProductDetail /> },
  { path: 'services', element: <ServiceList /> },
  { path: 'services/:slug', element: <ServiceDetail /> },
  { path: 'services/:slug/book', element: <ServiceBookingPage /> },
  { path: 'cart', element: <CartPage /> },
  { path: 'checkout', element: <Checkout /> },
  { path: 'order/:orderId/confirmation', element: <OrderConfirmationPage /> },
  { path: 'order/:orderId/payment', element: <UpiPaymentProofPage /> },
  { path: 'order/:orderId/status', element: <OrderStatusPage /> },
  { path: 'account', element: <ProtectedRoute><Account /></ProtectedRoute> },
  { path: 'account/orders', element: <ProtectedRoute><MyOrders /></ProtectedRoute> },
  { path: 'account/orders/:id', element: <ProtectedRoute><OrderDetail /></ProtectedRoute> },
  { path: 'account/bookings', element: <ProtectedRoute><MyBookings /></ProtectedRoute> },
  { path: 'account/profile', element: <ProtectedRoute><ProfileSettings /></ProtectedRoute> },
  { path: 'account/addresses', element: <ProtectedRoute><AddressesPage /></ProtectedRoute> },
  { path: 'account/wishlist', element: <ProtectedRoute><MyWishlist /></ProtectedRoute> },
  { path: 'account/subscriptions', element: <ProtectedRoute><MySubscriptions /></ProtectedRoute> },
  { path: 'account/marketplace', element: <ProtectedRoute><MyMarketplace /></ProtectedRoute> },
  { path: 'account/notifications', element: <ProtectedRoute><MyNotifications /></ProtectedRoute> },
  { path: '*', element: <DraftCatalogEmbedBlocked /> },
]

export const router = createBrowserRouter([
  // Landing page — vendor directory / entry point
  {
    path: '/',
    element: <Landing />,
  },
  {
    path: '/contact',
    element: <LandingContact />,
  },
  {
    path: '/partners',
    element: <Partners />,
  },
  {
    path: '/partners/:slug',
    element: <PartnerDetail />,
  },
  // Vendor self-service signup (storefront-only; not under /vendor/* — see vendorSignupPaths.ts)
  {
    path: VENDOR_SIGNUP_PATH,
    element: <VendorSignup />,
  },
  {
    path: VENDOR_VERIFY_EMAIL_PATH,
    element: <VerifyEmail />,
  },
  // Local dev: copy-paste Employee HR / ESS URLs (port 3002, default slug `test`)
  {
    path: '/local/employee-hr',
    element: <DevEmployeeHrLinks />,
  },
  // Website template full preview — wrapped in shared StorefrontProvider for cart/checkout
  {
    path: '/template-browser/:templateId',
    element: <TemplateBrowserLayout />,
    children: [
      { index: true, element: <TemplateBrowserPreview /> },
      { path: 'cart', element: <StorefrontCartRoute /> },
      { path: 'checkout', element: <StorefrontCheckoutRoute /> },
      { path: 'order/:orderId/confirmation', element: <StorefrontConfirmationRoute /> },
      { path: 'order/:orderId/payment', element: <UpiPaymentProofPage /> },
    ],
  },
  // Vendor-specific business front: /store/:vendorSlug/...
  {
    path: '/store/:vendorSlug/draft-catalog/:previewToken',
    element: <DraftCatalogEmbedShell />,
    children: [
      { index: true, element: <Navigate to="products" replace /> },
      ...draftCatalogShellChildren,
    ],
  },
  {
    path: '/store/:vendorSlug',
    element: <StoreLayout />,
    children: [
      // Home: uses builder if published, otherwise legacy Home
      { index: true, element: <HomeOrBuilder /> },

      // ── Shell routes (not owned by the builder) ─────────────────────────
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'products', element: <ProductList /> },
      { path: 'products/:slug', element: <ProductDetail /> },
      { path: 'services', element: <ServiceList /> },
      { path: 'services/:slug', element: <ServiceDetail /> },
      { path: 'services/:slug/book', element: <ServiceBookingPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', element: <Checkout /> },
      { path: 'order/:orderId/confirmation', element: <OrderConfirmationPage /> },
      { path: 'order/:orderId/payment', element: <UpiPaymentProofPage /> },
      { path: 'order/:orderId/status', element: <OrderStatusPage /> },
      { path: 'account', element: <ProtectedRoute><Account /></ProtectedRoute> },
      { path: 'account/orders', element: <ProtectedRoute><MyOrders /></ProtectedRoute> },
      { path: 'account/orders/:id', element: <ProtectedRoute><OrderDetail /></ProtectedRoute> },
      { path: 'account/bookings', element: <ProtectedRoute><MyBookings /></ProtectedRoute> },
      { path: 'account/profile', element: <ProtectedRoute><ProfileSettings /></ProtectedRoute> },
      { path: 'account/addresses', element: <ProtectedRoute><AddressesPage /></ProtectedRoute> },
      { path: 'account/wishlist', element: <ProtectedRoute><MyWishlist /></ProtectedRoute> },
      { path: 'account/subscriptions', element: <ProtectedRoute><MySubscriptions /></ProtectedRoute> },
      { path: 'account/marketplace', element: <ProtectedRoute><MyMarketplace /></ProtectedRoute> },
      { path: 'rentals', element: <RentalsPage /> },
      { path: 'account/notifications', element: <ProtectedRoute><MyNotifications /></ProtectedRoute> },
      { path: 'blog', element: <BlogList /> },
      { path: 'blog/:slug', element: <BlogPost /> },
      { path: 'policies', element: <Policies /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'table/:qrToken', element: <TableOrderPage /> },
      { path: 'menu/:linkToken', element: <ZoneMenuPage /> },
      { path: 'reserve', element: <ReservationPage /> },

      // Draft builder snapshot — full site in browser (token); inner provider overrides live site.
      {
        path: 'preview/:previewToken',
        element: <BuilderSitePreviewShell />,
        children: [
          { index: true, element: <BuilderPage /> },
          { path: '*', element: <BuilderPage /> },
        ],
      },

      { path: 'hr/login', element: <HrLogin /> },
      { path: 'hr/change-password', element: <HrChangePassword /> },
      {
        path: 'hr',
        element: <HrPortalLayout />,
        children: [
          { index: true,               element: <ESSDashboard /> },
          { path: 'profile',           element: <ESSProfilePage /> },
          { path: 'attendance',        element: <ESSAttendance /> },
          { path: 'leaves',            element: <ESSLeaves /> },
          { path: 'payslips',          element: <ESSPayslips /> },
          { path: 'policies',          element: <ESSPolicies /> },
          { path: 'training',          element: <ESSTraining /> },
          { path: 'training/:enrollmentId', element: <ESSCourseLearning /> },
          { path: 'performance',       element: <ESSPerformance /> },
          { path: 'performance/reviews/:reviewId', element: <ESSReviewDetail /> },
          { path: 'policies/:policyId', element: <ESSPolicyDetail /> },
          { path: 'expenses',          element: <ESSExpenses /> },
          { path: 'helpdesk',          element: <ESSHelpdesk /> },
          { path: 'helpdesk/:ticketId', element: <ESSTicketDetail /> },
          { path: 'announcements',     element: <ESSAnnouncements /> },
          { path: 'onboarding',        element: <ESSOnboarding /> },
        ],
      },
      { path: 'employee/*', element: <LegacyEmployeeToHrRedirect /> },

      // ── Builder catch-all: any other slug → BlockRenderer ─────────────────
      // Must be last so shell routes take priority.
      { path: '*', element: <BuilderPage /> },
    ],
  },
  // Catch-all: redirect to landing
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
