import apiClient from './client'

export type SchemaModelRecord = {
  table: string
  model: string
  domain: string
  column_count: number
}

export type TableDataCellMatch = {
  table: string
  column: string
  value: string
  domain?: string
}

export type TableDataFindHit = {
  table: string
  domain?: string
  matched_columns: string[]
  row_count: number
  rows: Record<string, unknown>[]
  cell_matches?: TableDataCellMatch[]
}

export type TableDataFindResult = {
  query: string
  search_mode: 'uuid' | 'text'
  hits: TableDataFindHit[]
  matches: TableDataCellMatch[]
  match_count: number
  hit_count: number
  tables_scanned: number
}

export type TableDataRows = {
  table: string
  domain?: string
  columns: string[]
  page: number
  page_size: number
  total: number
  rows: Record<string, unknown>[]
}

export type SchemaCatalogResponse = {
  models: SchemaModelRecord[]
  model_count: number
  table_count: number
}

export const schemaApi = {
  listModels: async () => {
    const r = await apiClient.get('/admin/schema/models')
    return r.data as SchemaCatalogResponse
  },

  findTableDataValue: async (q: string) => {
    const r = await apiClient.get('/admin/schema/table-data/find', { params: { q } })
    return r.data as TableDataFindResult
  },

  browseTableData: async (
    table: string,
    params?: { q?: string; page?: number; page_size?: number },
  ) => {
    const r = await apiClient.get(`/admin/schema/table-data/${encodeURIComponent(table)}`, {
      params,
    })
    return r.data as TableDataRows
  },
}
