/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_API_BASE?: string
  readonly VITE_BACKEND_URL?: string
  /** Scopes vendor dashboard login on localhost when one email exists on multiple User rows */
  readonly VITE_VENDOR_LOGIN_SLUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
