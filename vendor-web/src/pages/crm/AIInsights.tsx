import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useContacts, useLeads } from '@/hooks/useCrm'
import { crmApi, type AiInsight } from '@/api/crm'
import { Bot, Loader2, Sparkles, Target, Users } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

type EntityType = 'contact' | 'lead' | 'deal' | 'account'

export default function AIInsightsPage() {
  const [entityType, setEntityType] = useState<EntityType>('contact')
  const [entityId, setEntityId] = useState('')
  const [insights, setInsights] = useState<AiInsight[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: contacts } = useContacts({ size: 50 })
  const { data: leads } = useLeads({ size: 50 })

  const load = async (id?: string) => {
    const target = id || entityId
    if (!target) return
    setLoading(true); setError('')
    try {
      const data = await crmApi.listInsights(entityType, target)
      setInsights(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load insights')
    } finally { setLoading(false) }
  }

  const generate = async (kind: 'summary' | 'next_best_action' | 'lead_score') => {
    if (!entityId) return
    setLoading(true); setError('')
    try {
      if (kind === 'summary') await crmApi.aiSummarise(entityType, entityId)
      else if (kind === 'next_best_action' && entityType === 'contact') await crmApi.aiNextBest(entityId)
      else if (kind === 'lead_score' && entityType === 'lead') await crmApi.scoreLead(entityId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary/80" /> AI Insights
        </h1>
        <p className="text-sm text-gray-500 mt-1">AI-Powered Summaries, Next-Best-Action Recommendations And Predictive Lead Scoring.</p>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700">Entity type</label>
              <Select
                value={entityType}
                onChange={v => { setEntityType(v as EntityType); setEntityId(''); setInsights(null) }}
                options={[
                  { value: 'contact', label: 'Contact' },
                  { value: 'lead', label: 'Lead' },
                  { value: 'deal', label: 'Deal' },
                  { value: 'account', label: 'Account' },
                ]}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-gray-700">{entityType} ID</label>
              {entityType === 'contact' ? (
                <Select
                  className="mt-1"
                  value={entityId}
                  onChange={v => { setEntityId(v); load(v) }}
                  placeholder="— Select contact —"
                  options={selectOptionsWithBlank(
                    '— Select contact —',
                    (contacts?.items ?? []).map(c => ({
                      value: c.id,
                      label: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id,
                    })),
                  )}
                />
              ) : entityType === 'lead' ? (
                <Select
                  className="mt-1"
                  value={entityId}
                  onChange={v => { setEntityId(v); load(v) }}
                  placeholder="— Select lead —"
                  options={selectOptionsWithBlank(
                    '— Select lead —',
                    (leads?.items ?? []).map(l => ({
                      value: l.id,
                      label: [l.first_name, l.last_name].filter(Boolean).join(' ') || l.email || l.company || l.id,
                    })),
                  )}
                />
              ) : (
                <Input value={entityId} onChange={e => setEntityId(e.target.value)} placeholder="Paste UUID" className="mt-1" />
              )}
            </div>
          </div>
          {entityId && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => generate('summary')} disabled={loading}>
                <Sparkles className="w-4 h-4 mr-1" /> Generate summary
              </Button>
              {entityType === 'contact' && (
                <Button size="sm" variant="outline" onClick={() => generate('next_best_action')} disabled={loading}>
                  <Target className="w-4 h-4 mr-1" /> Next best action
                </Button>
              )}
              {entityType === 'lead' && (
                <Button size="sm" variant="outline" onClick={() => generate('lead_score')} disabled={loading}>
                  <Users className="w-4 h-4 mr-1" /> Re-score
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => load()} disabled={loading}>Refresh</Button>
            </div>
          )}
          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </CardContent>
      </Card>

      {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}

      {insights && (
        insights.length === 0 ? (
          <Card><CardContent className="p-12 text-center">
            <Bot className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No insights yet. Generate one above.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {insights.map(i => (
              <Card key={i.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="soft">{i.kind}</Badge>
                      {i.model && <span className="text-xs text-gray-500">{i.model}</span>}
                      {i.confidence != null && <span className="text-xs text-gray-500">conf {(i.confidence * 100).toFixed(0)}%</span>}
                    </div>
                    <span className="text-xs text-gray-400">{formatDateTime(i.generated_at)}</span>
                  </div>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                    {typeof i.content === 'object' && i.content && 'text' in i.content
                      ? String((i.content as { text?: string }).text || JSON.stringify(i.content, null, 2))
                      : JSON.stringify(i.content, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  )
}
