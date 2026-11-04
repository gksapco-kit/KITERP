import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Copy, Link2, ShieldOff } from 'lucide-react'
import { reApi } from '@/api/realestate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loading, SimpleTable } from './parts'

type Link = { url: string; expires_at: string }

/** Staff screen: issue / revoke the private portal link for each customer. */
export default function PortalAccess() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [days, setDays] = useState('30')
  const [links, setLinks] = useState<Record<string, Link>>({})

  const customers = useQuery({
    queryKey: ['re-portal-customers', search],
    queryFn: () => reApi.list('customers', { search: search || undefined, size: 100, sort: 'full_name' }),
  })

  const create = useMutation({
    mutationFn: (id: string) => reApi.post<Link & { message: string }>(`/customers/${id}/portal-link`, { days: Number(days) || 30 }),
    onSuccess: (out, id) => {
      setLinks((s) => ({ ...s, [id]: { url: out.url, expires_at: out.expires_at } }))
      toast.success(out.message)
      qc.invalidateQueries({ queryKey: ['re-portal-customers'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Could not create the link'),
  })

  const revoke = useMutation({
    mutationFn: (id: string) => reApi.post<{ message: string }>(`/customers/${id}/portal-revoke`),
    onSuccess: (out, id) => {
      setLinks((s) => {
        const { [id]: _drop, ...rest } = s
        return rest
      })
      toast.success(out.message)
      qc.invalidateQueries({ queryKey: ['re-portal-customers'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Could not revoke access'),
  })

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('Copy failed — select the link and copy it manually')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="w-64" placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Link valid for
          <Input className="w-20" type="number" min={1} max={180} value={days} onChange={(e) => setDays(e.target.value)} />
          days
        </label>
      </div>
      {customers.isLoading || !customers.data ? (
        <Loading />
      ) : (
        <SimpleTable
          rows={customers.data.items}
          empty="No customers found"
          cols={[
            { key: 'customer_code', label: 'Code' },
            { key: 'full_name', label: 'Customer' },
            { key: 'phone', label: 'Phone' },
            {
              key: 'portal_enabled',
              label: 'Portal',
              render: (r) => (r.portal_enabled ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Off</Badge>),
            },
            {
              key: 'link',
              label: 'Link',
              render: (r) => {
                const l = links[r.id]
                return l ? (
                  <div className="flex max-w-md items-center gap-2">
                    <span className="truncate font-mono text-[11px]" title={l.url}>{l.url}</span>
                    <Button size="xs" variant="outline" onClick={() => copy(l.url)}><Copy className="mr-1 h-3 w-3" />Copy</Button>
                  </div>
                ) : r.portal_enabled ? (
                  <span className="text-xs text-muted-foreground">Generate a new link to share it again</span>
                ) : null
              },
            },
            {
              key: 'actions',
              label: '',
              render: (r) => (
                <div className="flex gap-2">
                  <Button size="xs" onClick={() => create.mutate(r.id)} disabled={create.isPending}>
                    <Link2 className="mr-1 h-3 w-3" />{r.portal_enabled ? 'New link' : 'Create link'}
                  </Button>
                  {r.portal_enabled && (
                    <Button size="xs" variant="outline" onClick={() => revoke.mutate(r.id)} disabled={revoke.isPending}>
                      <ShieldOff className="mr-1 h-3 w-3" />Revoke
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Each link is private to one customer, expires automatically and can be revoked. Creating a new link stops the previous one.
        Customers see their own payments, dues, handover progress, warranty and requests — nothing else.
      </p>
    </div>
  )
}
