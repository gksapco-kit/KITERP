import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useEmailTemplates, useSaveTemplate } from '@/hooks/useCrm'
import { crmApi, type EmailTemplate } from '@/api/crm'
import { Plus, Loader2, Mail, Edit3, Trash2 } from 'lucide-react'
import { CrmModal, Field } from './_shared'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import { EmailBodyEditor } from './crmMarketingForms'

function TemplateForm({ tpl, onClose }: { tpl?: EmailTemplate; onClose: () => void }) {
  const qc = useQueryClient()
  const save = useSaveTemplate()
  const [form, setForm] = useState({
    name: tpl?.name || '',
    subject: tpl?.subject || '',
    body_html: tpl?.body_html || '<p>Hello {{contact.first_name}},</p>\n<p></p>\n<p>Best regards,<br/>{{user.name}}</p>',
    body_text: tpl?.body_text || '',
    is_active: tpl?.is_active !== false,
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.subject.trim()) {
      toast.error('Name and subject are required')
      return
    }
    try {
      await save.mutateAsync({
        id: tpl?.id,
        data: {
          name: form.name.trim(),
          subject: form.subject.trim(),
          body_html: form.body_html,
          body_text: form.body_text || undefined,
          is_active: form.is_active,
        },
      })
      await qc.invalidateQueries({ queryKey: ['crm', 'templates'] })
      toast.success(tpl ? 'Template updated' : 'Template saved')
      onClose()
    } catch (err) {
      toast.error(extractApiError(err, 'Could not save template'))
    }
  }

  return (
    <CrmModal title={tpl ? 'Edit template' : 'New email template'} onClose={onClose} maxW="max-w-2xl">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Template name" required>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Welcome email" />
        </Field>
        <Field label="Subject line" required>
          <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Welcome to {{vendor.name}}" />
        </Field>
        <Field label="Email body">
          <EmailBodyEditor
            value={form.body_html}
            onChange={v => setForm(p => ({ ...p, body_html: v }))}
            plainText={form.body_text}
            onPlainTextChange={v => setForm(p => ({ ...p, body_text: v }))}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
          Active — available for campaigns and workflows
        </label>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Save template
          </Button>
        </div>
      </form>
    </CrmModal>
  )
}

export default function TemplatesPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useEmailTemplates()
  const [edit, setEdit] = useState<EmailTemplate | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const remove = async (id: string) => {
    if (!confirm('Delete this template?')) return
    await crmApi.deleteTemplate(id)
    qc.invalidateQueries({ queryKey: ['crm', 'templates'] })
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
          <p className="text-sm text-gray-500 mb-3">Create reusable emails with merge tags — click to insert fields.</p>
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
    </div>
  )
}
