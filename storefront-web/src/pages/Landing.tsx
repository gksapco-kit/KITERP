import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '@/api/client'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingHero } from '@/components/landing/LandingHero'
import { AppsGridSection } from '@/components/landing/AppsGridSection'
import { ValuePropSection } from '@/components/landing/ValuePropSection'
import { CommunityMosaicSection } from '@/components/landing/CommunityMosaicSection'
import { GrowthCtaSection } from '@/components/landing/GrowthCtaSection'
import { LandingFooter } from '@/components/landing/LandingFooter'
import type { StorefrontVendor } from '@/components/landing/landingData'
import '@/styles/kiterp-landing.css'

type StoreDirectoryItem = StorefrontVendor

export default function Landing() {
  const [slug, setSlug] = useState('')
  const [directory, setDirectory] = useState<StoreDirectoryItem[]>([])
  const [dirLoading, setDirLoading] = useState(true)
  const [dirError, setDirError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    setDirLoading(true)
    setDirError(null)
    apiClient
      .get<{ items: StorefrontVendor[] }>('/catalog/vendors', { params: { limit: 100 } })
      .then((res) => {
        if (!cancelled) setDirectory(res.data.items || [])
      })
      .catch(() => {
        if (!cancelled) {
          setDirectory([])
          setDirError('Could not load store list. Is the API running on port 8000?')
        }
      })
      .finally(() => {
        if (!cancelled) setDirLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const slugNeedle = slug.trim().toLowerCase()
  const matchingStores = useMemo(() => {
    if (!slugNeedle) return []
    return directory.filter(
      (v) =>
        v.slug.toLowerCase().includes(slugNeedle) ||
        v.display_name.toLowerCase().includes(slugNeedle) ||
        v.business_name.toLowerCase().includes(slugNeedle),
    )
  }, [directory, slugNeedle])

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = slug.trim().toLowerCase()
    if (trimmed) navigate(`/store/${trimmed}`)
  }

  const visitStore = (storeSlug: string) => navigate(`/store/${storeSlug}`)

  return (
    <div className="kiterp-landing font-kiterp-body min-h-screen bg-white">
      <LandingHeader />
      <main>
        <LandingHero />
        <AppsGridSection />
        <ValuePropSection />
        <CommunityMosaicSection
          vendors={directory}
          slug={slug}
          setSlug={setSlug}
          onSubmit={handleGo}
          directory={directory}
          matchingStores={matchingStores}
          dirLoading={dirLoading}
          dirError={dirError}
          slugNeedle={slugNeedle}
          onVisitStore={visitStore}
        />
        <GrowthCtaSection />
      </main>
      <LandingFooter />
    </div>
  )
}
