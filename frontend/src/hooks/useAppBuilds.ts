import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { appBuildApi, type AppConfig, type AppBuild } from '@/api/appBuild.api'

export const appBuildKeys = {
  all: ['app-builds'] as const,
  config: (vendorId: string) => [...appBuildKeys.all, 'config', vendorId] as const,
  builds: (vendorId?: string) => [...appBuildKeys.all, 'builds', vendorId] as const,
  build: (buildId: string) => [...appBuildKeys.all, 'build', buildId] as const,
}

const ACTIVE_BUILD_STATUSES = new Set(['pending', 'config_generated', 'building'])

function hasActiveBuild(items?: AppBuild[]): boolean {
  return Boolean(items?.some((b) => ACTIVE_BUILD_STATUSES.has(b.status)))
}

export function useAppConfig(vendorId: string) {
  return useQuery({
    queryKey: appBuildKeys.config(vendorId),
    queryFn: () => appBuildApi.getAppConfig(vendorId),
    enabled: !!vendorId,
  })
}

export function useUpdateAppConfig(vendorId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AppConfig) => appBuildApi.updateAppConfig(vendorId, data),
    onSuccess: (data) => {
      queryClient.setQueryData(appBuildKeys.config(vendorId), data)
      toast.success(
        data.files?.files_ready
          ? 'Configuration saved — vendor app files written to disk'
          : 'App configuration updated',
      )
    },
    onError: () => {
      toast.error('Failed to update app configuration')
    },
  })
}

export function useUploadAppIcon(vendorId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (file: File) => appBuildApi.uploadAppIcon(vendorId, file),
    onSuccess: (data) => {
      queryClient.setQueryData(appBuildKeys.config(vendorId), data)
      toast.success(
        data.files?.icon_ready
          ? 'Icon uploaded and written to mobile/vendors'
          : 'Icon uploaded',
      )
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to upload icon'
      toast.error(typeof message === 'string' ? message : 'Failed to upload icon')
    },
  })
}

export function useTriggerBuild(vendorId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (platform: string = 'all') => appBuildApi.triggerBuild(vendorId, platform),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appBuildKeys.builds(vendorId) })
      toast.success('Build queued — start the build runner if it is not already running.')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to trigger build'
      toast.error(message)
    },
  })
}

export function useDeleteBuild(vendorId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (buildId: string) => appBuildApi.deleteBuild(buildId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appBuildKeys.builds(vendorId) })
      toast.success('Build removed from history')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to delete build'
      toast.error(typeof message === 'string' ? message : 'Failed to delete build')
    },
  })
}

export function usePauseBuild(vendorId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (buildId: string) => appBuildApi.pauseBuild(buildId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appBuildKeys.builds(vendorId) })
      toast.success('Build paused')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to pause build'
      toast.error(typeof message === 'string' ? message : 'Failed to pause build')
    },
  })
}

export function useResumeBuild(vendorId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (buildId: string) => appBuildApi.resumeBuild(buildId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appBuildKeys.builds(vendorId) })
      toast.success('Build resumed — waiting for runner')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to resume build'
      toast.error(typeof message === 'string' ? message : 'Failed to resume build')
    },
  })
}

export function useVendorBuilds(vendorId: string) {
  return useQuery({
    queryKey: appBuildKeys.builds(vendorId),
    queryFn: () => appBuildApi.listVendorBuilds(vendorId),
    enabled: !!vendorId,
    refetchInterval: (query) =>
      hasActiveBuild(query.state.data?.items) ? 3000 : 15000,
  })
}

export function useAllBuilds() {
  return useQuery({
    queryKey: appBuildKeys.builds(),
    queryFn: () => appBuildApi.listBuilds(),
    refetchInterval: (query) =>
      hasActiveBuild(query.state.data?.items) ? 3000 : 15000,
  })
}
