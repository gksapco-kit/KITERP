/** Cap list `size` so FastAPI Query(le=…) validation does not 422. */
export function clampPageSize(
  params: Record<string, unknown> | undefined,
  max = 100,
): Record<string, unknown> | undefined {
  if (!params) return params
  const raw = params.size
  const size = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(size) || size <= max) return params
  return { ...params, size: max }
}
