const DB_NAME = 'kiterp-website-builder'
const DB_VERSION = 1
const STORE = 'kv'

/** Keys previously stored in localStorage; migrated into IndexedDB on first load. */
const LEGACY_LOCAL_KEYS = [
  'website-builder-published-site',
  'website-builder-saved-templates',
  'website-builder-saved-templates-backup',
] as const

const cache = new Map<string, string>()
const pendingWrites = new Map<string, string>()
const pendingDeletes = new Set<string>()

let db: IDBDatabase | null = null
let ready = false
let flushTimer: ReturnType<typeof setTimeout> | null = null
let initPromise: Promise<void> | null = null

export class StorageQuotaError extends Error {
  readonly code = 'quota' as const
  constructor(message: string) {
    super(message)
    this.name = 'StorageQuotaError'
  }
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014)
  )
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
  })
}

function idbLoadCache(database: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.openCursor()
    req.onerror = () => reject(req.error ?? new Error('IndexedDB cursor failed'))
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        resolve()
        return
      }
      cache.set(String(cursor.key), String(cursor.value))
      cursor.continue()
    }
  })
}

function idbPut(database: IDBDatabase, key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).put(value, key)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB write failed'))
    req.onsuccess = () => resolve()
  })
}

function idbDelete(database: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(key)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB delete failed'))
    req.onsuccess = () => resolve()
  })
}

async function migrateLegacyLocalStorage(): Promise<void> {
  if (!db) return
  for (const key of LEGACY_LOCAL_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      if (!cache.has(key)) {
        cache.set(key, raw)
        await idbPut(db, key, raw)
      }
      localStorage.removeItem(key)
    } catch (err) {
      if (isQuotaError(err)) {
        /* keep legacy copy if IDB migration fails */
      }
    }
  }
}

async function flushPending(): Promise<void> {
  if (!db) return
  const deletes = [...pendingDeletes]
  const writes = [...pendingWrites.entries()]
  pendingDeletes.clear()
  pendingWrites.clear()

  try {
    for (const key of deletes) {
      await idbDelete(db, key)
    }
    for (const [key, value] of writes) {
      await idbPut(db, key, value)
    }
  } catch (err) {
    for (const key of deletes) pendingDeletes.add(key)
    for (const [key, value] of writes) pendingWrites.set(key, value)
    if (isQuotaError(err)) {
      throw new StorageQuotaError(
        'Browser storage is full. Export your templates, delete old saved templates, then try again.',
      )
    }
    throw err
  }
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushPending().catch((err) => {
      console.error('[website-builder] storage flush failed:', err)
    })
  }, 50)
}

/** Load IndexedDB + migrate legacy localStorage. Call once before rendering the app. */
export function initLargeStorage(): Promise<void> {
  if (ready) return Promise.resolve()
  if (initPromise) return initPromise

  initPromise = (async () => {
    if (typeof indexedDB === 'undefined') {
      ready = true
      for (const key of LEGACY_LOCAL_KEYS) {
        const raw = localStorage.getItem(key)
        if (raw) cache.set(key, raw)
      }
      return
    }

    db = await openDb()
    await idbLoadCache(db)
    await migrateLegacyLocalStorage()
    ready = true
    if (pendingWrites.size > 0 || pendingDeletes.size > 0) {
      await flushPending()
    }
  })()

  return initPromise
}

export function isLargeStorageReady(): boolean {
  return ready
}

export function storageGet(key: string): string | null {
  return cache.get(key) ?? null
}

export function storageSet(key: string, value: string): void {
  cache.set(key, value)
  pendingWrites.set(key, value)
  pendingDeletes.delete(key)

  if (!ready || !db) {
    try {
      localStorage.setItem(key, value)
    } catch (err) {
      if (isQuotaError(err)) {
        throw new StorageQuotaError(
          'Browser storage is full. Export your templates, delete old saved templates, then try again.',
        )
      }
      throw err
    }
    return
  }

  scheduleFlush()
}

export function storageRemove(key: string): void {
  cache.delete(key)
  pendingWrites.delete(key)
  pendingDeletes.add(key)

  if (!ready || !db) {
    localStorage.removeItem(key)
    return
  }

  scheduleFlush()
}

/** Persist pending writes immediately (e.g. before opening live preview). */
export async function storageFlush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (!ready || !db) return
  await flushPending()
}
