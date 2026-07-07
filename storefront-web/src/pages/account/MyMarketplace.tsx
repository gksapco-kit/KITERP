import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ExternalLink, Loader2, MessageSquareQuote, Plus } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { useAcceptMarketplaceQuote, useCreateMarketplaceLead, useMarketplaceLeads } from '@/hooks/useStore'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function MyMarketplace() {
  const { storePath } = useVendor()
  const { data: leads = [], isLoading } = useMarketplaceLeads()
  const createLead = useCreateMarketplaceLead()
  const acceptQuote = useAcceptMarketplaceQuote()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [budgetMin, setBudgetMin] = useState('')
  const [budgetMax, setBudgetMax] = useState('')
  const [location, setLocation] = useState('')

  const submitLead = () => {
    if (!title.trim() || !category.trim()) return
    createLead.mutate(
      {
        title: title.trim(),
        category: category.trim(),
        description: description.trim() || undefined,
        budget_min: budgetMin ? Number(budgetMin) : undefined,
        budget_max: budgetMax ? Number(budgetMax) : undefined,
        location_text: location.trim() || undefined,
      },
      {
        onSuccess: () => {
          setShowForm(false)
          setTitle('')
          setCategory('')
          setDescription('')
          setBudgetMin('')
          setBudgetMax('')
          setLocation('')
        },
      },
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-1.5">
        <Link to={storePath('/account')} className="hover:text-primary">Account</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">Marketplace requests</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <MessageSquareQuote className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-gray-900">My requests & quotes</h1>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-4 h-4 mr-1" /> Post requirement
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border bg-white p-4 mb-6 space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What do you need? (e.g. Wedding photography)" />
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (e.g. Photography)" />
          <textarea
            className="w-full rounded-lg border border-gray-200 p-3 text-sm min-h-[80px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your requirement…"
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Input type="number" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="Budget min (₹)" />
            <Input type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="Budget max (₹)" />
          </div>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
          <Button disabled={!title.trim() || !category.trim() || createLead.isPending} onClick={submitLead}>
            {createLead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit request'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-gray-500">
          No marketplace requests yet. Post a requirement to receive quotes from sellers.
        </div>
      ) : (
        <div className="space-y-4">
          {(leads as Record<string, unknown>[]).map((lead) => {
            const id = String(lead.id)
            const quotes = (lead.quotes as Record<string, unknown>[]) || []
            const orderId = lead.order_id ? String(lead.order_id) : ''
            const orderNumber = lead.order_number ? String(lead.order_number) : ''
            return (
              <div key={id} className="rounded-xl border bg-white p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{String(lead.title)}</p>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">{String(lead.category)} · {String(lead.status)}</p>
                    {orderId && (
                      <Link
                        to={storePath(`/account/orders/${orderId}`)}
                        className="inline-flex items-center gap-1 text-xs text-green-700 mt-1 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Order {orderNumber || orderId.slice(0, 8)}
                      </Link>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{quotes.length} quote{quotes.length === 1 ? '' : 's'}</span>
                </div>
                {lead.description && <p className="text-sm text-gray-600 mt-2">{String(lead.description)}</p>}
                {quotes.length > 0 && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {quotes.map((q) => (
                      <div key={String(q.id)} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div>
                          <p className="font-medium">{String(q.vendor_name || 'Vendor')}</p>
                          <p className="text-gray-500">{formatCurrency(Number(q.price || 0))}{q.estimated_time ? ` · ${String(q.estimated_time)}` : ''}</p>
                        </div>
                        {q.status === 'pending' && !q.is_selected && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={acceptQuote.isPending}
                            onClick={() => acceptQuote.mutate({ leadId: id, quoteId: String(q.id) })}
                          >
                            Accept quote
                          </Button>
                        )}
                        {Boolean(q.is_selected) && (
                          <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">Selected</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
