export const ADMIN_EMBED_REQUEST_AUTH = 'kiterp:admin:embed-request-auth'
export const ADMIN_EMBED_AUTH_RESPONSE = 'kiterp:admin:embed-auth'

export type AdminEmbedAuthRequest = { type: typeof ADMIN_EMBED_REQUEST_AUTH }
export type AdminEmbedAuthResponse = {
  type: typeof ADMIN_EMBED_AUTH_RESPONSE
  accessToken: string
  refreshToken: string
}
