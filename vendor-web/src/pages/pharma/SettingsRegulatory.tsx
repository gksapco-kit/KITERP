import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { pharmaApi } from '@/api/pharma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useHasPermission } from '@/hooks/usePermissions'
import { PharmaCard, PharmaPageHeader } from './pharmaShared'

export default function PharmaSettingsRegulatoryPage() {
  const canManage = useHasPermission('pharma.manage')
  const [cfg, setCfg] = useState<Record<string, any>>({})
  const [vrsEndpoint, setVrsEndpoint] = useState('')
  const [vrsKey, setVrsKey] = useState('')
  const [nmvsEndpoint, setNmvsEndpoint] = useState('')
  const [nmvsKey, setNmvsKey] = useState('')
  const [gs1Prefix, setGs1Prefix] = useState('')
  const [loading, setLoading] = useState(true)
  const [credSaving, setCredSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    pharmaApi
      .getSettings()
      .then((s) => {
        const settings = s || {}
        setCfg(settings)
        setVrsEndpoint(settings.vrs_endpoint || '')
        setVrsKey(settings.vrs_api_key || '')
        setNmvsEndpoint(settings.nmvs_endpoint || '')
        setNmvsKey(settings.nmvs_api_key || '')
        setGs1Prefix(settings.gs1_company_prefix || '')
      })
      .catch((e: any) => toast.error(e?.response?.data?.detail || 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const saveCredentials = async () => {
    setCredSaving(true)
    try {
      const next = await pharmaApi.patchSettings({
        vrs_endpoint: vrsEndpoint.trim() || '',
        vrs_api_key: vrsKey.trim() || '',
        nmvs_endpoint: nmvsEndpoint.trim() || '',
        nmvs_api_key: nmvsKey.trim() || '',
        gs1_company_prefix: gs1Prefix.trim() || '',
      })
      setCfg(next)
      toast.success('Regulatory integration credentials saved')
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Save failed')
    } finally {
      setCredSaving(false)
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <Link
          to="/pharma/settings"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Foundations
        </Link>
        <PharmaPageHeader
          title="Regulatory integrations"
          subtitle="DSCSA VRS, EU FMD NMVS, and GS1 company prefix for proper SGTIN encoding. Leave blank to use local-only stub mode."
          actions={
            <div className="flex flex-wrap gap-2">
              {cfg.vrs_endpoint ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">VRS live</span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">VRS stub</span>
              )}
              {cfg.nmvs_endpoint ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">NMVS live</span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">NMVS stub</span>
              )}
            </div>
          }
        />
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      <PharmaCard>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">GS1 company prefix</label>
            <Input
              value={gs1Prefix}
              onChange={(e) => setGs1Prefix(e.target.value)}
              placeholder="e.g. 0614141"
              disabled={!canManage}
              className="h-9 font-mono text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Used to encode proper SGTIN URNs in EPCIS exports.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">DSCSA VRS endpoint</label>
            <Input
              value={vrsEndpoint}
              onChange={(e) => setVrsEndpoint(e.target.value)}
              placeholder="https://vrs.example.com/verify"
              disabled={!canManage}
              className="h-9 text-sm"
            />
            <label className="text-xs font-medium">VRS API key</label>
            <Input
              type="password"
              value={vrsKey}
              onChange={(e) => setVrsKey(e.target.value)}
              placeholder="Bearer token"
              disabled={!canManage}
              className="h-9 text-sm"
            />
          </div>

          {cfg.track_trace_region === 'eu' || nmvsEndpoint || nmvsKey ? (
            <div className="space-y-1.5">
              <label className="text-xs font-medium">EU FMD NMVS endpoint</label>
              <Input
                value={nmvsEndpoint}
                onChange={(e) => setNmvsEndpoint(e.target.value)}
                placeholder="https://nmvs.example.com/decommission"
                disabled={!canManage}
                className="h-9 text-sm"
              />
              <label className="text-xs font-medium">NMVS API key</label>
              <Input
                type="password"
                value={nmvsKey}
                onChange={(e) => setNmvsKey(e.target.value)}
                placeholder="NMVS API key"
                disabled={!canManage}
                className="h-9 text-sm"
              />
            </div>
          ) : (
            <div className="flex items-end">
              <p className="text-xs text-muted-foreground">
                NMVS fields appear when track &amp; trace region is set to EU (in E-sign &amp; approval policy).
              </p>
            </div>
          )}
        </div>

        {canManage ? (
          <div className="mt-5 border-t border-border/60 pt-4">
            <Button onClick={saveCredentials} disabled={credSaving}>
              {credSaving ? 'Saving…' : 'Save integration credentials'}
            </Button>
          </div>
        ) : null}
      </PharmaCard>
    </div>
  )
}
