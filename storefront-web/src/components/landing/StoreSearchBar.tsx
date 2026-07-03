import { useMemo } from 'react'
import { Search, ArrowRight } from 'lucide-react'
import type { StorefrontVendor } from './landingData'

type Props = {
  slug: string
  setSlug: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  directory: StorefrontVendor[]
  matchingStores: StorefrontVendor[]
  dirLoading: boolean
  dirError: string | null
  slugNeedle: string
  onVisitStore: (slug: string) => void
  /** Compact layout for embedding inside the mosaic center card. */
  embedded?: boolean
}

export function StoreSearchBar({
  slug, setSlug, onSubmit, directory, matchingStores,
  dirLoading, dirError, slugNeedle, onVisitStore, embedded = false,
}: Props) {
  const hint = useMemo(() => {
    if (dirLoading) return 'Loading stores…'
    if (dirError) return dirError
    if (directory.length === 0) return 'No approved vendors yet.'
    return 'Type a store name to visit a live storefront.'
  }, [dirLoading, dirError, directory.length])

  return (
    <form
      onSubmit={onSubmit}
      className={embedded
        ? 'kiterp-mosaic-search mt-2 w-full mx-auto text-left'
        : 'mt-10 sm:mt-12 max-w-xl mx-auto text-left'}
    >
      <datalist id="landing-store-slugs">
        {matchingStores.map((v) => (
          <option key={v.slug} value={v.slug}>{v.display_name}</option>
        ))}
      </datalist>
      <div className={`flex rounded-full overflow-hidden bg-white ${
        embedded
          ? 'shadow-md shadow-[#64C3A0]/12 border border-[#64C3A0]/18'
          : 'shadow-lg shadow-[#64C3A0]/15 border border-[#64C3A0]/20'
      }`}>
        <div className="relative flex-1 min-w-0">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 ${embedded ? 'w-3.5 h-3.5' : 'w-5 h-5 left-4'}`} />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            list="landing-store-slugs"
            autoComplete="off"
            placeholder={embedded ? 'Search store…' : 'Search store name or slug…'}
            className={`w-full bg-transparent text-gray-900 focus:outline-none ${
              embedded
                ? 'h-7 sm:h-8 pl-7 pr-2 text-[11px] sm:text-xs'
                : 'h-12 sm:h-14 pl-12 pr-4 text-base'
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={!slug.trim()}
          className={`kiterp-btn-primary disabled:opacity-45 rounded-none flex items-center shrink-0 ${
            embedded
              ? 'px-2.5 sm:px-3 gap-0.5 text-[10px] sm:text-[11px] h-7 sm:h-8'
              : 'px-5 sm:px-7 gap-2'
          }`}
        >
          Visit {!embedded && <ArrowRight className="w-4 h-4" />}
          {embedded && <ArrowRight className="w-3 h-3" />}
        </button>
      </div>
      {embedded ? null : (dirLoading || dirError || directory.length === 0) && (
        <p className="mt-2 text-xs text-center text-gray-400">
          {hint}
        </p>
      )}
      {!dirLoading && directory.length > 0 && slugNeedle && matchingStores.length > 0 && (
        <div className={`flex flex-wrap justify-center gap-1.5 ${embedded ? 'mt-1.5' : 'mt-3'}`}>
          {matchingStores.slice(0, embedded ? 4 : 8).map((v) => (
            <button
              key={v.slug}
              type="button"
              onClick={() => onVisitStore(v.slug)}
              className={`rounded-full bg-[#64C3A0]/10 text-[#3d9a7a] border border-[#64C3A0]/25 hover:bg-[#64C3A0]/18 transition-colors ${
                embedded ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1.5'
              }`}
            >
              {v.display_name}
            </button>
          ))}
        </div>
      )}
    </form>
  )
}
