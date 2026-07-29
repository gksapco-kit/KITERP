/** Pharmaceutical Manufacturing — vendor API helpers */
import apiClient from './client'

const base = '/vendors/me/pharma'

export const pharmaApi = {
  overview: () => apiClient.get(`${base}/overview`).then((r) => r.data),
  nextBatchNumber: (body: {
    model_code?: string
    purpose?: string
    plant_id?: string
    product_id?: string
    prefix?: string
    pad_width?: number
  }) => apiClient.post(`${base}/batch-numbers/next`, body).then((r) => r.data),
  sequences: (params?: { plant_id?: string }) =>
    apiClient.get(`${base}/batch-sequences`, { params }).then((r) => r.data),
  getSequence: (id: string) =>
    apiClient.get(`${base}/batch-sequences/${id}`).then((r) => r.data),
  batches: (params?: Record<string, string | number | undefined>) =>
    apiClient.get(`${base}/batches`, { params }).then((r) => r.data),
  getBatch: (id: string) => apiClient.get(`${base}/batches/${id}`).then((r) => r.data),
  updateBatchStatus: (id: string, body: { quality_status: string; notes?: string }) =>
    apiClient.patch(`${base}/batches/${id}/status`, body).then((r) => r.data),
  transactions: (params?: Record<string, string | number | undefined>) =>
    apiClient.get(`${base}/transactions`, { params }).then((r) => r.data),
  fefo: (params: { product_id: string; qty: number; plant_id?: string }) =>
    apiClient.get(`${base}/fefo`, { params }).then((r) => r.data),
  quarantine: () => apiClient.get(`${base}/quarantine`).then((r) => r.data),
  alerts: (params?: { expiry_within_days?: number }) =>
    apiClient.get(`${base}/alerts`, { params }).then((r) => r.data),
  listMbr: (params?: { product_id?: string }) =>
    apiClient.get(`${base}/mbr`, { params }).then((r) => r.data),
  createMbr: (body: Record<string, unknown>) =>
    apiClient.post(`${base}/mbr`, body).then((r) => r.data),
  updateMbr: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`${base}/mbr/${id}`, body).then((r) => r.data),
  approveMbr: (id: string, body?: { password?: string; meaning?: string; totp_code?: string }) =>
    apiClient.post(`${base}/mbr/${id}/approve`, body || {}).then((r) => r.data),
  listBpr: (params?: { status?: string }) =>
    apiClient.get(`${base}/bpr`, { params }).then((r) => r.data),
  createBpr: (body: Record<string, unknown>) =>
    apiClient.post(`${base}/bpr`, body).then((r) => r.data),
  updateBpr: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`${base}/bpr/${id}`, body).then((r) => r.data),
  logBprStep: (id: string, body: Record<string, unknown>) =>
    apiClient.post(`${base}/bpr/${id}/steps`, body).then((r) => r.data),
  logBprIpc: (id: string, body: Record<string, unknown>) =>
    apiClient.post(`${base}/bpr/${id}/ipc`, body).then((r) => r.data),
  completeBpr: (
    id: string,
    body: {
      actual_qty: number
      notes?: string
      password?: string
      meaning?: string
      totp_code?: string
    },
  ) => apiClient.post(`${base}/bpr/${id}/complete`, body).then((r) => r.data),
  listQcSpecs: (params?: { product_id?: string }) =>
    apiClient.get(`${base}/qc-specs`, { params }).then((r) => r.data),
  createQcSpec: (body: Record<string, unknown>) =>
    apiClient.post(`${base}/qc-specs`, body).then((r) => r.data),
  updateQcSpec: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`${base}/qc-specs/${id}`, body).then((r) => r.data),
  approveQcSpec: (id: string, body?: { password?: string; meaning?: string; totp_code?: string }) =>
    apiClient.post(`${base}/qc-specs/${id}/approve`, body || {}).then((r) => r.data),
  listInspections: (params?: { status?: string; goods_batch_id?: string }) =>
    apiClient.get(`${base}/inspections`, { params }).then((r) => r.data),
  createInspection: (body: Record<string, unknown>) =>
    apiClient.post(`${base}/inspections`, body).then((r) => r.data),
  saveInspectionResults: (id: string, body: { results: unknown[]; status?: string }) =>
    apiClient.patch(`${base}/inspections/${id}/results`, body).then((r) => r.data),
  decideInspection: (
    id: string,
    body: {
      decision: string
      notes?: string
      password?: string
      meaning?: string
      totp_code?: string
    },
  ) => apiClient.post(`${base}/inspections/${id}/decide`, body).then((r) => r.data),
  getCoa: (id: string) => apiClient.get(`${base}/coa/${id}`).then((r) => r.data),
  getCoaPrintHtml: (id: string) =>
    apiClient.get(`${base}/coa/${id}/print`, { responseType: 'text' }).then((r) => r.data as string),
  getCoaPdfBlob: (id: string) =>
    apiClient.get(`${base}/coa/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data as Blob),
  getBprPdfBlob: (id: string) =>
    apiClient.get(`${base}/bpr/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data as Blob),
  openRetest: (batchId: string) =>
    apiClient.post(`${base}/batches/${batchId}/retest`).then((r) => r.data),
  genealogy: (batchId: string, direction = 'both') =>
    apiClient.get(`${base}/genealogy/${batchId}`, { params: { direction } }).then((r) => r.data),
  listRecalls: () => apiClient.get(`${base}/recalls`).then((r) => r.data),
  createRecall: (body: Record<string, unknown>) =>
    apiClient.post(`${base}/recalls`, body).then((r) => r.data),
  updateRecall: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`${base}/recalls/${id}`, body).then((r) => r.data),
  listDeviations: () => apiClient.get(`${base}/deviations`).then((r) => r.data),
  createDeviation: (body: Record<string, unknown>) =>
    apiClient.post(`${base}/deviations`, body).then((r) => r.data),
  updateDeviation: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`${base}/deviations/${id}`, body).then((r) => r.data),
  listCapas: () => apiClient.get(`${base}/capas`).then((r) => r.data),
  createCapa: (body: Record<string, unknown>) =>
    apiClient.post(`${base}/capas`, body).then((r) => r.data),
  updateCapa: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`${base}/capas/${id}`, body).then((r) => r.data),
  listChangeControls: () => apiClient.get(`${base}/change-controls`).then((r) => r.data),
  createChangeControl: (body: Record<string, unknown>) =>
    apiClient.post(`${base}/change-controls`, body).then((r) => r.data),
  updateChangeControl: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`${base}/change-controls/${id}`, body).then((r) => r.data),
  approveChangeControl: (
    id: string,
    body?: { password?: string; meaning?: string; totp_code?: string },
  ) => apiClient.post(`${base}/change-controls/${id}/approve`, body || {}).then((r) => r.data),
  audit: (params?: { entity_type?: string; entity_id?: string }) =>
    apiClient.get(`${base}/audit`, { params }).then((r) => r.data),
  getSettings: () => apiClient.get(`${base}/settings`).then((r) => r.data),
  patchSettings: (body: Record<string, unknown>) =>
    apiClient.patch(`${base}/settings`, body).then((r) => r.data),
  listSerials: (params?: { goods_batch_id?: string }) =>
    apiClient.get(`${base}/serials`, { params }).then((r) => r.data),
  createSerial: (body: Record<string, unknown>) =>
    apiClient.post(`${base}/serials`, body).then((r) => r.data),
  commissionSerials: (body: {
    goods_batch_id: string
    quantity: number
    prefix?: string
    level?: string
  }) => apiClient.post(`${base}/serials/commission`, body).then((r) => r.data),
  aggregateSerials: (body: {
    goods_batch_id: string
    parent_serial_number: string
    parent_level?: string
    child_ids: string[]
  }) => apiClient.post(`${base}/serials/aggregate`, body).then((r) => r.data),
  disaggregateSerial: (parentId: string) =>
    apiClient.post(`${base}/serials/disaggregate`, { parent_id: parentId }).then((r) => r.data),
  transitionSerial: (
    id: string,
    body: {
      status: string
      notes?: string
      password?: string
      meaning?: string
      totp_code?: string
    },
  ) => apiClient.post(`${base}/serials/${id}/transition`, body).then((r) => r.data),
  // Stage B: OOS investigation
  openOos: (inspId: string, body?: { notes?: string; assignee?: string }) =>
    apiClient.post(`${base}/inspections/${inspId}/oos`, body || {}).then((r) => r.data),
  closeOos: (inspId: string, body: { root_cause: string; disposition: string; notes?: string }) =>
    apiClient.patch(`${base}/inspections/${inspId}/oos`, body).then((r) => r.data),
  // Stage B: complaint intake
  listComplaints: (params?: { status?: string }) =>
    apiClient.get(`${base}/complaints`, { params }).then((r) => r.data),
  createComplaint: (body: {
    complaint_type?: string
    severity?: string
    title: string
    description?: string
    goods_batch_id?: string
    reported_by?: string
  }) => apiClient.post(`${base}/complaints`, body).then((r) => r.data),
  updateComplaint: (id: string, body: {
    status?: string
    investigation_notes?: string
    disposition?: string
    severity?: string
  }) => apiClient.patch(`${base}/complaints/${id}`, body).then((r) => r.data),
  // Stage B: recall impact export
  exportRecallCsv: (id: string) =>
    apiClient
      .get(`${base}/recalls/${id}/export`, { responseType: 'blob' })
      .then((r) => r.data as Blob),
  exportRecallPdf: (id: string) =>
    apiClient
      .get(`${base}/recalls/${id}/export/pdf`, { responseType: 'blob' })
      .then((r) => r.data as Blob),
  qualifyMeForRelease: () =>
    apiClient.post(`${base}/settings/qualify-me`).then((r) => r.data),
  listExcursions: (params?: { status?: string }) =>
    apiClient.get(`${base}/excursions`, { params }).then((r) => r.data),
  createExcursion: (body: Record<string, unknown>) =>
    apiClient.post(`${base}/excursions`, body).then((r) => r.data),
  importExcursionsCsv: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient.post(`${base}/excursions/import`, fd).then((r) => r.data)
  },
  updateExcursion: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`${base}/excursions/${id}`, body).then((r) => r.data),
  checkWholesaleLicense: (customerId: string) =>
    apiClient.post(`${base}/gdp/check-license`, { customer_id: customerId }).then((r) => r.data),
  listPartners: () => apiClient.get(`${base}/partners`).then((r) => r.data),
  createPartner: (body: Record<string, unknown>) =>
    apiClient.post(`${base}/partners`, body).then((r) => r.data),
  listEpcisEvents: (params?: { goods_batch_id?: string; limit?: number }) =>
    apiClient.get(`${base}/epcis/events`, { params }).then((r) => r.data),
  exportEpcis: (params?: {
    goods_batch_id?: string
    limit?: number
    format?: 'json' | 'xml' | 'lite' | 'csv' | 'xlsx' | 'pdf'
  }) => {
    const format = params?.format || 'json'
    const binary = format === 'xml' || format === 'csv' || format === 'xlsx' || format === 'pdf'
    return apiClient
      .get(`${base}/epcis/export`, {
        params,
        responseType: binary ? 'blob' : 'json',
      })
      .then((r) => r.data)
  },
  dscsaVerify: (body: Record<string, unknown>) =>
    apiClient.post(`${base}/dscsa/verify`, body).then((r) => r.data),
  fmdDecommission: (body: {
    serial_id: string
    reason?: string
    password?: string
    meaning?: string
    totp_code?: string
  }) => apiClient.post(`${base}/fmd/decommission`, body).then((r) => r.data),

  // ── Batch number models ──────────────────────────────────────────────────
  listModels: () =>
    apiClient.get(`${base}/batch-number-models`).then((r) => r.data),
  createModel: (body: {
    code: string
    label: string
    pattern: string
    prefix?: string
    pad_width?: number
    reset_period?: string
    scope?: string
    applies_to?: string
    is_default?: boolean
    is_active?: boolean
  }) => apiClient.post(`${base}/batch-number-models`, body).then((r) => r.data),
  updateModel: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`${base}/batch-number-models/${id}`, body).then((r) => r.data),
  deleteModel: (id: string) =>
    apiClient.delete(`${base}/batch-number-models/${id}`),
  previewPattern: (body: { pattern: string; prefix?: string; pad_width?: number }) =>
    apiClient.post(`${base}/batch-number-models/preview`, body).then((r) => r.data),

  // ── Per-org Track & Trace region overrides ──────────────────────────────
  listOrgRegions: () =>
    apiClient.get(`${base}/org-regions`).then((r) => r.data),
  upsertOrgRegion: (body: {
    store_id?: string | null
    plant_id?: string | null
    track_trace_region: string
  }) => apiClient.put(`${base}/org-regions`, body).then((r) => r.data),
  deleteOrgRegion: (id: string) =>
    apiClient.delete(`${base}/org-regions/${id}`),

  // ── Scoped approval rules ────────────────────────────────────────────────
  listApprovalRules: (params?: { action?: string; is_active?: boolean }) =>
    apiClient.get(`${base}/approval-rules`, { params }).then((r) => r.data),
  createApprovalRule: (body: Record<string, unknown>) =>
    apiClient.post(`${base}/approval-rules`, body).then((r) => r.data),
  updateApprovalRule: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`${base}/approval-rules/${id}`, body).then((r) => r.data),
  deactivateApprovalRule: (id: string) =>
    apiClient.delete(`${base}/approval-rules/${id}`),
  resolveApprovalPolicy: (params: {
    action: string
    product_id?: string
    plant_id?: string
    store_id?: string
  }) => apiClient.get(`${base}/approval-rules/resolve`, { params }).then((r) => r.data),
  getScopeMatrix: () =>
    apiClient.get(`${base}/approval-rules/scope-matrix`).then((r) => r.data),

  // ── Signer groups ────────────────────────────────────────────────────────
  listSignerGroups: () =>
    apiClient.get(`${base}/signer-groups`).then((r) => r.data),
  createSignerGroup: (body: { code: string; name: string; description?: string; is_active?: boolean }) =>
    apiClient.post(`${base}/signer-groups`, body).then((r) => r.data),
  updateSignerGroup: (id: string, body: Record<string, unknown>) =>
    apiClient.patch(`${base}/signer-groups/${id}`, body).then((r) => r.data),
  addSignerGroupMember: (groupId: string, vendorUserId: string) =>
    apiClient
      .post(`${base}/signer-groups/${groupId}/members`, null, {
        params: { vendor_user_id: vendorUserId },
      })
      .then((r) => r.data),
  removeSignerGroupMember: (groupId: string, vendorUserId: string) =>
    apiClient.delete(`${base}/signer-groups/${groupId}/members/${vendorUserId}`),

  // ── Product enrollment ───────────────────────────────────────────────────
  enrollProducts: (productIds: string[]) =>
    apiClient.post(`${base}/products/enroll`, { product_ids: productIds }).then((r) => r.data),
  unenrollProducts: (productIds: string[]) =>
    apiClient.post(`${base}/products/unenroll`, { product_ids: productIds }).then((r) => r.data),
}
