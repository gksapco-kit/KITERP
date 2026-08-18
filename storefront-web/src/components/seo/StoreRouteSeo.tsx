import { useEffect } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import { useBuilderSite } from '@/contexts/BuilderSiteContext'
import { applyDocumentSeo, vendorPageTitle, PLATFORM_SEO, PAGE_JSON_LD_ID } from '@/lib/documentSeo'
import { compactJsonLd, localBusinessJsonLd } from '@/lib/catalogSeo'
import { relativePathUnderVendor } from '@/lib/storefrontPaths'

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

/** Detail routes apply their own title, description, OG image, and JSON-LD. */
function isOwnedDetailPath(relative: string): boolean {
  return (
    /^\/products\/[^/]+\/?$/.test(relative)
    || /^\/services\/[^/]+\/?$/.test(relative)
    || /^\/blog\/[^/]+\/?$/.test(relative)
    || /^\/rentals\/[^/]+\/?$/.test(relative)
  )
}

/** Default document SEO for catalog shell routes (detail/builder pages override with richer meta). */
export default function StoreRouteSeo() {
  const { pathname } = useLocation()
  const { vendorSlug = '' } = useParams<{ vendorSlug: string }>()
  const { vendor } = useVendor()
  const { builderSite } = useBuilderSite()
  const vendorName = vendor?.display_name || vendor?.business_name || vendorSlug
  const relative = relativePathUnderVendor(pathname, vendorSlug) || pathname
  const homepageHasBuilderBlocks = Boolean(
    (builderSite?.pages?.find((page) => page.is_homepage) || builderSite?.pages?.[0])?.blocks?.length,
  )

  useEffect(() => {
    if (isOwnedDetailPath(relative)) return
    if (!isShellRelativePath(relative) || ((relative === '/' || relative === '') && homepageHasBuilderBlocks)) {
      document.getElementById(PAGE_JSON_LD_ID)?.remove()
      return
    }

    let pageLabel = 'Home'
    let description = vendor?.description?.trim()
      || `Shop products and services from ${vendorName} on KITERP.`
    let noindex = false
    let jsonLd = null as ReturnType<typeof compactJsonLd>

    if (relative === '/' || relative === '') {
      pageLabel = vendorName
      jsonLd = compactJsonLd([
        localBusinessJsonLd({
          name: vendorName,
          description: vendor?.description,
          url: pathname,
          logo: vendor?.logo_url,
          telephone: vendor?.primary_phone || vendor?.support_phone,
          email: vendor?.primary_email || vendor?.support_email,
          street: vendor?.street_address,
          city: vendor?.city,
          state: vendor?.state,
          postalCode: vendor?.postal_code,
          country: vendor?.country,
          latitude: vendor?.latitude,
          longitude: vendor?.longitude,
        }),
      ])
    } else if (relative.startsWith('/products')) {
      pageLabel = 'Products'
      description = `Browse products from ${vendorName}.`
    } else if (relative.startsWith('/services/') && relative.includes('/book')) {
      pageLabel = 'Book Service'
      noindex = true
    } else if (relative.startsWith('/services')) {
      pageLabel = 'Services'
      description = `Browse services from ${vendorName}.`
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
      description = `Browse rental assets from ${vendorName}.`
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
      ogImageAlt: vendorName,
      noindex,
      jsonLd,
    })
  }, [
    pathname,
    relative,
    vendorName,
    vendor?.description,
    vendor?.logo_url,
    vendor?.primary_phone,
    vendor?.support_phone,
    vendor?.primary_email,
    vendor?.support_email,
    vendor?.street_address,
    vendor?.city,
    vendor?.state,
    vendor?.postal_code,
    vendor?.country,
    vendor?.latitude,
    vendor?.longitude,
    homepageHasBuilderBlocks,
  ])

  return null
}
