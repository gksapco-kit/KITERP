import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { storeApi, type StoreLocation } from '@/api/store'
import { setBranchQueryParam } from '@/api/client'
import { useVendor } from '@/contexts/VendorContext'
import {
  branchCodeForStore,
  branchKey,
  matchBranch,
  pickDefaultOpenBranch,
} from '@/lib/branchMatching'
import { noteStickyBranch, readStickyBranch } from '@/lib/stickyBranch'

/** Employee HR links keep ?branch= so outlet-pinned login still matches the unit. */
function keepsBranchInAddressBar(pathname: string): boolean {
  return /(^|\/)hr(\/|$)/.test(pathname)
}

export type BranchContextValue = {
  branches: StoreLocation[]
  branchCode: string | null
  selectedBranch: StoreLocation | null
  /** True when the resolved business unit exists and is marked is_open=false. */
  isBranchClosed: boolean
  setBranchCode: (code: string | null) => void
  /** Store path without putting the active unit back into the address bar. */
  storePath: (path: string) => string
  loading: boolean
}

const BranchContext = createContext<BranchContextValue | null>(null)

const BRANCH_SESSION_PREFIX = 'kiterp_store_branch:'

function branchSessionKey(vendorSlug: string): string {
  return `${BRANCH_SESSION_PREFIX}${vendorSlug}`
}

function readSavedBranch(vendorSlug: string): string | null {
  try {
    const raw = sessionStorage.getItem(branchSessionKey(vendorSlug))?.trim()
    return raw || null
  } catch {
    return null
  }
}

function writeSavedBranch(vendorSlug: string, code: string | null) {
  try {
    const key = branchSessionKey(vendorSlug)
    if (!code) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, code)
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

export function BranchPreviewProvider({
  value,
  children,
}: {
  value: BranchContextValue
  children: ReactNode
}) {
  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const { vendorSlug, vendor, isLoading: vendorLoading, storePath: vendorStorePath } = useVendor()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const [branches, setBranches] = useState<StoreLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [branchesLoaded, setBranchesLoaded] = useState(false)

  const urlBranch = searchParams.get('branch')?.trim() || null
  const draftEmbed = searchParams.get('draft_embed') === '1'
  const [heldBranch, setHeldBranch] = useState<string | null>(null)
  const branchCode = urlBranch || heldBranch || readStickyBranch()

  // Remember ?branch= and drop it from customer URLs so the address bar stays
  // /vendor-slug (and /about, /products, …) while this unit stays selected.
  useLayoutEffect(() => {
    if (!urlBranch) return
    setHeldBranch(urlBranch)
    noteStickyBranch(urlBranch)
    if (vendorSlug) writeSavedBranch(vendorSlug, urlBranch)
    if (draftEmbed || keepsBranchInAddressBar(location.pathname)) return
    const next = new URLSearchParams(searchParams)
    next.delete('branch')
    const qs = next.toString()
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`, { replace: true })
  }, [urlBranch, draftEmbed, vendorSlug, location.pathname, location.hash, navigate, searchParams])

  useEffect(() => {
    void qc.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey[0]
        return key === 'products' || key === 'services' || key === 'product' || key === 'service' || key === 'store-categories'
      },
    })
  }, [branchCode, vendorSlug, qc])

  // Wait until this tab's vendor context is set — otherwise listBranches can hit another site's headers.
  useEffect(() => {
    if (!vendorSlug || vendorLoading || !vendor?.id) {
      setLoading(true)
      setBranchesLoaded(false)
      setBranches([])
      return
    }
    let cancelled = false
    setLoading(true)
    setBranchesLoaded(false)
    storeApi
      .listBranches()
      .then((r) => {
        if (!cancelled) {
          setBranches(r.stores ?? [])
          setBranchesLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBranches([])
          setBranchesLoaded(false)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [vendorSlug, vendor?.id, vendorLoading, branchCode])

  useEffect(() => {
    setBranchQueryParam(branchCode)
  }, [branchCode])

  // Remember the selected unit in this tab. Do not write it back into the URL.
  useEffect(() => {
    if (!vendorSlug || !branchCode || loading || !branchesLoaded) return
    const match = matchBranch(branches, branchCode)
    if (match && match.is_open !== false) {
      writeSavedBranch(vendorSlug, branchCode)
      noteStickyBranch(branchCode)
    }
  }, [vendorSlug, branchCode, loading, branchesLoaded, branches])

  useEffect(() => {
    if (!vendorSlug || urlBranch || heldBranch || loading) return
    const saved = readSavedBranch(vendorSlug)
    if (!saved) return
    const match = matchBranch(branches, saved)
    if (!match || match.is_open === false) return
    setHeldBranch(saved)
    noteStickyBranch(saved)
  }, [vendorSlug, urlBranch, heldBranch, loading, branches])

  const selectedBranch = useMemo(
    () => matchBranch(branches, branchCode),
    [branches, branchCode],
  )

  // Resolve a stale or duplicate code to the real unit without putting it in the URL.
  useEffect(() => {
    if (!vendorSlug || loading || !branchesLoaded || !branchCode) return

    if (!selectedBranch) {
      const fallback = pickDefaultOpenBranch(branches)
      if (!fallback) return
      const resolved = branchCodeForStore(fallback, branches)
      if (!resolved || branchKey(resolved) === branchKey(branchCode)) return
      setHeldBranch(resolved)
      noteStickyBranch(resolved)
      writeSavedBranch(vendorSlug, resolved)
      return
    }

    const canonical = branchCodeForStore(selectedBranch, branches)
    if (!canonical || branchKey(canonical) === branchKey(branchCode)) return
    setHeldBranch(canonical)
    noteStickyBranch(canonical)
    writeSavedBranch(vendorSlug, canonical)
  }, [
    vendorSlug,
    loading,
    branchesLoaded,
    branchCode,
    selectedBranch,
    branches,
  ])

  // Only block checkout when the resolved unit is explicitly marked closed.
  const isBranchClosed = useMemo(
    () => !loading && branchesLoaded && selectedBranch?.is_open === false,
    [loading, branchesLoaded, selectedBranch],
  )

  const setBranchCode = useCallback(
    (code: string | null) => {
      const trimmed = branchKey(code) || null
      setHeldBranch(trimmed)
      noteStickyBranch(trimmed)
      if (vendorSlug) writeSavedBranch(vendorSlug, trimmed)
      if (!searchParams.get('branch') || keepsBranchInAddressBar(location.pathname)) return
      const next = new URLSearchParams(searchParams)
      next.delete('branch')
      const qs = next.toString()
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`, { replace: true })
    },
    [location.hash, location.pathname, navigate, searchParams, vendorSlug],
  )

  const storePath = useCallback(
    (path: string) => vendorStorePath(path),
    [vendorStorePath],
  )

  const value = useMemo<BranchContextValue>(
    () => ({
      branches,
      branchCode,
      selectedBranch,
      isBranchClosed,
      setBranchCode,
      storePath,
      loading,
    }),
    [branches, branchCode, selectedBranch, isBranchClosed, setBranchCode, storePath, loading],
  )

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

export function useBranch(): BranchContextValue {
  const ctx = useContext(BranchContext)
  const { storePath: vendorStorePath } = useVendor()
  if (ctx) return ctx
  return {
    branches: [],
    branchCode: null,
    selectedBranch: null,
    isBranchClosed: false,
    setBranchCode: () => {},
    storePath: vendorStorePath,
    loading: false,
  }
}
