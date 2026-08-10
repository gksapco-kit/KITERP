import { useState, useMemo } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useAdminVendor } from '@/hooks/useAdmin'
import {
  useAppConfig,
  useUpdateAppConfig,
  useTriggerBuild,
  useVendorBuilds,
} from '@/hooks/useAppBuilds'
import type { AppConfig } from '@/api/appBuild.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  Smartphone,
  Palette,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Hammer,
  Upload,
  Package,
} from 'lucide-react'
import { TableToolbar } from '@/components/table/TableToolbar'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'
import { processRows, type SortDir } from '@/lib/tableList'

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-yellow-600 bg-yellow-50', label: 'Pending' },
  config_generated: { icon: Package, color: 'text-blue-600 bg-blue-50', label: 'Config Ready' },
  building: { icon: Hammer, color: 'text-indigo-600 bg-indigo-50', label: 'Building' },
  built: { icon: CheckCircle2, color: 'text-green-600 bg-green-50', label: 'Built' },
  submitted: { icon: Upload, color: 'text-primary bg-accent', label: 'Submitted' },
  published: { icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50', label: 'Published' },
  failed: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Failed' },
}

export default function VendorAppBuilds() {
  const { user } = useAuthStore()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const vendorId = id ?? ''

  const { data: vendor, isLoading: vendorLoading } = useAdminVendor(vendorId)
  const { data: appConfig, isLoading: configLoading } = useAppConfig(vendorId)
  const { data: buildsData, isLoading: buildsLoading } = useVendorBuilds(vendorId)
  const updateConfig = useUpdateAppConfig(vendorId)
  const triggerBuild = useTriggerBuild(vendorId)

  const [editMode, setEditMode] = useState(false)
  const [configForm, setConfigForm] = useState<AppConfig>({})
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const buildsRaw = buildsData?.items || []

  const builds = useMemo(
    () =>
      processRows(
        buildsRaw,
        '',
        () => [],
        sortKey,
        sortDir,
        {
          status: (r) => r.status,
          platform: (r) => r.platform,
          created_at: (r) => r.created_at ?? '',
          built_at: (r) => r.built_at ?? '',
        },
      ),
    [buildsRaw, sortKey, sortDir],
  )

  if (!isSuperuserAdmin(user)) {
    return <Navigate to={id ? `/dashboard/vendors/${id}` : '/dashboard/vendors'} replace />
  }

  const handleEditStart = () => {
    setConfigForm({
      app_name: appConfig?.app_name || '',
      primary_color: appConfig?.primary_color || '#2563eb',
      icon_url: appConfig?.icon_url || '',
      splash_color: appConfig?.splash_color || '#2563eb',
      bundle_id_suffix: appConfig?.bundle_id_suffix || '',
    })
    setEditMode(true)
  }

  const handleSaveConfig = () => {
    const cleaned: AppConfig = {}
    if (configForm.app_name) cleaned.app_name = configForm.app_name
    if (configForm.primary_color) cleaned.primary_color = configForm.primary_color
    if (configForm.icon_url) cleaned.icon_url = configForm.icon_url
    if (configForm.splash_color) cleaned.splash_color = configForm.splash_color
    if (configForm.bundle_id_suffix) cleaned.bundle_id_suffix = configForm.bundle_id_suffix

    updateConfig.mutate(cleaned, {
      onSuccess: () => setEditMode(false),
    })
  }

  const handleTriggerBuild = (platform: string) => {
    triggerBuild.mutate(platform)
  }

  if (vendorLoading || configLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Vendor not found</p>
        <Button onClick={() => navigate('/dashboard/vendors')}>Back to Business Accounts</Button>
      </div>
    )
  }

  const buildSortOptions = [
    { value: 'status', label: 'Status' },
    { value: 'platform', label: 'Platform' },
    { value: 'created_at', label: 'Created' },
    { value: 'built_at', label: 'Built' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <Button variant="ghost" size="icon" className="shrink-0 self-start" onClick={() => navigate(`/dashboard/vendors/${vendorId}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold flex flex-wrap items-center gap-2 sm:text-2xl">
            <Smartphone className="w-6 h-6 text-blue-600 shrink-0" />
            Branded App — {vendor.display_name}
          </h1>
          <p className="text-sm text-gray-500">
            Configure and build a white-label mobile app for this vendor
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* App Configuration */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              App Configuration
            </CardTitle>
            {!editMode && (
              <Button size="sm" variant="outline" onClick={handleEditStart}>
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editMode ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="app_name">App Name</Label>
                  <Input
                    id="app_name"
                    value={configForm.app_name || ''}
                    onChange={(e) => setConfigForm({ ...configForm, app_name: e.target.value })}
                    placeholder={vendor.display_name}
                  />
                  <p className="text-xs text-gray-500 mt-1">Displayed on the home screen</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="primary_color">Primary Color</Label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={configForm.primary_color || '#2563eb'}
                        onChange={(e) => setConfigForm({ ...configForm, primary_color: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        id="primary_color"
                        value={configForm.primary_color || ''}
                        onChange={(e) => setConfigForm({ ...configForm, primary_color: e.target.value })}
                        placeholder="#2563eb"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="splash_color">Splash Screen Color</Label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={configForm.splash_color || '#2563eb'}
                        onChange={(e) => setConfigForm({ ...configForm, splash_color: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        id="splash_color"
                        value={configForm.splash_color || ''}
                        onChange={(e) => setConfigForm({ ...configForm, splash_color: e.target.value })}
                        placeholder="#2563eb"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="icon_url">App Icon URL</Label>
                  <div className="flex items-start gap-3">
                    {configForm.icon_url ? (
                      <img
                        src={configForm.icon_url}
                        alt="App icon preview"
                        className="w-10 h-10 rounded border object-cover shrink-0 bg-gray-50"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <Input
                        id="icon_url"
                        value={configForm.icon_url || ''}
                        onChange={(e) => setConfigForm({ ...configForm, icon_url: e.target.value })}
                        placeholder="https://cdn.example.com/vendor-icon.png"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-gray-500 mt-1">1024x1024 PNG recommended</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="bundle_suffix">Bundle ID Suffix</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-500 font-mono">com.kiterp.vendor.</span>
                    <Input
                      id="bundle_suffix"
                      value={configForm.bundle_id_suffix || ''}
                      onChange={(e) =>
                        setConfigForm({ ...configForm, bundle_id_suffix: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })
                      }
                      placeholder={vendor.slug.replace(/-/g, '')}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveConfig} disabled={updateConfig.isPending}>
                    {updateConfig.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : null}
                    Save Configuration
                  </Button>
                  <Button variant="ghost" onClick={() => setEditMode(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <ConfigRow label="App Name" value={appConfig?.app_name || vendor.display_name} />
                <ConfigRow label="Primary Color" value={appConfig?.primary_color || '#2563eb'} isColor />
                <ConfigRow label="Splash Color" value={appConfig?.splash_color || '#2563eb'} isColor />
                <ConfigRow
                  label="Icon URL"
                  value={appConfig?.icon_url || 'Using default'}
                  isIconUrl={Boolean(appConfig?.icon_url)}
                />
                <ConfigRow
                  label="Bundle ID"
                  value={`com.kiterp.vendor.${appConfig?.bundle_id_suffix || vendor.slug.replace(/-/g, '')}`}
                  mono
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trigger Build */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Trigger Build
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Generate and submit a branded app build for this vendor.
            </p>
            <Button
              className="w-full gap-2"
              onClick={() => handleTriggerBuild('all')}
              disabled={triggerBuild.isPending}
            >
              {triggerBuild.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Smartphone className="w-4 h-4" />
              )}
              Build Android + iOS
            </Button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTriggerBuild('android')}
                disabled={triggerBuild.isPending}
              >
                Android Only
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTriggerBuild('ios')}
                disabled={triggerBuild.isPending}
              >
                iOS Only
              </Button>
            </div>
            {triggerBuild.isError && (
              <p className="text-sm text-red-600 mt-2">
                Build trigger failed. Make sure the vendor's plan includes the branded app feature.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Build History */}
      <Card>
        <CardHeader>
          <CardTitle>Build History</CardTitle>
        </CardHeader>
        <CardContent>
          {buildsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : builds.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Smartphone className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No builds yet</p>
              <p className="text-sm mt-1">Trigger a build above to get started.</p>
            </div>
          ) : (
            <>
            <TableToolbar
              search=""
              onSearchChange={() => {}}
              hideSearch={true}
              sortOptions={buildSortOptions}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortKeyChange={setSortKey}
              onSortDirChange={setSortDir}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Platform</th>
                    <th className="pb-2 pr-4">Profile</th>
                    <th className="pb-2 pr-4">Created</th>
                    <th className="pb-2 pr-4">Built</th>
                    <th className="pb-2">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {builds.map((build) => {
                    const sc = statusConfig[build.status] || statusConfig.pending
                    const StatusIcon = sc.icon
                    return (
                      <tr key={build.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {sc.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 capitalize">{build.platform}</td>
                        <td className="py-3 pr-4 font-mono text-xs">{build.build_profile}</td>
                        <td className="py-3 pr-4">
                          {build.created_at ? new Date(build.created_at).toLocaleString() : '-'}
                        </td>
                        <td className="py-3 pr-4">
                          {build.built_at ? new Date(build.built_at).toLocaleString() : '-'}
                        </td>
                        <td className="py-3">
                          {build.error_message ? (
                            <span className="text-red-600 text-xs" title={build.error_message}>
                              {build.error_message.slice(0, 60)}...
                            </span>
                          ) : build.eas_build_id_android || build.eas_build_id_ios ? (
                            <span className="text-xs text-gray-500 font-mono">
                              {build.eas_build_id_android && `A: ${build.eas_build_id_android.slice(0, 8)}`}
                              {build.eas_build_id_android && build.eas_build_id_ios && ' | '}
                              {build.eas_build_id_ios && `I: ${build.eas_build_id_ios.slice(0, 8)}`}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function formatIconUrlDisplay(url: string): string {
  if (url.startsWith('data:image/')) {
    const mime = url.slice(5, url.indexOf(';')) || 'image'
    return `Embedded ${mime} (${Math.round(url.length / 1024)} KB)`
  }
  if (url.length > 48) {
    return `${url.slice(0, 28)}…${url.slice(-12)}`
  }
  return url
}

function ConfigRow({
  label,
  value,
  isColor,
  isIconUrl,
  mono,
}: {
  label: string
  value: string
  isColor?: boolean
  isIconUrl?: boolean
  mono?: boolean
}) {
  const displayValue = isIconUrl ? formatIconUrlDisplay(value) : value

  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 last:border-0 min-w-0">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span
        className={`text-sm font-medium min-w-0 max-w-[70%] ${mono || isIconUrl ? 'font-mono' : ''} flex items-center justify-end gap-2`}
        title={isIconUrl && value !== 'Using default' ? value : undefined}
      >
        {isColor && (
          <span
            className="inline-block w-5 h-5 rounded border shrink-0"
            style={{ backgroundColor: value }}
          />
        )}
        {isIconUrl && value !== 'Using default' && (
          <img
            src={value}
            alt=""
            className="w-8 h-8 rounded border object-cover shrink-0 bg-gray-50"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        )}
        <span className="truncate text-right">{displayValue}</span>
      </span>
    </div>
  )
}
