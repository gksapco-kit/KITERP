export const ADMIN_EMBED_REQUEST_AUTH = 'kiterp:admin:embed-request-auth'
export const ADMIN_EMBED_AUTH_RESPONSE = 'kiterp:admin:embed-auth'

/** Vendor Careers tab → parent admin shows native Careers inbox (no nested iframe). */
export const ADMIN_EMBED_SHOW_CAREERS = 'kiterp:admin:embed-show-careers'
export const ADMIN_EMBED_HIDE_CAREERS = 'kiterp:admin:embed-hide-careers'

export type AdminEmbedAuthRequest = { type: typeof ADMIN_EMBED_REQUEST_AUTH }
export type AdminEmbedAuthResponse = {
  type: typeof ADMIN_EMBED_AUTH_RESPONSE
  accessToken: string
  refreshToken: string
}
