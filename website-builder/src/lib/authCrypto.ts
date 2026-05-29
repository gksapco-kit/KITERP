function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
}

export async function generateSalt(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return toBase64(bytes)
}

export async function hashPassword(password: string, saltBase64: string): Promise<string> {
  const encoder = new TextEncoder()
  const saltBytes = fromBase64(saltBase64)
  const salt = new Uint8Array(saltBytes)
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 120_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return toBase64(new Uint8Array(derived))
}

export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return toBase64(bytes)
}
