import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import type { SettingsSectionKey } from './settingsDirtyHelpers'

type SettingsDirtyContextValue = {
  hasDirty: boolean
  hasDirtyRef: MutableRefObject<boolean>
  setSectionDirty: (key: SettingsSectionKey, dirty: boolean) => void
  formResetKey: number
  discardAll: () => void
}

const SettingsDirtyContext = createContext<SettingsDirtyContextValue | null>(null)

export function SettingsDirtyProvider({ children }: { children: ReactNode }) {
  const dirtySectionsRef = useRef(new Set<SettingsSectionKey>())
  const [hasDirty, setHasDirty] = useState(false)
  const hasDirtyRef = useRef(false)
  const [formResetKey, setFormResetKey] = useState(0)

  const syncHasDirty = useCallback(() => {
    const next = dirtySectionsRef.current.size > 0
    hasDirtyRef.current = next
    setHasDirty(next)
  }, [])

  const setSectionDirty = useCallback((key: SettingsSectionKey, dirty: boolean) => {
    const next = new Set(dirtySectionsRef.current)
    if (dirty) next.add(key)
    else next.delete(key)
    dirtySectionsRef.current = next
    syncHasDirty()
  }, [syncHasDirty])

  const discardAll = useCallback(() => {
    dirtySectionsRef.current = new Set()
    syncHasDirty()
    setFormResetKey((k) => k + 1)
  }, [syncHasDirty])

  const value = useMemo(
    () => ({ hasDirty, hasDirtyRef, setSectionDirty, formResetKey, discardAll }),
    [hasDirty, formResetKey, setSectionDirty, discardAll],
  )

  return <SettingsDirtyContext.Provider value={value}>{children}</SettingsDirtyContext.Provider>
}

export function useSettingsDirtyContext() {
  const ctx = useContext(SettingsDirtyContext)
  if (!ctx) throw new Error('useSettingsDirtyContext must be used within SettingsDirtyProvider')
  return ctx
}

export function useSettingsSectionDirty(key: SettingsSectionKey, isDirty: boolean) {
  const { setSectionDirty } = useSettingsDirtyContext()
  useEffect(() => {
    setSectionDirty(key, isDirty)
    return () => setSectionDirty(key, false)
  }, [key, isDirty, setSectionDirty])
}
