/**
 * Base URL for storefront → FastAPI (`/api/v1/...`).
 * In Vite dev, default to same-origin `/api/v1` so requests use the dev-server proxy
 * (avoids CORS when the UI is on localhost:3002 and the API is on :8000).
 */
export function getStorefrontApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).replace(/\/$/, '')
  }
  if (import.meta.env.DEV) {
    return '/api/v1'
  }
  return 'http://127.0.0.1:8000/api/v1'
}
