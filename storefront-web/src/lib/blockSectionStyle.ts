/** Per-section shadow from builder "Block Shadow" control. */
export function resolveBlockBoxShadow(props: Record<string, unknown>): string | undefined {
  const raw = props.block_shadow
  if (typeof raw !== 'string' || !raw || raw === 'none') return undefined
  return raw
}

export function blockShadowIsActive(props: Record<string, unknown>): boolean {
  return resolveBlockBoxShadow(props) !== undefined
}
