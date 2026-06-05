import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import { marketplaceApi } from '@/api/marketplace'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function MarketplaceLeadsPage() {
  const qc = useQueryClient()
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['marketplace-leads'],
    queryFn: marketplaceApi.listOpenLeads,
  })
  const { data: quotes = [] } = useQuery({
    queryKey: ['marketplace-quotes'],
    queryFn: marketplaceApi.listMyQuotes,
  })
  const [quoteFor, setQuoteFor] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  const [message, setMessage] = useState('')

  const submit = useMutation({
    mutationFn: ({ leadId, price: p, message: m }: { leadId: string; price: number; message?: string }) =>
      marketplaceApi.submitQuote(leadId, { price: p, message: m }),
    onSuccess: () => {
      toast.success('Quote submitted')
      setQuoteFor(null)
      setPrice('')
      setMessage('')
      qc.invalidateQueries({ queryKey: ['marketplace-leads'] })
      qc.invalidateQueries({ queryKey: ['marketplace-quotes'] })
    },
    onError: () => toast.error('Could not submit quote'),
  })

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Marketplace leads</h1>
        <p className="text-sm text-gray-500 mt-1">Open customer requirements you can quote on.</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
      )}

      {!isLoading && leads.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">
          No open marketplace leads right now.
        </div>
      )}

      <div className="space-y-3">
        {leads.map((lead) => (
          <div key={lead.id} className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">{lead.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {lead.category}
                  {lead.location_text ? ` · ${lead.location_text}` : ''}
                  {lead.budget_min != null ? ` · Budget from ${formatCurrency(lead.budget_min)}` : ''}
                </p>
                {lead.description && <p className="text-sm text-gray-600 mt-2">{lead.description}</p>}
              </div>
              <Button size="sm" variant="outline" onClick={() => setQuoteFor(lead.id)}>
                <MessageSquare className="w-4 h-4 mr-1" /> Quote
              </Button>
            </div>
            {quoteFor === lead.id && (
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-2 items-end">
                <div>
                  <label className="text-xs text-gray-500">Your price (₹)</label>
                  <Input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} className="w-32 h-9" />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-gray-500">Message</label>
                  <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional note" className="h-9" />
                </div>
                <Button
                  size="sm"
                  disabled={submit.isPending || !price}
                  onClick={() => submit.mutate({ leadId: lead.id, price: Number(price), message: message || undefined })}
                >
                  {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                  Send quote
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {quotes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Your submitted quotes</h2>
          <div className="rounded-xl border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td className="px-4 py-3">{q.lead_title || q.lead_id}</td>
                    <td className="px-4 py-3">{formatCurrency(q.price)}</td>
                    <td className="px-4 py-3 capitalize">{q.is_selected ? 'accepted' : q.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
