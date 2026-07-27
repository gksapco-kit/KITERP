export const ADMIN_EMBED_REQUEST_AUTH = 'kiterp:admin:embed-request-auth'
export const ADMIN_EMBED_AUTH_RESPONSE = 'kiterp:admin:embed-auth'
/** Soft-navigate the vendor HR iframe without a full document reload. */
export const ADMIN_EMBED_NAVIGATE = 'kiterp:admin:embed-navigate'
/** Vendor iframe signals it is ready for soft navigation. */
export const ADMIN_EMBED_READY = 'kiterp:admin:embed-ready'
/** Vendor iframe confirms a soft navigation completed. */
export const ADMIN_EMBED_NAVIGATED = 'kiterp:admin:embed-navigated'

export type AdminEmbedAuthRequest = { type: typeof ADMIN_EMBED_REQUEST_AUTH }
export type AdminEmbedAuthResponse = {
  type: typeof ADMIN_EMBED_AUTH_RESPONSE
  accessToken: string
  refreshToken: string
}
export type AdminEmbedNavigateMessage = {
  type: typeof ADMIN_EMBED_NAVIGATE
  path: string
}
export type AdminEmbedReadyMessage = {
  type: typeof ADMIN_EMBED_READY
}
export type AdminEmbedNavigatedMessage = {
  type: typeof ADMIN_EMBED_NAVIGATED
  path: string
}
