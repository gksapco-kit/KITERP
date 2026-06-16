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

function branchKey(v: string | null | undefined): string {
  return String(v ?? '').trim().toLowerCase()
}

function matchBranch(stores: StoreLocation[], code: string | null): StoreLocation | null {
  const key = branchKey(code)
  if (!key) return null
  return stores.find((s) => branchKey(s.code) === key || branchKey(s.id) === key) ?? null
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const { vendorSlug, storePath: vendorStorePath } = useVendor()
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
  }, [branchCode])

  useEffect(() => {
    setBranchQueryParam(branchCode)
  }, [branchCode])

  // Remember the selected unit across internal navigation (cart, checkout, etc.).
  useEffect(() => {
    if (!vendorSlug) return
    if (branchCode) {
      writeSavedBranch(vendorSlug, branchCode)
    }
  }, [vendorSlug, branchCode])

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

  // Branch is closed when the URL points to an unknown unit or one marked is_open=false.
  const isBranchClosed = useMemo(
    () =>
      !loading
      && branchCode !== null
      && (selectedBranch === null || selectedBranch.is_open === false),
    [loading, branchCode, selectedBranch],
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
