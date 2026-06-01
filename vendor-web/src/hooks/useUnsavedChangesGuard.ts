import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, type BlockerFunction } from 'react-router-dom'

type Options = {
  when: boolean
  onSave: () => Promise<boolean>
  onDiscard: () => void
}

export function useUnsavedChangesGuard({ when, onSave, onDiscard }: Options) {
  const whenRef = useRef(when)
  whenRef.current = when

  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)
  const onSaveRef = useRef(onSave)
  const onDiscardRef = useRef(onDiscard)
  onSaveRef.current = onSave
  onDiscardRef.current = onDiscard

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      whenRef.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search ||
        currentLocation.hash !== nextLocation.hash),
    [],
  )

  const blocker = useBlocker(shouldBlock)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    setDialogOpen(true)
    pendingActionRef.current = () => blocker.proceed?.()
  }, [blocker.state, blocker])

  useEffect(() => {
    if (!when) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [when])

  const closeDialog = useCallback(() => {
    setDialogOpen(false)
    pendingActionRef.current = null
    if (blocker.state === 'blocked') blocker.reset()
  }, [blocker])

  const handleCancel = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  const handleDiscard = useCallback(() => {
    onDiscardRef.current()
    setDialogOpen(false)
    const action = pendingActionRef.current
    pendingActionRef.current = null
    if (blocker.state === 'blocked') blocker.proceed?.()
    else action?.()
  }, [blocker])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const ok = await onSaveRef.current()
      if (!ok) return
      setDialogOpen(false)
      const action = pendingActionRef.current
      pendingActionRef.current = null
      if (blocker.state === 'blocked') blocker.proceed?.()
      else action?.()
    } finally {
      setSaving(false)
    }
  }, [blocker])

  /** Run an in-page action (section switch, scope change) after confirming if dirty. */
  const confirmIfDirty = useCallback((proceed: () => void) => {
    if (!whenRef.current) {
      proceed()
      return
    }
    pendingActionRef.current = proceed
    setDialogOpen(true)
  }, [])

  return {
    dialogOpen,
    saving,
    handleCancel,
    handleDiscard,
    handleSave,
    confirmIfDirty,
  }
}
