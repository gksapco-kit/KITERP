import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useAdminVendor } from '@/hooks/useAdmin'
import {
  useAppConfig,
  useUpdateAppConfig,
  useUploadAppIcon,
  useTriggerBuild,
  useDeleteBuild,
  usePauseBuild,
  useResumeBuild,
  useVendorBuilds,
} from '@/hooks/useAppBuilds'
import type { AppBuild, AppConfig } from '@/api/appBuild.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  Smartphone,
  Palette,
  Play,
  Pause,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Hammer,
  Upload,
  Package,
  Download,
  FolderOpen,
  ImagePlus,
  Trash2,
} from 'lucide-react'
import { TableToolbar } from '@/components/table/TableToolbar'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'
import { processRows, type SortDir } from '@/lib/tableList'
import { mediaUrl } from '@/lib/utils'
import { toast } from 'sonner'
import { askConfirm } from '@/components/common/ConfirmProvider'

const ACTIVE_STATUSES = new Set(['pending', 'config_generated', 'building'])

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-yellow-600 bg-yellow-50', label: 'Pending' },
  config_generated: { icon: Package, color: 'text-blue-600 bg-blue-50', label: 'Config Ready' },
  building: { icon: Hammer, color: 'text-indigo-600 bg-indigo-50', label: 'Building' },
  paused: { icon: Pause, color: 'text-amber-700 bg-amber-50', label: 'Paused' },
  built: { icon: CheckCircle2, color: 'text-green-600 bg-green-50', label: 'Built' },
  submitted: { icon: Upload, color: 'text-primary bg-accent', label: 'Submitted' },
  published: { icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50', label: 'Published' },
  failed: { icon: XCircle, color: 'text-red-600 bg-red-50', label: 'Failed' },
}

function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

/** Circular elapsed timer — ring fills each minute; center shows mm:ss / h:mm:ss. */
function CircularElapsedTimer({
  seconds,
  size = 64,
  trackClassName = 'stroke-indigo-100',
  progressClassName = 'stroke-indigo-500',
  labelClassName = 'text-indigo-950',
}: {
  seconds: number
  size?: number
  trackClassName?: string
  progressClassName?: string
  labelClassName?: string
}) {
  const stroke = Math.max(3, Math.round(size / 16))
  const view = 44
  const radius = (view - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const minuteProgress = (Math.max(0, seconds) % 60) / 60
  const dashOffset = circumference * (1 - minuteProgress)
  const label = formatElapsed(seconds)
  const fontSize = size >= 72 ? 12 : size >= 56 ? 10 : 8

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      title={`Elapsed ${label}`}
      aria-label={`Elapsed ${label}`}
    >
      <svg
        className="absolute inset-0 -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${view} ${view}`}
        aria-hidden
      >
        <circle
          className={trackClassName}
          cx={view / 2}
          cy={view / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className={`${progressClassName} transition-[stroke-dashoffset] duration-1000 ease-linear`}
          cx={view / 2}
          cy={view / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span
        className={`relative z-[1] font-semibold tabular-nums leading-none ${labelClassName}`}
        style={{ fontSize }}
      >
        {label}
      </span>
    </div>
  )
}

function useElapsedSeconds(sinceIso?: string | null, active?: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active || !sinceIso) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active, sinceIso])
  if (!sinceIso || !active) return 0
  return Math.max(0, (now - new Date(sinceIso).getTime()) / 1000)
}

