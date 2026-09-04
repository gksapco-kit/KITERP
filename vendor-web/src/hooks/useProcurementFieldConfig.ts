import { useCallback, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FieldStatus, DocType } from '@/lib/procurementFieldCatalog'
import { getFieldsForDocType } from '@/lib/procurementFieldCatalog'
import { vendorApi } from '@/api/vendor'

type FieldConfigs = Record<string, FieldStatus>
type AllConfigs = Record<DocType, FieldConfigs>

const DEFAULT_CONFIG: AllConfigs = {
  PR: {},
  PO: {},
  WF_PR: {},
  WF_PO: {},
  WF_INVOICE: {},
}

const STORAGE_KEY = 'kiterp_procurement_field_config'

function localLoad(): AllConfigs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AllConfigs>
      return { ...DEFAULT_CONFIG, ...parsed }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG }
}

function localSave(cfg: AllConfigs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)) } catch { /* ignore */ }
}

async function fetchConfig(): Promise<AllConfigs> {
  try {
    const res = await vendorApi.getFieldConfig()
    const cfg = { ...DEFAULT_CONFIG, ...(res.config as Partial<AllConfigs>) }
    localSave(cfg)
    return cfg
  } catch {
    return localLoad()
  }
}

export function useProcurementFieldConfig() {
  const qc = useQueryClient()

  const { data: remoteConfigs } = useQuery<AllConfigs>({
    queryKey: ['procurementFieldConfig'],
    queryFn: fetchConfig,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })

  const [localConfigs, setLocalConfigs] = useState<AllConfigs | null>(null)

  const configs: AllConfigs = localConfigs ?? remoteConfigs ?? localLoad()

  const dirty = localConfigs !== null

  const saveMut = useMutation({
    mutationFn: (cfg: AllConfigs) =>
      vendorApi.updateFieldConfig(cfg as Record<string, Record<string, string>>),
    onSuccess: (_data, vars) => {
      localSave(vars)
      qc.setQueryData(['procurementFieldConfig'], vars)
      setLocalConfigs(null)
      toast.success('Field configuration saved')
    },
    onError: () => {
      toast.error('Could not save field configuration')
    },
  })

  const getStatus = useCallback(
    (docType: DocType, fieldKey: string): FieldStatus => {
      const overridden = configs[docType]?.[fieldKey]
      if (overridden) return overridden as FieldStatus
      const fields = getFieldsForDocType(docType)
      return fields.find(f => f.key === fieldKey)?.defaultStatus ?? 'optional'
    },
    [configs],
  )

  const setStatus = useCallback((docType: DocType, fieldKey: string, fieldStatus: FieldStatus) => {
    setLocalConfigs(prev => {
      const base = prev ?? configs
      return {
        ...base,
        [docType]: { ...(base[docType] ?? {}), [fieldKey]: fieldStatus },
      }
    })
  }, [configs])

  const save = useCallback(() => {
    saveMut.mutate(configs)
  }, [configs, saveMut])

  const resetDocType = useCallback((docType: DocType) => {
    setLocalConfigs(prev => {
      const base = prev ?? configs
      return { ...base, [docType]: {} }
    })
  }, [configs])

  const resetAll = useCallback(() => {
    setLocalConfigs({ ...DEFAULT_CONFIG })
  }, [])

  const overrideCount = useCallback(
    (docType: DocType) => Object.keys(configs[docType] ?? {}).length,
    [configs],
  )

  return {
    configs,
    getStatus,
    setStatus,
    save,
    resetDocType,
    resetAll,
    dirty,
    saved: saveMut.isSuccess && !dirty,
    overrideCount,
    isSaving: saveMut.isPending,
  }
}
