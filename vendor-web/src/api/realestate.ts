/** Real Estate — vendor API helpers. The UI is metadata-driven (see GET /meta). */
import apiClient from './client'

const base = '/vendors/me/realestate'

export type FieldMeta = {
  name: string
  label: string
  type:
    | 'text' | 'textarea' | 'select' | 'ref' | 'uuid' | 'boolean' | 'integer' | 'money'
    | 'number' | 'percent' | 'decimal' | 'date' | 'datetime' | 'json'
  required: boolean
  readonly: boolean
  hidden: boolean
  choices?: string[]
  ref?: string | null
  max?: number
  /** Only present when type === 'json'. Controls which editor is shown. */
  shape?: 'list' | 'map' | 'json'
}

export type ActionParam = {
  name: string
  label: string
  type: string
  required?: boolean
  choices?: string[]
  ref?: string
  default?: unknown
}

export type ActionMeta = {
  key: string
  label: string
  path: string
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  params: ActionParam[]
  when?: Record<string, string[]> | null
  confirm?: string | null
  style: 'default' | 'primary' | 'danger'
  result: 'refresh' | 'html' | 'download'
}

export type ResourceMeta = {
  key: string
  title: string
  columns: string[]
  search: boolean
  filters: string[]
  fields: FieldMeta[]
  can_create: boolean
  /** Fields of the "New" form for resources created through a dedicated endpoint. */
  create_fields?: string[]
  can_edit: boolean
  can_delete: boolean
  write_perm: string
  editable_when?: Record<string, string[]> | null
  actions: ActionMeta[]
}

export type ModuleTab = {
  label: string
  resource?: string
  view?: string
  filter?: Record<string, string>
}

export type ModuleMeta = { id: string; no: number; title: string; tabs: ModuleTab[] }

export type MergeField = { key: string; label: string; sample: string }

export type TemplateDefault = {
  template_type: string
  subject: string
  body: string
  preview_html: string
  merge_fields: MergeField[]
}

export type PrintSettings = {
  logo_url?: string
  header_html?: string
  footer_html?: string
  page_size?: 'A4' | 'Letter' | 'Legal'
  orientation?: 'portrait' | 'landscape'
  margin_mm?: number
  font_family?: string
  font_size_px?: number
  custom_css?: string
  show_signature?: boolean
  signatory_name?: string
  signature_url?: string
  watermark?: string
}

export type REMeta = {
  modules: ModuleMeta[]
  resources: Record<string, ResourceMeta>
  permissions: string[]
  template_types: string[]
  merge_fields: Record<string, MergeField[]>
}

export type Row = Record<string, any> & { id: string; _label?: string; _refs?: Record<string, string | null> }

export type Page<T = Row> = { items: T[]; total: number; page: number; size: number; pages: number }

export type REAlert = {
  severity: 'high' | 'medium' | 'low' | string
  title: string
  detail: string
  entity_type: string
  entity_id: string | null
  due: string | null
}

type Params = Record<string, string | number | boolean | undefined | null>

function clean(params?: Params) {
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') out[k] = v
  }
  return out
}

export function errMessage(e: unknown, fallback = 'Something went wrong'): string {
  const err = e as { response?: { data?: { detail?: unknown } }; message?: string }
  const d = err?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) {
    return d
      .map((x: { loc?: unknown[]; msg?: string }) => `${(x.loc ?? []).slice(1).join('.')}: ${x.msg ?? ''}`.trim())
      .join('; ')
  }
  return err?.message || fallback
}

