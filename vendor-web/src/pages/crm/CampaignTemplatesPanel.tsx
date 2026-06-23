import { useRef, useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { useEmailTemplates, useSaveTemplate } from '@/hooks/useCrm'
import { crmApi, type EmailTemplate, type TemplateAttachment, type TemplateSettings } from '@/api/crm'
import {
  Plus, Loader2, Mail, Edit3, Trash2, Eye, Megaphone, ImagePlus, Video,
  Power, PowerOff, PlayCircle,
} from 'lucide-react'
import { CrmModal, Field } from './_shared'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { extractApiError } from '@/lib/errorMessages'
import { EmailBodyEditor } from './crmMarketingForms'
import { cn } from '@/lib/utils'
import { MarketingTemplatePreview, PreviewChannelTabs, type PreviewChannel } from './MarketingTemplatePreview'
import { RichMessageEditor, LoadPromoSampleButton } from './RichMessageEditor'
import {
  DEFAULT_WHATSAPP_BODY,
  DEFAULT_WHATSAPP_FOOTER,
  headerAttachment,
  readTemplateSettings,
  resolveEmailBodyHtml,
} from './marketingTemplateRich'

type TemplateFormState = {
  name: string
  subject: string
  description: string
  channel: string
  body_html: string
  body_text: string
  attachments: TemplateAttachment[]
  settings: TemplateSettings
  is_active: boolean
}

function isRichChannel(channel: string) {
  return channel === 'whatsapp' || channel === 'sms'
}

function templateThumb(tpl: Pick<EmailTemplate, 'attachments'>): TemplateAttachment | null {
  return headerAttachment(tpl.attachments)
}

function templatePayload(form: TemplateFormState) {
  const settings = {
    cta_label: form.settings.cta_label?.trim() || undefined,
    cta_url: form.settings.cta_url?.trim() || undefined,
    footer_text: form.settings.footer_text?.trim() || undefined,
  }
  return {
    name: form.name.trim(),
    subject: form.subject.trim(),
    description: form.description.trim() || undefined,
    channel: form.channel,
    body_html: resolveEmailBodyHtml(form.body_html, form.body_text),
    body_text: form.body_text || undefined,
    attachments: form.attachments,
    settings: Object.values(settings).some(Boolean) ? settings : undefined,
    is_active: form.is_active,
  }
}

function insertMediaIntoBody(body: string, att: TemplateAttachment): string {
  const tag = att.type === 'video'
    ? `<p><video src="${att.url}" controls style="max-width:100%;border-radius:8px"></video></p>`
    : `<p><img src="${att.url}" alt="${att.name || 'image'}" style="max-width:100%;border-radius:8px" /></p>`
  return body.trim() ? `${body}\n${tag}` : tag
}

function ActiveToggle({
  checked, onChange, label = 'Active',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-gray-50/80 px-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{checked ? 'Template is live for campaigns' : 'Template is hidden from campaigns'}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={checked ? 'Deactivate template' : 'Activate template'}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          checked ? 'bg-emerald-500 border-emerald-500' : 'bg-gray-200 border-gray-300',
        )}
      >
        <span
          className={cn(
            'pointer-events-none absolute top-[2px] left-[2px] block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform duration-200 ease-out',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  )
}

function TemplatePreviewMeta({
  tpl, className,
}: {
  tpl: Pick<TemplateFormState, 'is_active' | 'channel'>
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Badge variant={tpl.is_active ? 'success' : 'secondary'}>{tpl.is_active ? 'Active' : 'Inactive'}</Badge>
      <Badge variant="soft">{tpl.channel || 'email'}</Badge>
    </div>
  )
}

export function TemplatePreviewModal({ tpl, onClose }: { tpl: EmailTemplate; onClose: () => void }) {
  const [previewChannel, setPreviewChannel] = useState<PreviewChannel>(
    (tpl.channel as PreviewChannel) || 'whatsapp',
  )

  return (
    <CrmModal title={`Preview — ${tpl.name}`} onClose={onClose} maxW="max-w-4xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
          <TemplatePreviewMeta tpl={{
            is_active: tpl.is_active,
            channel: tpl.channel || 'email',
          }} />
          <PreviewChannelTabs value={previewChannel} onChange={setPreviewChannel} />
        </div>
        {tpl.description && (
          <p className="text-sm text-gray-600 -mt-2">{tpl.description}</p>
        )}
        <MarketingTemplatePreview
          channel={previewChannel}
          tpl={{
            name: tpl.name,
            subject: tpl.subject,
            body_html: tpl.body_html,
            body_text: tpl.body_text || undefined,
            channel: tpl.channel || 'email',
            attachments: tpl.attachments ?? [],
            settings: tpl.settings,
          }}
        />
      </div>
    </CrmModal>
  )
}

export function TemplateForm({
  tpl, onClose, onUseForCampaign,
}: {
  tpl?: EmailTemplate
  onClose: () => void
  onUseForCampaign?: (tpl: EmailTemplate) => void
}) {
  const qc = useQueryClient()
  const save = useSaveTemplate()
  const fileRef = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [mobilePreview, setMobilePreview] = useState(false)
  const [previewChannel, setPreviewChannel] = useState<PreviewChannel>(
    (tpl?.channel as PreviewChannel) || 'whatsapp',
  )
  const settings = readTemplateSettings(tpl?.settings)

  const [form, setForm] = useState<TemplateFormState>({
    name: tpl?.name || '',
    subject: tpl?.subject || '',
    description: tpl?.description || '',
    channel: tpl?.channel || 'whatsapp',
    body_html: tpl?.body_html || '<p>Hello {{contact.first_name}},</p>\n<p></p>\n<p>Best regards,<br/>{{user.name}}</p>',
    body_text: tpl?.body_text || (tpl ? '' : DEFAULT_WHATSAPP_BODY),
    attachments: (tpl?.attachments ?? []) as TemplateAttachment[],
    settings: {
      cta_label: settings.cta_label || 'Explore Now',
      cta_url: settings.cta_url || '',
      footer_text: settings.footer_text || DEFAULT_WHATSAPP_FOOTER,
    },
    is_active: tpl?.is_active !== false,
  })

  const rich = isRichChannel(form.channel)

  useEffect(() => {
    setPreviewChannel(form.channel as PreviewChannel)
  }, [form.channel])

  const handleHeaderUpload = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const att: TemplateAttachment = { ...(await crmApi.uploadTemplateMedia(file)), is_header: true }
      setForm(p => ({
        ...p,
        attachments: [att, ...p.attachments.filter(a => !a.is_header)],
      }))
      toast.success('Header media added')
    } catch (err) {
      toast.error(extractApiError(err, 'Upload failed'))
    } finally {
      setUploading(false)
      if (headerRef.current) headerRef.current.value = ''
    }
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const added: TemplateAttachment[] = []
      for (const file of Array.from(files)) {
        const att = await crmApi.uploadTemplateMedia(file)
        added.push(att)
      }
      setForm(p => ({ ...p, attachments: [...p.attachments, ...added] }))
      toast.success(added.length === 1 ? 'Media attached' : `${added.length} files attached`)
    } catch (err) {
      toast.error(extractApiError(err, 'Upload failed'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeAttachment = (idx: number) => {
    setForm(p => ({ ...p, attachments: p.attachments.filter((_, i) => i !== idx) }))
  }

  const insertAttachment = (att: TemplateAttachment) => {
    setForm(p => ({ ...p, body_html: insertMediaIntoBody(p.body_html, att) }))
    toast.success('Inserted into email body')
  }

  const loadPromoSample = () => {
    setForm(p => ({
      ...p,
      channel: 'whatsapp',
      name: p.name || 'Promo campaign',
      subject: p.subject || 'Summer sale promo',
      body_text: DEFAULT_WHATSAPP_BODY,
      settings: {
        cta_label: 'Explore Now',
        cta_url: p.settings.cta_url || '',
        footer_text: DEFAULT_WHATSAPP_FOOTER,
      },
    }))
    toast.success('Promo sample loaded — add your header video and CTA link')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Template name is required')
      return
    }
    if (!form.subject.trim()) {
      toast.error('Subject / title is required')
      return
    }
    if (rich && !form.body_text.trim()) {
      toast.error('Message body is required')
      return
    }
    try {
      const saved = await save.mutateAsync({ id: tpl?.id, data: templatePayload(form) })
      await qc.invalidateQueries({ queryKey: ['crm', 'templates'] })
      toast.success(tpl ? 'Template updated' : 'Template saved')
      onClose()
      if (onUseForCampaign && saved) onUseForCampaign(saved as EmailTemplate)
    } catch (err) {
      toast.error(extractApiError(err, 'Could not save template'))
    }
  }

  return (
    <CrmModal
      title={tpl ? 'Edit marketing template' : 'New marketing template'}
      onClose={onClose}
      maxW="max-w-6xl"
      headerActions={
        <Button type="button" variant="outline" size="sm" className="lg:hidden"
          onClick={() => setMobilePreview(p => !p)}>
          <Eye className="w-4 h-4 mr-1" /> {mobilePreview ? 'Edit' : 'Preview'}
        </Button>
      }
    >
      <form onSubmit={submit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={cn('space-y-3', mobilePreview && 'hidden lg:block')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Template name" required>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Summer promo" />
              </Field>
              <Field label="Channel">
                <Select
                  value={form.channel}
                  onChange={v => setForm(p => ({
                    ...p,
                    channel: v,
                    body_text: isRichChannel(v) && !p.body_text ? DEFAULT_WHATSAPP_BODY : p.body_text,
                  }))}
                  options={[
                    { value: 'whatsapp', label: 'WhatsApp' },
                    { value: 'sms', label: 'SMS' },
                    { value: 'email', label: 'Email' },
                  ]}
                />
              </Field>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className="flex-1 min-w-0">
                <Field label={rich ? 'Internal title' : 'Subject line'} required>
                  <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                    placeholder={rich ? 'e.g. Swarna Ashadam sale' : 'e.g. Special offer for {{contact.first_name}}'} />
                </Field>
              </div>
              {rich && <LoadPromoSampleButton onLoad={loadPromoSample} />}
            </div>
            <Field label="Description (optional)">
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Internal note about this template" />
            </Field>

            {rich ? (
              <>
                <Field label="Header video or image">
                  <input ref={headerRef} type="file" accept="image/*,video/*" className="hidden"
                    onChange={e => handleHeaderUpload(e.target.files)} />
                  <div className="space-y-2">
                    <Button type="button" variant="outline" size="sm" disabled={uploading}
                      onClick={() => headerRef.current?.click()}>
                      {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Video className="w-4 h-4 mr-1" />}
                      Upload header media
                    </Button>
                    {headerAttachment(form.attachments) && (
                      <div className="relative rounded-lg border overflow-hidden bg-gray-900 max-w-xs">
                        {headerAttachment(form.attachments)!.type === 'video' ? (
                          <video src={headerAttachment(form.attachments)!.url} className="w-full h-32 object-cover" muted />
                        ) : (
                          <img src={headerAttachment(form.attachments)!.url} alt="" className="w-full h-32 object-cover" />
                        )}
                        <Button type="button" size="sm" variant="destructive" className="absolute top-2 right-2 h-7 text-xs"
                          onClick={() => setForm(p => ({ ...p, attachments: p.attachments.filter(a => !a.is_header) }))}>
                          Remove
                        </Button>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400">Shown at the top of the message — like a promo video banner.</p>
                  </div>
                </Field>
                <Field label="Message body" required>
                  <RichMessageEditor
                    value={form.body_text}
                    onChange={v => setForm(p => ({
                      ...p,
                      body_text: v,
                      body_html: resolveEmailBodyHtml(p.body_html, v),
                    }))}
                    placeholder="*Celebrate bigger and shop smarter!* 🌟"
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="CTA button label">
                    <Input value={form.settings.cta_label || ''}
                      onChange={e => setForm(p => ({ ...p, settings: { ...p.settings, cta_label: e.target.value } }))}
                      placeholder="Explore Now" />
                  </Field>
                  <Field label="CTA button link">
                    <Input value={form.settings.cta_url || ''}
                      onChange={e => setForm(p => ({ ...p, settings: { ...p.settings, cta_url: e.target.value } }))}
                      placeholder="https://yourstore.com/sale" />
                  </Field>
                </div>
                <Field label="Footer (T&C, unsubscribe)">
                  <textarea
                    value={form.settings.footer_text || ''}
                    onChange={e => setForm(p => ({ ...p, settings: { ...p.settings, footer_text: e.target.value } }))}
                    rows={3}
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    placeholder={DEFAULT_WHATSAPP_FOOTER}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field label="Email body">
                  <EmailBodyEditor
                    value={form.body_html}
                    onChange={v => setForm(p => ({ ...p, body_html: v }))}
                    plainText={form.body_text}
                    onPlainTextChange={v => setForm(p => ({ ...p, body_text: v }))}
                  />
                </Field>
                <Field label="Images & videos">
                  <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
                    onChange={e => handleUpload(e.target.files)} />
                  <div className="space-y-2">
                    <Button type="button" variant="outline" size="sm" disabled={uploading}
                      onClick={() => fileRef.current?.click()}>
                      {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-1" />}
                      Attach image or video
                    </Button>
                    {form.attachments.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {form.attachments.map((att, idx) => (
                          <div key={idx} className="relative rounded-lg border overflow-hidden bg-gray-50 group">
                            {att.type === 'video' ? (
                              <video src={att.url} className="w-full h-24 object-cover" />
                            ) : (
                              <img src={att.url} alt="" className="w-full h-24 object-cover" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                              <Button type="button" size="sm" variant="secondary" className="h-7 text-xs"
                                onClick={() => insertAttachment(att)}>Insert</Button>
                              <Button type="button" size="sm" variant="destructive" className="h-7 text-xs"
                                onClick={() => removeAttachment(idx)}>Remove</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
              </>
            )}
            <ActiveToggle checked={form.is_active} onChange={v => setForm(p => ({ ...p, is_active: v }))} />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="cancel" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={save.isPending || uploading}>
                {save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Save template
              </Button>
            </div>
          </div>

          <div className={cn(
            'rounded-xl border bg-white p-4 lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto',
            !mobilePreview && 'hidden lg:block',
          )}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-semibold text-gray-900">Live preview</p>
              </div>
              <PreviewChannelTabs value={previewChannel} onChange={setPreviewChannel} />
            </div>
            <MarketingTemplatePreview
              channel={previewChannel}
              tpl={{
                subject: form.subject,
                body_html: form.body_html,
                body_text: form.body_text,
                channel: form.channel,
                attachments: form.attachments,
                settings: form.settings,
              }}
              defaultView="mobile"
            />
          </div>
        </div>
      </form>
    </CrmModal>
  )
}

function templateIsUsable(tpl: EmailTemplate): boolean {
  return tpl.is_active
}

export default function CampaignTemplatesPanel({
  onCreateCampaign,
}: {
  onCreateCampaign: (tpl: EmailTemplate) => void
}) {
  const qc = useQueryClient()
  const save = useSaveTemplate()
  const { data, isLoading } = useEmailTemplates()
  const [edit, setEdit] = useState<EmailTemplate | null>(null)
  const [preview, setPreview] = useState<EmailTemplate | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const toggleActive = async (tpl: EmailTemplate) => {
    try {
      await save.mutateAsync({
        id: tpl.id,
        data: {
          ...templatePayload({
            name: tpl.name,
            subject: tpl.subject,
            description: tpl.description || '',
            channel: tpl.channel || 'email',
            body_html: tpl.body_html,
            body_text: tpl.body_text || '',
            attachments: tpl.attachments ?? [],
            settings: readTemplateSettings(tpl.settings),
            is_active: !tpl.is_active,
          }),
        },
      })
      await qc.invalidateQueries({ queryKey: ['crm', 'templates'] })
      toast.success(tpl.is_active ? 'Template deactivated' : 'Template activated')
    } catch (err) {
      toast.error(extractApiError(err, 'Could not update template'))
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this template?')) return
    try {
      await crmApi.deleteTemplate(id)
      await qc.invalidateQueries({ queryKey: ['crm', 'templates'] })
      toast.success('Template deleted')
    } catch (err) {
      toast.error(extractApiError(err, 'Could not delete template'))
    }
  }

  const templates = data ?? []

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Marketing Templates</h2>
          <p className="text-sm text-gray-500">Create reusable templates with images or videos, preview live, then launch campaigns.</p>
        </div>
        <Button variant="outline" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : !templates.length ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-3">No templates yet. Build one with your branding, attach media, preview it, then create a campaign.</p>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-1" /> Create first template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map(t => {
            const thumb = templateThumb(t)
            const usable = templateIsUsable(t)
            return (
              <Card key={t.id} className={!t.is_active ? 'opacity-75' : undefined}>
                <CardContent className="p-0">
                  <div
                    className="relative h-32 bg-gradient-to-br from-gray-100 to-gray-50 border-b overflow-hidden cursor-pointer group/thumb"
                    onClick={() => setPreview(t)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setPreview(t)}
                  >
                    {thumb ? (
                      thumb.type === 'video' ? (
                        <video src={thumb.url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={thumb.url} alt="" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Mail className="w-10 h-10 text-gray-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/30 transition flex items-center justify-center opacity-0 group-hover/thumb:opacity-100">
                      <span className="text-white text-xs font-medium flex items-center gap-1 bg-black/50 px-3 py-1.5 rounded-full">
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </span>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Badge variant={t.is_active ? 'success' : 'secondary'} className="text-[10px]">
                        {t.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold truncate">{t.name}</h3>
                        <p className="text-xs text-gray-500 line-clamp-1">{t.subject}</p>
                      </div>
                      <Badge variant="soft" className="shrink-0 text-[10px]">{t.channel || 'email'}</Badge>
                    </div>
                    {t.description && <p className="text-xs text-gray-400 line-clamp-2">{t.description}</p>}
                    <div className="flex flex-wrap gap-1 pt-2 border-t">
                      <Button variant="ghost" size="sm" title="Preview" onClick={() => setPreview(t)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Edit" onClick={() => setEdit(t)}>
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title={t.is_active ? 'Deactivate' : 'Activate'} onClick={() => toggleActive(t)}>
                        {t.is_active ? <PowerOff className="w-4 h-4 text-amber-600" /> : <Power className="w-4 h-4 text-emerald-600" />}
                      </Button>
                      <Button variant="ghost" size="sm" title="Create campaign" disabled={!usable}
                        onClick={() => onCreateCampaign(t)}>
                        <PlayCircle className="w-4 h-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Delete" onClick={() => remove(t.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <Button size="sm" className="w-full" disabled={!usable} onClick={() => onCreateCampaign(t)}>
                      <Megaphone className="w-4 h-4 mr-1" /> Create campaign from template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {showCreate && <TemplateForm onClose={() => setShowCreate(false)} />}
      {edit && <TemplateForm tpl={edit} onClose={() => setEdit(null)} />}
      {preview && <TemplatePreviewModal tpl={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
