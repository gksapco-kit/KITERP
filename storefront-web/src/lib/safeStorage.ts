/**
 * Safe Web Storage access.
 *
 * Some browsers throw SecurityError when reading `window.localStorage` /
 * `sessionStorage` (blocked cookies, private mode, sandboxed iframes).
 * All storefront persistence should go through these helpers so the app
 * degrades to in-memory storage instead of crashing.
 */

import type { StateStorage } from 'zustand/middleware'

const memory = new Map<string, string>()

function probe(storage: Storage): boolean {
  try {
    const key = '__kiterp_storage_probe__'
    storage.setItem(key, '1')
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

let localOk: boolean | null = null
let sessionOk: boolean | null = null

function canUseLocal(): boolean {
  if (typeof window === 'undefined') return false
  if (localOk != null) return localOk
  try {
    localOk = probe(window.localStorage)
  } catch {
    localOk = false
  }
  return localOk
}

function canUseSession(): boolean {
  if (typeof window === 'undefined') return false
  if (sessionOk != null) return sessionOk
  try {
    sessionOk = probe(window.sessionStorage)
  } catch {
    sessionOk = false
  }
  return sessionOk
}

export function safeLocalGet(key: string): string | null {
  if (!canUseLocal()) return memory.get(key) ?? null
  try {
    return window.localStorage.getItem(key)
  } catch {
    localOk = false
    return memory.get(key) ?? null
  }
}

export function safeLocalSet(key: string, value: string): void {
  if (!canUseLocal()) {
    memory.set(key, value)
    return
  }
  try {
    window.localStorage.setItem(key, value)
  } catch {
    localOk = false
    memory.set(key, value)
  }
}

export function safeLocalRemove(key: string): void {
  memory.delete(key)
  if (!canUseLocal()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    localOk = false
  }
}

export function safeSessionGet(key: string): string | null {
  if (!canUseSession()) return memory.get(`ss:${key}`) ?? null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    sessionOk = false
    return memory.get(`ss:${key}`) ?? null
  }
}

export function safeSessionSet(key: string, value: string): void {
  if (!canUseSession()) {
    memory.set(`ss:${key}`, value)
    return
  }
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    sessionOk = false
    memory.set(`ss:${key}`, value)
  }
}

export function safeSessionRemove(key: string): void {
  memory.delete(`ss:${key}`)
  if (!canUseSession()) return
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    sessionOk = false
  }
}

/** Zustand StateStorage that never throws SecurityError. */
export const safeLocalStateStorage: StateStorage = {
  getItem: (name) => safeLocalGet(name),
  setItem: (name, value) => safeLocalSet(name, value),
  removeItem: (name) => safeLocalRemove(name),
}