export const reApi = {
  meta: () => apiClient.get<REMeta>(`${base}/meta`).then((r) => r.data),
  alerts: () => apiClient.get<{ items: REAlert[]; total: number }>(`${base}/alerts`).then((r) => r.data),

  list: (key: string, params?: Params) =>
    apiClient.get<Page>(`${base}/${key}`, { params: clean(params) }).then((r) => r.data),
  get: (key: string, id: string) => apiClient.get<Row>(`${base}/${key}/${id}`).then((r) => r.data),
  create: (key: string, body: Record<string, unknown>) =>
    apiClient.post<Row>(`${base}/${key}`, body).then((r) => r.data),
  update: (key: string, id: string, body: Record<string, unknown>) =>
    apiClient.patch<Row>(`${base}/${key}/${id}`, body).then((r) => r.data),
  remove: (key: string, id: string) => apiClient.delete(`${base}/${key}/${id}`).then((r) => r.data),

  runAction: (key: string, id: string, action: ActionMeta, values: Record<string, unknown>) => {
    const url = `${base}/${key}/${id}/${action.path}`
    if (action.method === 'GET') {
      return apiClient.get(url, { params: clean(values as Params) }).then((r) => r.data)
    }
    return apiClient.request({ url, method: action.method, data: values }).then((r) => r.data)
  },

  availability: (projectId: string, towerId?: string) =>
    apiClient
      .get(`${base}/units/availability`, { params: clean({ project_id: projectId, tower_id: towerId }) })
      .then((r) => r.data as AvailabilityResponse),
  inventorySummary: (projectId: string) =>
    apiClient.get(`${base}/projects/${projectId}/inventory-summary`).then((r) => r.data as InventorySummary),
  pipeline: (params?: Params) =>
    apiClient.get(`${base}/leads/pipeline`, { params: clean(params) }).then((r) => r.data as PipelineResponse),
  moveLead: (id: string, stage: string, lost_reason?: string) =>
    apiClient.post(`${base}/leads/${id}/stage`, { stage, lost_reason }).then((r) => r.data),
  followupSummary: () => apiClient.get(`${base}/followups/summary`).then((r) => r.data as Record<string, number>),
  approve: (id: string, comments?: string) =>
    apiClient.post(`${base}/approval-requests/${id}/approve`, { comments }).then((r) => r.data),
  reject: (id: string, comments: string) =>
    apiClient.post(`${base}/approval-requests/${id}/reject`, { comments }).then((r) => r.data),

  /** Read-only report endpoints (`/collections/overdue`, `/tax/gst-summary` ...). */
  report: <T = any>(path: string, params?: Params) =>
    apiClient.get<T>(`${base}${path}`, { params: clean(params) }).then((r) => r.data),
  post: <T = any>(path: string, body?: Record<string, unknown>) =>
    apiClient.post<T>(`${base}${path}`, body ?? {}).then((r) => r.data),

  // ── Print templates ─────────────────────────────────────────────────────
  /** Fetch the built-in default subject/body/preview for a template type. */
  templateDefault: (templateType: string) =>
    apiClient.get<TemplateDefault>(`${base}/templates/defaults/${templateType}`).then((r) => r.data),
  /** Preview a saved template (full print-ready HTML). */
  templatePreview: (templateId: string) =>
    apiClient.get<{ subject: string; html: string; body: string; print_settings: PrintSettings }>(
      `${base}/templates/${templateId}/preview`,
    ).then((r) => r.data),
  /** Create a new vendor template override. */
  templateCreate: (body: {
    template_type: string
    name: string
    subject?: string
    body?: string
    is_default?: boolean
    is_active?: boolean
    print_settings?: PrintSettings
  }) => apiClient.post<Row>(`${base}/templates`, body).then((r) => r.data),
  /** Update an existing template. */
  templateUpdate: (id: string, body: {
    name?: string
    subject?: string
    body?: string
    is_default?: boolean
    is_active?: boolean
    print_settings?: PrintSettings
  }) => apiClient.patch<Row>(`${base}/templates/${id}`, body).then((r) => r.data),
}

export type AvailabilityUnit = {
  id: string
  unit_number: string
  status: string
  category: string
  area: number
  price: number
  bedrooms: number | null
  facing: string | null
}

export type AvailabilityResponse = {
  total: number
  summary: Record<string, number>
  towers: { id: string | null; name: string; floors: { floor: number; units: AvailabilityUnit[] }[] }[]
}

export type InventorySummary = {
  total_units: number
  sold_units: number
  sold_percent: number
  by_status: Record<string, { count: number; value: number }>
  by_category: Record<string, number>
  unsold_ageing_days: Record<string, number>
  inventory_value: number
}

export type PipelineResponse = {
  stages: {
    stage: string
    count: number
    budget_total: number
    items: {
      id: string
      lead_no: string | null
      full_name: string
      phone: string | null
      source: string | null
      budget_max: number
      project_id: string | null
      assigned_to_name: string | null
      next_followup_at: string | null
    }[]
  }[]
  total: number
  conversion_percent: number
}
