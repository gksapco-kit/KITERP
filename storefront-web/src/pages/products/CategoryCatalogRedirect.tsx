import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useStoreCategories } from '@/hooks/useStore'
import { useVendor } from '@/contexts/VendorContext'
import type { StoreCategory } from '@/types'

function categoryBySlug(categories: StoreCategory[] | undefined, slug: string): StoreCategory | undefined {
  const want = slug.trim().toLowerCase()
  if (!want) return undefined
  const walk = (items: StoreCategory[]): StoreCategory | undefined => {
    for (const item of items) {
      if ((item.slug || '').trim().toLowerCase() === want) return item
      const child = item.children?.length ? walk(item.children) : undefined
      if (child) return child
    }
    return undefined
  }
  return walk(categories || [])
}

/** Old footer/picker links used `/categories/{slug}`. Send them to the catalog filter. */
export default function CategoryCatalogRedirect() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { storePath } = useVendor()
  const { data, isLoading, isError } = useStoreCategories()

  const decoded = useMemo(() => {
    try {
      return decodeURIComponent(slug)
    } catch {
      return slug
    }
  }, [slug])

  if (isLoading && !isError) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const match = categoryBySlug(data?.categories, decoded)
  const name = match?.name?.trim()
  const base = (match?.applies_to || '').toLowerCase() === 'service' ? '/services' : '/products'
  const path = name ? `${base}?category=${encodeURIComponent(name)}` : '/products'

  return <Navigate to={storePath(path)} replace />
}
