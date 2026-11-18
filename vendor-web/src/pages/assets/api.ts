/** Asset Management — API helpers and react-query hooks (all endpoints live under /vendors/me/assets). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { useAuthStore } from '@/stores/authStore'
import { extractApiError } from '@/lib/errorMessages'
import { toast } from 'sonner'

export const AM_BASE = '/vendors/me/assets'

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>
export type Page<T = Row> = { items: T[]; total: number; page: number; size: number }

export async function amGet<T = any>(path: string, params?: Record<string, unknown>): Promise<T> {
  const clean: Record<string, unknown> = {}
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') clean[k] = v
  })
  return (await apiClient.get(`${AM_BASE}${path}`, { params: clean })).data as T
}

export async function amSend<T = any>(method: 'post' | 'put' | 'delete', path: string, body?: unknown): Promise<T> {
  const url = `${AM_BASE}${path}`
  if (method === 'delete') return (await apiClient.delete(url)).data as T
  return (await apiClient[method](url, body ?? {})).data as T
}

/** GET query, cached under ['am', path, params]. */
export function useAm<T = any>(path: string, params?: Record<string, unknown>, opts?: { enabled?: boolean; staleTime?: number }) {
  return useQuery<T>({
    queryKey: ['am', path, params ?? null],
    queryFn: () => amGet<T>(path, params),
    enabled: opts?.enabled ?? true,
    staleTime: opts?.staleTime ?? 15_000,
  })
}

type MutVars = { method?: 'post' | 'put' | 'delete'; path: string; body?: unknown }

/** One generic mutation. Invalidates every asset query on success. */
export function useAmMutation(opts?: { success?: string; onSuccess?: (data: any) => void; silentError?: boolean }) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: MutVars) => amSend(v.method ?? 'post', v.path, v.body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['am'] })
      if (opts?.success) toast.success(opts.success)
      opts?.onSuccess?.(data)
    },
    onError: (err: unknown) => {
      if (!opts?.silentError) toast.error(extractApiError(err, 'Something went wrong'))
    },
  })
}

export async function uploadAssetDocument(assetId: string, file: File, docType: string, notes?: string) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('doc_type', docType)
  if (notes) fd.append('notes', notes)
  return (await apiClient.post(`${AM_BASE}/${assetId}/documents`, fd)).data as Row
}

/** Download / open a binary response (labels PDF, CSV export). */
export async function openBlob(method: 'get' | 'post', path: string, opts: { body?: unknown; params?: Record<string, unknown>; filename?: string; inline?: boolean }) {
  const res = await apiClient.request({
    method, url: `${AM_BASE}${path}`, data: opts.body, params: opts.params, responseType: 'blob',
  })
  const url = URL.createObjectURL(res.data as Blob)
  if (opts.inline) {
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }
  const a = document.createElement('a')
  a.href = url
  a.download = opts.filename ?? 'download'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5_000)
}

/** Fetch an authenticated SVG/QR as a blob URL for <img>. */
export async function fetchBlobUrl(path: string): Promise<string> {
  const res = await apiClient.get(`${AM_BASE}${path}`, { responseType: 'blob' })
  return URL.createObjectURL(res.data as Blob)
}

/** Permission helper: owners/admins pass everything, others need the exact key. */
export function useAssetPerms() {
  const user = useAuthStore((s) => s.user)
  const role = user?.vendor_role?.role
  const roleName = user?.vendor_role?.role_name?.toLowerCase()
  const admin = role === 'owner' || role === 'admin' || role === 'platform_staff' || roleName === 'owner' || roleName === 'admin'
  const perms: string[] = (user?.vendor_role?.permissions as string[] | undefined) ?? []
  const can = (p: string) => admin || perms.includes(p)
  return {
    can,
    manage: can('assets.manage'),
    approve: can('assets.approve'),
    audit: can('assets.audit'),
    finance: can('assets.finance'),
    hr: can('hr.view'),
  }
}

export const STATUS_LABEL: Record<string, string> = {
  in_stock: 'In stock', assigned: 'Assigned', in_transit: 'In transit', under_maintenance: 'Under maintenance',
  reserved: 'Reserved', lost: 'Lost', retired: 'Retired', disposed: 'Disposed',
}
export const CONDITIONS = ['new', 'good', 'fair', 'poor', 'damaged']
export const LOCATION_TYPES = ['site', 'building', 'floor', 'room', 'store', 'vehicle', 'other']
export const DOC_TYPES = ['invoice', 'manual', 'photo', 'warranty_card', 'certificate', 'agreement', 'other']
export const COVERAGE_TYPES = ['warranty', 'insurance', 'amc']
