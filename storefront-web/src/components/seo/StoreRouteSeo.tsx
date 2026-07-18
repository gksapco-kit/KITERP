import { useEffect } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import { applyDocumentSeo, vendorPageTitle, PLATFORM_SEO } from '@/lib/documentSeo'

function isShellRelativePath(relative: string): boolean {
  if (relative === '/' || relative === '') return true
  const shellRoots = [
    '/products',
    '/services',
    '/blog',
    '/contact',
    '/policies',
    '/cart',
    '/checkout',
    '/account',
    '/login',
    '/register',
    '/forgot-password',
    '/rentals',
    '/reserve',
    '/table',
    '/menu',
    '/order',
    '/hr',
    '/employee',
    '/preview',
    '/draft-catalog',
  ]
  return shellRoots.some((root) => relative === root || relative.startsWith(`${root}/`))
}

/** Default document SEO for catalog shell routes (detail/builder pages override with richer meta). */
export default function StoreRouteSeo() {
  const { pathname } = useLocation()
  const { vendorSlug = '' } = useParams<{ vendorSlug: string }>()
  const { vendor } = useVendor()
  const vendorName = vendor?.display_name || vendor?.business_name || vendorSlug
  const base = `/store/${vendorSlug}`
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname

  useEffect(() => {
    if (!isShellRelativePath(relative)) return

    let pageLabel = 'Home'
    let description = vendor?.description?.trim()
      || `Shop products and services from ${vendorName} on KITERP.`
    let noindex = false

    if (relative === '/' || relative === '') {
      pageLabel = vendorName
    } else if (relative.startsWith('/products/') && relative !== '/products/') {
      pageLabel = 'Product'
    } else if (relative.startsWith('/products')) {
      pageLabel = 'Products'
      description = `Browse products from ${vendorName}.`
    } else if (relative.startsWith('/services/') && relative.includes('/book')) {
      pageLabel = 'Book Service'
      noindex = true
    } else if (relative.startsWith('/services/') && relative !== '/services/') {
      pageLabel = 'Service'
    } else if (relative.startsWith('/services')) {
      pageLabel = 'Services'
      description = `Browse services from ${vendorName}.`
    } else if (relative.startsWith('/blog/') && relative !== '/blog/') {
      pageLabel = 'Blog'
    } else if (relative.startsWith('/blog')) {
      pageLabel = 'Blog'
      description = `News and updates from ${vendorName}.`
    } else if (relative.startsWith('/contact')) {
      pageLabel = 'Contact'
      description = `Contact ${vendorName}.`
    } else if (relative.startsWith('/policies')) {
      pageLabel = 'Policies'
      description = `Store policies for ${vendorName}.`
    } else if (relative.startsWith('/cart') || relative.startsWith('/checkout') || relative.startsWith('/order')) {
      pageLabel = relative.startsWith('/checkout') ? 'Checkout' : relative.startsWith('/order') ? 'Order' : 'Cart'
      noindex = true
    } else if (
      relative.startsWith('/account')
      || relative.startsWith('/login')
      || relative.startsWith('/register')
      || relative.startsWith('/forgot-password')
    ) {
      pageLabel = relative.startsWith('/account') ? 'Account' : 'Sign In'
      noindex = true
    } else if (relative.startsWith('/hr') || relative.startsWith('/employee')) {
      pageLabel = 'Employee Portal'
      noindex = true
    } else if (relative.startsWith('/rentals')) {
      pageLabel = 'Rentals'
    } else if (relative.startsWith('/reserve') || relative.startsWith('/table') || relative.startsWith('/menu')) {
      pageLabel = 'Ordering'
      noindex = true
    } else if (relative.startsWith('/preview') || relative.startsWith('/draft-catalog')) {
      pageLabel = 'Preview'
      noindex = true
    }

    const title =
      pageLabel === vendorName
        ? `${vendorName} | ${PLATFORM_SEO.siteName}`
        : vendorPageTitle(pageLabel, vendorName)

    applyDocumentSeo({
      title,
      description,
      canonicalPath: pathname,
      ogSiteName: vendorName || PLATFORM_SEO.siteName,
      ogImage: vendor?.logo_url || '/favicon-192.png',
      noindex,
    })
  }, [pathname, relative, vendorName, vendor?.description, vendor?.logo_url])

  return null
}
