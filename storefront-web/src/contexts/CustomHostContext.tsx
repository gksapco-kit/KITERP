/**
 * Resolves the vendor for the current custom domain Host and exposes
 * root-path mode (URLs without /{slug} prefix).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import axios from 'axios'
import { getStorefrontApiBaseUrl } from '@/lib/apiBase'
import { currentCustomDomainHost, isCustomDomainHostname } from '@/lib/customHost'

const API_URL = getStorefrontApiBaseUrl().replace(/\/$/, '')

export interface CustomHostState {
  /** True when Host is not the KIT ERP platform domain. */
  isCustomHost: boolean
  isLoading: boolean
  vendorSlug: string | null
  vendorId: string | null
  error: string | null
  host: string | null
}

const CustomHostContext = createContext<CustomHostState>({
  isCustomHost: false,
  isLoading: false,
  vendorSlug: null,
  vendorId: null,
  error: null,
  host: null,
})

export function CustomHostProvider({ children }: { children: ReactNode }) {
  const host = typeof window !== 'undefined' ? currentCustomDomainHost() : null
  const isCustomHost = Boolean(host)

  const [vendorSlug, setVendorSlug] = useState<string | null>(null)
  const [vendorId, setVendorId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(isCustomHost)

  useEffect(() => {
    if (!host || !isCustomDomainHostname(host)) {
      setVendorSlug(null)
      setVendorId(null)
      setError(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    axios
      .get(`${API_URL}/catalog/vendor/by-domain/${encodeURIComponent(host)}`, { timeout: 15_000 })
      .then((res) => {
        if (cancelled) return
        setVendorSlug(res.data?.slug || null)
        setVendorId(res.data?.id || null)
        if (!res.data?.slug) setError('Domain is not linked to a store')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const status = (err as { response?: { status?: number } })?.response?.status
        setVendorSlug(null)
        setVendorId(null)
        setError(
          status === 404
            ? 'This domain is not connected to a KIT ERP storefront yet.'
            : 'Could not resolve this custom domain. Try again shortly.',
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [host])

  const value = useMemo<CustomHostState>(
    () => ({
      isCustomHost,
      isLoading,
      vendorSlug,
      vendorId,
      error,
      host,
    }),
    [isCustomHost, isLoading, vendorSlug, vendorId, error, host],
  )

  return <CustomHostContext.Provider value={value}>{children}</CustomHostContext.Provider>
}

export function useCustomHost() {
  return useContext(CustomHostContext)
}
