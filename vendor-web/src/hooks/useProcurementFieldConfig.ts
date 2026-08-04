import { useState, useCallback } from 'react'
import type { FieldStatus, DocType } from '@/lib/procurementFieldCatalog'
import { getFieldsForDocType } from '@/lib/procurementFieldCatalog'

type FieldConfigs = Record<string, FieldStatus>
type AllConfigs = Record<DocType, FieldConfigs>

const STORAGE_KEY = 'kiterp_procurement_field_config'

function loadFromStorage(): AllConfigs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AllConfigs
  } catch {
    // ignore parse errors
  }
  return { PR: {}, PO: {} }
}

function saveToStorage(config: AllConfigs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function useProcurementFieldConfig() {
  const [configs, setConfigs] = useState<AllConfigs>(loadFromStorage)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  const getStatus = useCallback(
    (docType: DocType, fieldKey: string): FieldStatus => {
      const overridden = configs[docType][fieldKey]
      if (overridden) return overridden
      const fields = getFieldsForDocType(docType)
      return fields.find(f => f.key === fieldKey)?.defaultStatus ?? 'optional'
    },
    [configs],
  )

  const setStatus = useCallback((docType: DocType, fieldKey: string, status: FieldStatus) => {
    setConfigs(prev => ({
      ...prev,
      [docType]: { ...prev[docType], [fieldKey]: status },
    }))
    setDirty(true)
    setSaved(false)
  }, [])

  const save = useCallback(() => {
    saveToStorage(configs)
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }, [configs])

  const resetDocType = useCallback((docType: DocType) => {
    setConfigs(prev => ({ ...prev, [docType]: {} }))
    setDirty(true)
    setSaved(false)
  }, [])

  const resetAll = useCallback(() => {
    setConfigs({ PR: {}, PO: {} })
    setDirty(true)
    setSaved(false)
  }, [])

  /** Returns count of overridden fields for a docType */
  const overrideCount = useCallback(
    (docType: DocType) => Object.keys(configs[docType] ?? {}).length,
    [configs],
  )

  return { configs, getStatus, setStatus, save, resetDocType, resetAll, dirty, saved, overrideCount }
}
