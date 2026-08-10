import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { appBuildApi, type AppConfig } from '@/api/appBuild.api'

export const appBuildKeys = {
  all: ['app-builds'] as const,
  config: (vendorId: string) => [...appBuildKeys.all, 'config', vendorId] as const,
  builds: (vendorId?: string) => [...appBuildKeys.all, 'builds', vendorId] as const,
  build: (buildId: string) => [...appBuildKeys.all, 'build', buildId] as const,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appBuildKeys.config(vendorId) })
      toast.success('App configuration updated')
    },
    onError: () => {
      toast.error('Failed to update app configuration')
    },
  })
}

export function useTriggerBuild(vendorId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (platform: string = 'all') => appBuildApi.triggerBuild(vendorId, platform),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appBuildKeys.builds(vendorId) })
      toast.success('Build triggered! The build runner will pick it up shortly.')
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to trigger build'
      toast.error(message)
    },
  })
}

export function useVendorBuilds(vendorId: string) {
  return useQuery({
    queryKey: appBuildKeys.builds(vendorId),
    queryFn: () => appBuildApi.listVendorBuilds(vendorId),
    enabled: !!vendorId,
    refetchInterval: 15000,
  })
}

export function useAllBuilds() {
  return useQuery({
    queryKey: appBuildKeys.builds(),
    queryFn: () => appBuildApi.listBuilds(),
    refetchInterval: 15000,
  })
}
