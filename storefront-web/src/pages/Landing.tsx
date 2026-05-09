import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Store, Search, ArrowRight, ShieldCheck, Zap, Globe, Sparkles } from 'lucide-react'
import { vendorAppUrl, adminAppUrl } from '@/lib/appUrls'
import { apiClient } from '@/api/client'

type StoreDirectoryItem = { slug: string; display_name: string; business_name: string }

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
      .get<{ items: StoreDirectoryItem[] }>('/catalog/vendors', { params: { limit: 80 } })
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-7 h-7 text-amber-400" />
            <span className="font-bold text-lg">KITERP</span>
          </div>
          <nav className="flex items-center gap-4">
            <a href="/vendor/signup" className="text-sm text-amber-300 hover:text-amber-200 font-medium transition-colors">Create Business</a>
            <a href={`${vendorAppUrl}/login`} className="text-sm text-gray-300 hover:text-white transition-colors">User Login</a>
            <a href={adminAppUrl} className="text-sm px-3 py-1.5 bg-white/10 rounded-md hover:bg-white/20 transition-colors">Admin</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IGZpbGw9InVybCgjZykiIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative max-w-4xl mx-auto px-4 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-1.5 rounded-full text-sm text-amber-300 mb-6">
            <Sparkles className="w-4 h-4" /> Multi-Vendor E-Commerce Platform
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
            Your Favourite Stores,<br />
            <span className="text-amber-400">All In One Place</span>
          </h1>
          <p className="mt-5 text-lg text-gray-300 max-w-2xl mx-auto">
            Discover products, services, and deals from trusted vendors. Shop securely from a single platform.
          </p>

          {/* Store search */}
          <form onSubmit={handleGo} className="mt-10 max-w-lg mx-auto">
            <datalist id="landing-store-slugs">
              {matchingStores.map((v) => (
                <option key={v.slug} value={v.slug}>
                  {v.display_name}
                </option>
              ))}
            </datalist>
            <div className="flex rounded-xl overflow-hidden shadow-2xl shadow-black/20">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  list="landing-store-slugs"
                  autoComplete="off"
                  placeholder="Type a store name or ID — matching suggestions appear as you type"
                  className="w-full h-14 pl-12 pr-4 text-base text-gray-900 bg-white focus:outline-none"
                />
              </div>
              <button type="submit" disabled={!slug.trim()}
                className="bg-amber-400 hover:bg-amber-500 disabled:opacity-50 px-6 sm:px-8 font-bold text-slate-900 flex items-center gap-2 transition-colors">
                Visit <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-400">
              {dirLoading
                ? 'Loading stores…'
                : dirError
                  ? dirError
                  : directory.length === 0
                    ? 'No approved vendors yet. From the backend folder run: python setup_vendor.py'
                    : 'Enter at least one letter or number to see matching stores, then visit.'}
            </p>
            {!dirLoading && directory.length > 0 && slugNeedle && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {matchingStores.slice(0, 10).map((v) => (
                  <button
                    key={v.slug}
                    type="button"
                    onClick={() => navigate(`/store/${v.slug}`)}
                    className="text-xs sm:text-sm px-3 py-1.5 rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/20 transition-colors"
                  >
                    <span className="font-semibold">{v.slug}</span>
                    <span className="text-blue-200 ml-1.5 hidden sm:inline">({v.display_name})</span>
                  </button>
                ))}
              </div>
            )}
            {!dirLoading && slugNeedle && matchingStores.length === 0 && directory.length > 0 && (
              <p className="mt-2 text-sm text-amber-200/90">No store matches that text.</p>
            )}
          </form>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Why Choose KITERP?</h2>
            <p className="mt-2 text-gray-500">Built for vendors and customers alike</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Globe, title: 'Multi-Vendor Platform', color: 'bg-blue-50 text-blue-600',
                desc: 'Each vendor gets their own branded storefront with products, services, and independent checkout.',
              },
              {
                icon: ShieldCheck, title: 'Verified Vendors', color: 'bg-green-50 text-green-600',
                desc: 'All vendors go through a verification process to ensure trust and quality for customers.',
              },
              {
                icon: Zap, title: 'Seamless Experience', color: 'bg-amber-50 text-amber-600',
                desc: 'Browse, shop, and manage orders across multiple vendors from a single, unified platform.',
              },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border p-8 hover:shadow-lg transition-shadow text-center">
                <div className={`w-14 h-14 rounded-xl ${f.color} flex items-center justify-center mx-auto mb-4`}>
                  <f.icon className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-700 py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Ready to sell online?</h2>
          <p className="mt-3 text-blue-100">Join KITERP as a vendor and start selling products and services today.</p>
          <div className="mt-8 flex justify-center gap-3">
            <a href="/vendor/signup">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 font-bold h-12 px-8">
                Create Your Business — Free
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-gray-400 py-10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Store className="w-6 h-6 text-amber-400" />
            <span className="text-white font-bold text-lg">KITERP</span>
          </div>
          <p className="text-sm">&copy; {new Date().getFullYear()} KITERP. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
