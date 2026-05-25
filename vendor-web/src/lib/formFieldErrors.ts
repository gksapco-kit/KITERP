/**
 * Turn Zod / react-hook-form default messages into short, field-specific copy.
 */
export function formatFormFieldError(message: string, fieldLabel?: string): string {
  const label = fieldLabel?.replace(/\s*\*+\s*$/, '').trim() || 'This field'
  const m = message.trim()

  let match = m.match(/^String must contain at most (\d+) character/i)
  if (match) return `${label} cannot exceed ${match[1]} characters`

  match = m.match(/^String must contain at least (\d+) character/i)
  if (match) return `${label} must be at least ${match[1]} characters`

  match = m.match(/^Number must be (less than or equal to|greater than or equal to|less than|greater than) (\d+)/i)
  if (match) {
    const op = match[1].toLowerCase()
    const n = match[2]
    if (op.includes('less than or equal')) return `${label} must be ${n} or less`
    if (op.includes('greater than or equal')) return `${label} must be ${n} or more`
    if (op === 'less than') return `${label} must be less than ${n}`
    return `${label} must be greater than ${n}`
  }

  match = m.match(/^Expected (string|number|boolean)/i)
  if (match) return `Enter a valid ${match[1]} for ${label.toLowerCase()}`

  if (/^Invalid/i.test(m)) return m
  if (/^Required/i.test(m)) return `${label} is required`

  return m
}