export default function VendorAppBuilds() {
  const { user } = useAuthStore()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const vendorId = id ?? ''
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: vendor, isLoading: vendorLoading } = useAdminVendor(vendorId)
  const { data: appConfig, isLoading: configLoading } = useAppConfig(vendorId)
  const { data: buildsData, isLoading: buildsLoading, isFetching: buildsFetching } =
    useVendorBuilds(vendorId)
  const updateConfig = useUpdateAppConfig(vendorId)
  const uploadIcon = useUploadAppIcon(vendorId)
  const triggerBuild = useTriggerBuild(vendorId)
  const deleteBuild = useDeleteBuild(vendorId)
  const pauseBuild = usePauseBuild(vendorId)
  const resumeBuild = useResumeBuild(vendorId)

  const [editMode, setEditMode] = useState(false)
  const [configForm, setConfigForm] = useState<AppConfig>({})
  const [localIconPreview, setLocalIconPreview] = useState<string | null>(null)
  const [brokenIconUrl, setBrokenIconUrl] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const localIconPreviewRef = useRef<string | null>(null)

  const buildsRaw = buildsData?.items || []
  const activeBuild = useMemo(
    () => buildsRaw.find((b) => ACTIVE_STATUSES.has(b.status)) ?? null,
    [buildsRaw],
  )
  const elapsed = useElapsedSeconds(
    activeBuild?.updated_at || activeBuild?.created_at,
    Boolean(activeBuild),
  )

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

  const iconPreview =
    localIconPreview || mediaUrl(editMode ? configForm.icon_url : appConfig?.icon_url)
  localIconPreviewRef.current = localIconPreview
  const showIconPreview = Boolean(iconPreview) && brokenIconUrl !== iconPreview

  useEffect(() => {
    return () => {
      const url = localIconPreviewRef.current
      if (url) URL.revokeObjectURL(url)
    }
  }, [])

  if (!isSuperuserAdmin(user)) {
    return <Navigate to={id ? `/dashboard/vendors/${id}` : '/dashboard/vendors'} replace />
  }

  const handleEditStart = () => {
    if (localIconPreview) {
      URL.revokeObjectURL(localIconPreview)
      setLocalIconPreview(null)
    }
    setBrokenIconUrl(null)
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
      onSuccess: () => {
        if (localIconPreview) {
          URL.revokeObjectURL(localIconPreview)
          setLocalIconPreview(null)
        }
        setEditMode(false)
      },
    })
  }

  const handleIconPick = (file?: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (PNG or JPEG)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Icon must be under 5 MB')
      return
    }
    if (localIconPreview) {
      URL.revokeObjectURL(localIconPreview)
    }
    const blobUrl = URL.createObjectURL(file)
    setLocalIconPreview(blobUrl)
    setBrokenIconUrl(null)
    uploadIcon.mutate(file, {
      onSuccess: (data) => {
        setConfigForm((prev) => ({ ...prev, icon_url: data.icon_url || prev.icon_url }))
      },
      onError: () => {
        URL.revokeObjectURL(blobUrl)
        setLocalIconPreview(null)
      },
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

  const files = appConfig?.files

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 self-start"
          onClick={() => navigate(`/dashboard/vendors/${vendorId}`)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold flex flex-wrap items-center gap-2 sm:text-2xl">
            <Smartphone className="w-6 h-6 text-blue-600 shrink-0" />
            Branded App — {vendor.display_name}
          </h1>
          <p className="text-sm text-gray-500">
            Save config to write <code className="text-xs">mobile/vendors/{vendor.slug}/</code>, then
            trigger a build. Keep <code className="text-xs">scripts/build-runner.py</code> running to
            process the queue.
          </p>
        </div>
      </div>

      {activeBuild ? (
        <ActiveBuildBanner
          build={activeBuild}
          elapsedSeconds={elapsed}
          refreshing={buildsFetching}
          onPause={() => pauseBuild.mutate(activeBuild.id)}
          pausing={pauseBuild.isPending}
        />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                        onChange={(e) =>
                          setConfigForm({ ...configForm, primary_color: e.target.value })
                        }
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        id="primary_color"
                        value={configForm.primary_color || ''}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, primary_color: e.target.value })
                        }
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
                        onChange={(e) =>
                          setConfigForm({ ...configForm, splash_color: e.target.value })
                        }
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        id="splash_color"
                        value={configForm.splash_color || ''}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, splash_color: e.target.value })
                        }
                        placeholder="#2563eb"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>App Icon</Label>
                  <div className="mt-1 flex flex-col sm:flex-row gap-3 sm:items-start">
                    <div className="w-20 h-20 rounded-xl border bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                      {showIconPreview ? (
                        <img
                          key={iconPreview}
                          src={iconPreview}
                          alt="App icon preview"
                          className="w-full h-full object-cover"
                          onError={() => setBrokenIconUrl(iconPreview)}
                        />
                      ) : (
                        <ImagePlus className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => handleIconPick(e.target.files?.[0])}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        disabled={uploadIcon.isPending}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploadIcon.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        Upload icon
                      </Button>
                      <p className="text-xs text-gray-500">
                        1024×1024 PNG recommended. Upload writes{' '}
                        <code>mobile/vendors/{vendor.slug}/icon.png</code>.
                      </p>
                      <Input
                        id="icon_url"
                        value={configForm.icon_url || ''}
                        onChange={(e) => setConfigForm({ ...configForm, icon_url: e.target.value })}
                        placeholder="/uploads/app-icons/... or https://..."
                        className="font-mono text-xs"
                      />
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
                        setConfigForm({
                          ...configForm,
                          bundle_id_suffix: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''),
                        })
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
                <ConfigRow
                  label="Primary Color"
                  value={appConfig?.primary_color || '#2563eb'}
                  isColor
                />
                <ConfigRow
                  label="Splash Color"
                  value={appConfig?.splash_color || '#2563eb'}
                  isColor
                />
                <ConfigRow
                  label="Icon"
                  value={appConfig?.icon_url || 'Using default'}
                  isIconUrl={Boolean(appConfig?.icon_url)}
                />
                <ConfigRow
                  label="Bundle ID"
                  value={`com.kiterp.vendor.${appConfig?.bundle_id_suffix || vendor.slug.replace(/-/g, '')}`}
                  mono
                />
                <div className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-slate-700">
                    <FolderOpen className="w-3.5 h-3.5" />
                    Disk files
                  </div>
                  <p>
                    Config:{' '}
                    {files?.files_ready ? (
                      <span className="text-emerald-700">ready</span>
                    ) : (
                      <span className="text-amber-700">not written yet — save config</span>
                    )}
                    {files?.config_path ? (
                      <span className="font-mono text-slate-500"> · {files.config_path}</span>
                    ) : null}
                  </p>
                  <p>
                    Icon:{' '}
                    {files?.icon_ready ? (
                      <span className="text-emerald-700">ready</span>
                    ) : (
                      <span className="text-amber-700">missing — upload an icon</span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              Trigger Build
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Queues an EAS build. Status moves to <strong>Config Ready</strong>, then{' '}
              <strong>Building</strong> once the runner picks it up.
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
              <p className="font-medium">Build runner required</p>
              <p>
                Keep this running in a terminal (repo root, with <code className="font-mono">eas</code>{' '}
                logged in). Until it is online, builds stay on Config Ready.
              </p>
              <pre className="mt-1 overflow-x-auto rounded bg-white/80 p-2 font-mono text-[11px] text-slate-800 whitespace-pre-wrap">
{`$env:BUILD_RUNNER_API_KEY="kiterp-local-build-runner"
$env:API_URL="http://127.0.0.1:8000/api/v1"
py -3 scripts/build-runner.py`}
              </pre>
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => handleTriggerBuild('android')}
              disabled={triggerBuild.isPending || Boolean(activeBuild)}
            >
              {triggerBuild.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Smartphone className="w-4 h-4" />
              )}
              Build Android APK
            </Button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTriggerBuild('ios')}
                disabled={triggerBuild.isPending || Boolean(activeBuild)}
              >
                iOS Only
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTriggerBuild('all')}
                disabled={triggerBuild.isPending || Boolean(activeBuild)}
              >
                Android + iOS
              </Button>
            </div>
            {activeBuild ? (
              <p className="text-xs text-amber-700">
                A build is already in progress. Wait for it to finish before starting another.
              </p>
            ) : null}
            {triggerBuild.isError && (
              <p className="text-sm text-red-600 mt-2">Build trigger failed. Check API logs.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Build History</CardTitle>
          {buildsFetching ? (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Live
            </span>
          ) : null}
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
                      <th className="pb-2 pr-4">Details</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {builds.map((build) => {
                      const sc = statusConfig[build.status] || statusConfig.pending
                      const StatusIcon = sc.icon
                      const isActive = ACTIVE_STATUSES.has(build.status)
                      return (
                        <tr key={build.id} className="hover:bg-gray-50 align-top">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              {isActive && build.id === activeBuild?.id ? (
                                <CircularElapsedTimer seconds={elapsed} size={44} />
                              ) : null}
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}
                              >
                                <StatusIcon
                                  className={`w-3.5 h-3.5 ${isActive ? 'animate-pulse' : ''}`}
                                />
                                {sc.label}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 capitalize">{build.platform}</td>
                          <td className="py-3 pr-4 font-mono text-xs">{build.build_profile}</td>
                          <td className="py-3 pr-4 whitespace-nowrap">
                            {build.created_at ? new Date(build.created_at).toLocaleString() : '-'}
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap">
                            {build.built_at ? new Date(build.built_at).toLocaleString() : '-'}
                          </td>
                          <td className="py-3 pr-4">
                            <BuildDetailsCell build={build} />
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center justify-end gap-0.5">
                              {ACTIVE_STATUSES.has(build.status) ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  title="Pause build"
                                  disabled={
                                    pauseBuild.isPending && pauseBuild.variables === build.id
                                  }
                                  onClick={() => pauseBuild.mutate(build.id)}
                                >
                                  {pauseBuild.isPending && pauseBuild.variables === build.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Pause className="w-4 h-4" />
                                  )}
                                </Button>
                              ) : null}
                              {build.status === 'paused' || build.status === 'failed' ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  title="Resume / play build"
                                  disabled={
                                    resumeBuild.isPending && resumeBuild.variables === build.id
                                  }
                                  onClick={() => resumeBuild.mutate(build.id)}
                                >
                                  {resumeBuild.isPending && resumeBuild.variables === build.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-red-600"
                                title="Delete build"
                                disabled={
                                  deleteBuild.isPending && deleteBuild.variables === build.id
                                }
                                onClick={async () => {
                                  const ok = await askConfirm({
                                    title: 'Remove this build from history?',
                                    description:
                                      'This cannot be undone. Stuck or failed builds can be cleared so you can trigger a new one.',
                                    confirmLabel: 'Remove',
                                    variant: 'danger',
                                  })
                                  if (!ok) return
                                  deleteBuild.mutate(build.id)
                                }}
                              >
                                {deleteBuild.isPending && deleteBuild.variables === build.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
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

function ActiveBuildBanner({
  build,
  elapsedSeconds,
  refreshing,
  onPause,
  pausing,
}: {
  build: AppBuild
  elapsedSeconds: number
  refreshing: boolean
  onPause: () => void
  pausing?: boolean
}) {
  const sc = statusConfig[build.status] || statusConfig.pending
  const StatusIcon = sc.icon
  const waitingRunner = build.status === 'config_generated'

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-indigo-50/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-4">
      <CircularElapsedTimer seconds={elapsedSeconds} size={72} />
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <StatusIcon className="w-5 h-5 text-indigo-600 animate-pulse shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-indigo-950 flex flex-wrap items-center gap-2">
            {sc.label}
            {refreshing ? (
              <Loader2 className="inline w-3.5 h-3.5 animate-spin text-indigo-400" />
            ) : null}
          </p>
          <p className="text-xs text-indigo-800/80 truncate">
            {waitingRunner
              ? 'Config written. Waiting for build-runner to start EAS…'
              : 'EAS build in progress. This page refreshes every few seconds.'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50"
          disabled={pausing}
          onClick={onPause}
        >
          {pausing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
          Pause
        </Button>
        <div className="text-xs font-mono text-indigo-700">
          {build.platform} · {build.build_profile}
        </div>
      </div>
    </div>
  )
}

function BuildDetailsCell({ build }: { build: AppBuild }) {
  if (build.error_message) {
    return (
      <span className="text-red-600 text-xs" title={build.error_message}>
        {build.error_message.length > 80
          ? `${build.error_message.slice(0, 80)}…`
          : build.error_message}
      </span>
    )
  }

  const links: { label: string; href: string }[] = []
  if (build.artifact_url_android) {
    links.push({ label: 'Android APK', href: build.artifact_url_android })
  }
  if (build.artifact_url_ios) {
    links.push({ label: 'iOS build', href: build.artifact_url_ios })
  }

  if (links.length) {
    return (
      <div className="flex flex-col gap-1">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <Download className="w-3 h-3" />
            {l.label}
          </a>
        ))}
      </div>
    )
  }

  if (build.eas_build_id_android || build.eas_build_id_ios) {
    return (
      <span className="text-xs text-gray-500 font-mono">
        {build.eas_build_id_android && `A: ${build.eas_build_id_android.slice(0, 8)}`}
        {build.eas_build_id_android && build.eas_build_id_ios && ' | '}
        {build.eas_build_id_ios && `I: ${build.eas_build_id_ios.slice(0, 8)}`}
      </span>
    )
  }

  if (build.status === 'config_generated') {
    return <span className="text-xs text-blue-600">Waiting for runner…</span>
  }

  if (build.status === 'paused') {
    return <span className="text-xs text-amber-700">Paused — press Play to resume</span>
  }

  return <span className="text-gray-400">-</span>
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
  const imgSrc = isIconUrl && value !== 'Using default' ? mediaUrl(value) : ''

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
        {imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            className="w-8 h-8 rounded border object-cover shrink-0 bg-gray-50"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : null}
        <span className="truncate text-right">{displayValue}</span>
      </span>
    </div>
  )
}
