import { Suspense, useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import ResourceTable from './ResourceTable'
import { VIEWS } from './views'
import { EmptyState, PageHeader, useREMeta } from './shared'
import type { ModuleTab } from '@/api/realestate'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default function ModulePage() {
  const { moduleId } = useParams()
  const { data: meta, isLoading, error } = useREMeta()
  const [params, setParams] = useSearchParams()

  const mod = meta?.modules.find((m) => m.id === moduleId)
  const tabs = useMemo<ModuleTab[]>(
    () => (mod?.tabs ?? []).filter((t) => (t.view ? !!VIEWS[t.view] : true)),
    [mod],
  )
  const active = tabs.find((t) => slug(t.label) === params.get('tab')) ?? tabs[0]

  if (isLoading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
  if (error || !meta) {
    return <EmptyState title="Real estate is not available" hint="Check that the module is enabled and you have the Real Estate permission." />
  }
  if (!mod) {
    return <EmptyState title="Unknown module" hint="Pick a module from the Real Estate overview." />
  }

  const View = active?.view ? VIEWS[active.view] : null

  return (
    <div>
      <PageHeader
        title={`${mod.no}. ${mod.title}`}
        subtitle={
          <Link to="/realestate" className="hover:underline">Real Estate</Link>
        }
      />
      {tabs.length === 0 ? (
        <EmptyState
          title="This module ships in a later phase"
          hint="Its screens are part of the phased real-estate roll-out and are not enabled yet."
        />
      ) : (
        <>
          <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
            {tabs.map((t) => {
              const on = t === active
              return (
                <Button
                  key={`${t.resource ?? t.view}-${t.label}`}
                  variant="ghost"
                  size="sm"
                  className={`rounded-b-none border-b-2 ${on ? 'border-primary text-foreground' : 'border-transparent'}`}
                  onClick={() => setParams({ tab: slug(t.label) }, { replace: true })}
                >
                  {t.label}
                </Button>
              )
            })}
          </div>
          {active?.resource ? (
            <ResourceTable key={`${active.resource}-${active.label}`} resourceKey={active.resource} filter={active.filter} />
          ) : View ? (
            <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>}>
              <View />
            </Suspense>
          ) : null}
        </>
      )}
    </div>
  )
}
