import apiClient from './client'

export interface StockAdjustment {
  product_id: string
  variant_id?: string
  movement_type: string
  quantity: number
  reason?: string
}

export interface BulkStockUpdate {
  product_id: string
  variant_id?: string
  new_quantity: number
  reason?: string
}

export interface InventoryMovement {
  id: string
  vendor_id: string
  product_id: string
  variant_id?: string
  movement_type: string
  quantity: number
  quantity_before: number
  quantity_after: number
  reason?: string
  reference_type?: string
  reference_id?: string
  performed_by?: string
  created_at: string
}

export interface StockSummary {
  product_id: string
  product_name: string
  sku?: string
  current_quantity: number
  low_stock_threshold: number
  is_low_stock: boolean
  total_stock_in: number
  total_stock_out: number
  last_movement_at?: string
}

export interface InventoryHistoryResponse {
  items: InventoryMovement[]
  total: number
  page: number
  size: number
  pages: number
}

export interface StockSummaryResponse {
  items: StockSummary[]
  total: number
  low_stock_count: number
}

export interface LowStockAlert {
  product_id: string
  product_name: string
  sku?: string
  current_quantity: number
  low_stock_threshold: number
  category?: string
}

export const inventoryApi = {
  stockIn: async (data: StockAdjustment): Promise<InventoryMovement> => {
    const response = await apiClient.post('/vendors/me/inventory/stock-in', data)
    return response.data
  },

  stockOut: async (data: StockAdjustment): Promise<InventoryMovement> => {
    const response = await apiClient.post('/vendors/me/inventory/stock-out', data)
    return response.data
  },

  adjust: async (data: BulkStockUpdate): Promise<InventoryMovement> => {
    const response = await apiClient.post('/vendors/me/inventory/adjust', data)
    return response.data
  },

  getHistory: async (params?: {
    product_id?: string
    movement_type?: string
    page?: number
    size?: number
  }): Promise<InventoryHistoryResponse> => {
    const response = await apiClient.get('/vendors/me/inventory/history', { params })
    return response.data
  },

  getSummary: async (): Promise<StockSummaryResponse> => {
    const response = await apiClient.get('/vendors/me/inventory/summary')
    return response.data
  },

  getLowStock: async (): Promise<{ items: LowStockAlert[]; total: number }> => {
    const response = await apiClient.get('/vendors/me/inventory/low-stock')
    return response.data
  },
}
