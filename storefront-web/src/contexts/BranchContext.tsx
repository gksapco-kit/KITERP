import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

export type BranchContextValue = {
  branches: StoreLocation[]
  branchCode: string | null
  selectedBranch: StoreLocation | null
  /** True when the resolved business unit exists and is marked is_open=false. */
  isBranchClosed: boolean
  setBranchCode: (code: string | null) => void
  /** Same as vendor storePath but keeps the active ?branch= on internal links. */
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
  const { vendorSlug, storePath: vendorStorePath } = useVendor()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const [branches, setBranches] = useState<StoreLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [branchesLoaded, setBranchesLoaded] = useState(false)

  const branchCode = searchParams.get('branch')?.trim() || null

  useEffect(() => {
    void qc.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey[0]
        return key === 'products' || key === 'services' || key === 'product' || key === 'service' || key === 'store-categories'
      },
    })
  }, [branchCode, qc])

  useEffect(() => {
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
  }, [branchCode])

  useEffect(() => {
    setBranchQueryParam(branchCode)
  }, [branchCode])

  // Remember the selected unit across internal navigation (cart, checkout, etc.).
  useEffect(() => {
    if (!vendorSlug || !branchCode || loading || !branchesLoaded) return
    const match = matchBranch(branches, branchCode)
    if (match && match.is_open !== false) {
      writeSavedBranch(vendorSlug, branchCode)
    }
  }, [vendorSlug, branchCode, loading, branchesLoaded, branches])

  useEffect(() => {
    if (!vendorSlug || branchCode || loading) return
    const saved = readSavedBranch(vendorSlug)
    if (!saved) return
    const match = matchBranch(branches, saved)
    if (!match || match.is_open === false) return
    const next = new URLSearchParams(searchParams)
    next.set('branch', saved)
    const qs = next.toString()
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true })
  }, [vendorSlug, branchCode, loading, branches, location.pathname, navigate, searchParams])

  const selectedBranch = useMemo(
    () => matchBranch(branches, branchCode),
    [branches, branchCode],
  )

  // Replace stale ?branch= values with the default open unit once stores are loaded.
  useEffect(() => {
    if (!vendorSlug || loading || !branchesLoaded || !branchCode || selectedBranch) return
    const fallback = pickDefaultOpenBranch(branches)
    if (!fallback) return
    const resolved = branchCodeForStore(fallback)
    if (!resolved || branchKey(resolved) === branchKey(branchCode)) return
    const next = new URLSearchParams(searchParams)
    next.set('branch', resolved)
    const qs = next.toString()
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true })
  }, [
    vendorSlug,
    loading,
    branchesLoaded,
    branchCode,
    selectedBranch,
    branches,
    location.pathname,
    navigate,
    searchParams,
  ])

  // Only block checkout when the resolved unit is explicitly marked closed.
  const isBranchClosed = useMemo(
    () => !loading && branchesLoaded && selectedBranch?.is_open === false,
    [loading, branchesLoaded, selectedBranch],
  )

  const setBranchCode = useCallback(
    (code: string | null) => {
      const next = new URLSearchParams(searchParams)
      const trimmed = branchKey(code)
      if (trimmed) next.set('branch', trimmed)
      else next.delete('branch')
      if (vendorSlug) writeSavedBranch(vendorSlug, trimmed || null)
      const qs = next.toString()
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true })
    },
    [location.pathname, navigate, searchParams, vendorSlug],
  )

  const storePath = useCallback(
    (path: string) => {
      const href = vendorStorePath(path)
      if (!branchCode) return href
      const sep = href.includes('?') ? '&' : '?'
      return `${href}${sep}branch=${encodeURIComponent(branchCode)}`
    },
    [vendorStorePath, branchCode],
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
