import { useMemo } from 'react'
import { Search, ArrowRight } from 'lucide-react'
import { VENDOR_SIGNUP_PATH } from '@/lib/vendorSignupPaths'
import { vendorAppUrl } from '@/lib/appUrls'

type StoreDirectoryItem = { slug: string; display_name: string; business_name: string }

type Props = {
  slug: string
  setSlug: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  directory: StoreDirectoryItem[]
  matchingStores: StoreDirectoryItem[]
  dirLoading: boolean
  dirError: string | null
  slugNeedle: string
  onVisitStore: (slug: string) => void
}

export function LandingHero({
  slug, setSlug, onSubmit, directory, matchingStores,
  dirLoading, dirError, slugNeedle, onVisitStore,
}: Props) {
  const hint = useMemo(() => {
    if (dirLoading) return 'Loading stores…'
    if (dirError) return dirError
    if (directory.length === 0) return 'No approved vendors yet.'
    return 'Type a store name to visit a live storefront.'
  }, [dirLoading, dirError, directory.length])

  return (
    <section id="stores" className="relative kiterp-curve-bg overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center kiterp-reveal">
        <h1 className="font-kiterp-script text-[2rem] sm:text-5xl lg:text-[3.2rem] leading-[1.1] text-[#1e3d34]">
          Run your business, team, and website on{' '}
          <span className="kiterp-highlight">one KIT ERP platform.</span>
        </h1>

        <p className="mt-5 font-kiterp-script text-xl sm:text-2xl lg:text-3xl text-[#1e3d34]/90 max-w-3xl mx-auto">
          One Login, Yet Affordable, Scalable, ROI-Driven, and User-Friendly.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <a href={VENDOR_SIGNUP_PATH} className="kiterp-btn-primary px-7 py-3 text-base sm:text-lg">
            Start now — It&apos;s free
          </a>
          <a
            href={`${vendorAppUrl}/login`}
            className="kiterp-btn-secondary px-7 py-3 text-base sm:text-lg"
          >
            Meet an advisor
          </a>
        </div>

        <div className="mt-6 flex justify-center items-start gap-2 text-left max-w-xs mx-auto sm:max-w-none sm:justify-end sm:pr-8">
          <svg width="48" height="36" viewBox="0 0 48 36" className="shrink-0 mt-1 hidden sm:block" aria-hidden>
            <path d="M4 32 C 18 8, 30 28, 44 4" className="kiterp-scribble-arrow" />
          </svg>
          <p className="kiterp-hand-note text-[#3d9a7a]">
            ₹0.00 / month for ALL apps
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-12 max-w-xl mx-auto text-left">
          <p className="text-sm font-medium text-gray-500 mb-3 text-center">Or visit a live store</p>
          <datalist id="landing-store-slugs">
            {matchingStores.map((v) => (
              <option key={v.slug} value={v.slug}>{v.display_name}</option>
            ))}
          </datalist>
          <div className="flex rounded-full overflow-hidden shadow-lg shadow-[#64C3A0]/15 border border-[#64C3A0]/20 bg-white">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                list="landing-store-slugs"
                autoComplete="off"
                placeholder="Search store name or slug…"
                className="w-full h-12 sm:h-14 pl-12 pr-4 text-base text-gray-900 bg-transparent focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!slug.trim()}
              className="kiterp-btn-primary disabled:opacity-45 px-5 sm:px-7 rounded-none flex items-center gap-2"
            >
              Visit <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400 text-center">{hint}</p>
          {!dirLoading && directory.length > 0 && slugNeedle && matchingStores.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {matchingStores.slice(0, 8).map((v) => (
                <button
                  key={v.slug}
                  type="button"
                  onClick={() => onVisitStore(v.slug)}
                  className="text-xs px-3 py-1.5 rounded-full bg-[#64C3A0]/10 text-[#3d9a7a] border border-[#64C3A0]/25 hover:bg-[#64C3A0]/18 transition-colors"
                >
                  {v.display_name}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    </section>
  )
}
