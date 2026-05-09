/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** Default vendor slug for /local/employee-hr links (e.g. `test` from setup_vendor.py) */
  readonly VITE_DEV_VENDOR_SLUG?: string
  readonly VITE_VENDOR_URL?: string
  readonly VITE_ADMIN_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
