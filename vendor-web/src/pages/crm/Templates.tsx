import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useEmailTemplates } from '@/hooks/useCrm'
import { crmApi, type EmailTemplate } from '@/api/crm'
import { Plus, Loader2, Mail, Edit3, Trash2, Eye } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import { TemplateForm, TemplatePreviewModal } from './CampaignTemplatesPanel'

import { askConfirm } from '@/components/common/ConfirmProvider'
export default function TemplatesPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useEmailTemplates()
  const [edit, setEdit] = useState<EmailTemplate | null>(null)
  const [preview, setPreview] = useState<EmailTemplate | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const remove = async (id: string) => {
    if (!await askConfirm('Delete this template?')) return
    try {
      await crmApi.deleteTemplate(id)
      await qc.invalidateQueries({ queryKey: ['crm', 'templates'] })
      toast.success('Template deleted')
    } catch (err) {
      toast.error(extractApiError(err, 'Could not delete template'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-0.5">CRM</p>
          <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : !data?.length ? (
        <Card><CardContent className="p-12 text-center">
          <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-3">Create reusable emails with merge tags, images, and videos.</p>
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> Create one</Button>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(t => (
            <Card key={t.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold truncate">{t.name}</h3>
                  <Badge variant={t.is_active ? 'success' : 'secondary'}>{t.is_active ? 'active' : 'inactive'}</Badge>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{t.subject}</p>
                <div className="flex gap-1 mt-3 pt-3 border-t">
                  <Button variant="ghost" size="sm" onClick={() => setPreview(t)}><Eye className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setEdit(t)}><Edit3 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(t.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && <TemplateForm onClose={() => setShowCreate(false)} />}
      {edit && <TemplateForm tpl={edit} onClose={() => setEdit(null)} />}
      {preview && <TemplatePreviewModal tpl={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
