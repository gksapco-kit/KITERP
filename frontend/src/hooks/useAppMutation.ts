import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import type { AppMutationMeta } from '@/lib/queryClient'

type AppMutationOptions<TData, TError, TVariables, TContext> = UseMutationOptions<
  TData,
  TError,
  TVariables,
  TContext
> & {
  skipAutoRefresh?: boolean
  invalidateKeys?: AppMutationMeta['invalidateKeys']
}

/** useMutation with auto-refresh metadata for the global mutation cache. */
export function useAppMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(options: AppMutationOptions<TData, TError, TVariables, TContext>) {
  const { skipAutoRefresh, invalidateKeys, meta, ...rest } = options
  return useMutation({
    ...rest,
    meta: {
      ...(meta as AppMutationMeta | undefined),
      skipAutoRefresh: skipAutoRefresh ?? (meta as AppMutationMeta | undefined)?.skipAutoRefresh,
      invalidateKeys: [
        ...((meta as AppMutationMeta | undefined)?.invalidateKeys ?? []),
        ...(invalidateKeys ?? []),
      ],
    },
  })
}
