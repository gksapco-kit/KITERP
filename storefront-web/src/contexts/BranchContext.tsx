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

export type BranchContextValue = {
  branches: StoreLocation[]
  branchCode: string | null
  selectedBranch: StoreLocation | null
  /** True when branchCode is set but not found in the open-branches list (store is closed). */
  isBranchClosed: boolean
  setBranchCode: (code: string | null) => void
  /** Same as vendor storePath but keeps the active ?branch= on internal links. */
  storePath: (path: string) => string
  loading: boolean
}

const BranchContext = createContext<BranchContextValue | null>(null)

function branchKey(v: string | null | undefined): string {
  return String(v ?? '').trim()
}

function matchBranch(stores: StoreLocation[], code: string | null): StoreLocation | null {
  const key = branchKey(code)
  if (!key) return null
  return stores.find((s) => branchKey(s.code) === key || branchKey(s.id) === key) ?? null
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const { storePath: vendorStorePath } = useVendor()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const [branches, setBranches] = useState<StoreLocation[]>([])
  const [loading, setLoading] = useState(true)

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
    storeApi
      .listBranches()
      .then((r) => {
        if (!cancelled) setBranches(r.stores ?? [])
      })
      .catch(() => {
        if (!cancelled) setBranches([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setBranchQueryParam(branchCode)
    return () => setBranchQueryParam(null)
  }, [branchCode])

  const selectedBranch = useMemo(
    () => matchBranch(branches, branchCode),
    [branches, branchCode],
  )

  // Branch is "closed" when the URL has a branch code that isn't in the open-branches list
  // (the public catalog API only returns is_open=true stores)
  const isBranchClosed = useMemo(
    () => !loading && branchCode !== null && selectedBranch === null && branches.length >= 0,
    [loading, branchCode, selectedBranch, branches.length],
  )

  const setBranchCode = useCallback(
    (code: string | null) => {
      const next = new URLSearchParams(searchParams)
      const trimmed = branchKey(code)
      if (trimmed) next.set('branch', trimmed)
      else next.delete('branch')
      const qs = next.toString()
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true })
    },
    [location.pathname, navigate, searchParams],
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
