/**
 * ContactFormBlock — P3.6 enhanced
 * Supports: dynamic form_fields, multi-step forms, conditional field display,
 * GDPR consent checkbox, file uploads (via signed URL), and webhook notifications.
 *
 * Layouts: split (info/photo + form), stacked (info + form + optional map),
 * centered, card, inline, minimal — plus full_page, bg_style (dark), image_position,
 * columns and show_map modifiers.
 */
import { useState, useRef, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Mail, Phone, MapPin, Send, Loader2, ChevronRight, ChevronLeft, Upload, Image as ImageIcon } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { publicSitesApi } from '@/api/publicSites'
import { cn, imgUrl } from '@/lib/utils'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderSectionImage } from '@/components/builder/BuilderSectionImage'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { useEffectiveVendor } from '@/hooks/useEffectiveVendor'
import { recallDraftEmbedPreviewToken } from '@/lib/draftEmbedPreview'
import { builderSectionContainerWithMax } from '@/lib/builderSectionLayout'
import { extractApiError } from '@/lib/errorMessages'
import {
  resolveBusinessContactAddress,
  resolveBusinessContactEmail,
  resolveBusinessContactPhone,
} from '@/lib/businessContact'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'

interface FormField {
  name: string
  label?: string
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox' | 'file' | 'hidden'
  required?: boolean
  placeholder?: string
  options?: string[]  // for select
  condition?: { field: string; equals: string }  // show only if another field has value
  step?: number  // multi-step group
}

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

function resolvePageIdForBlock(site: PublicSite, blockId?: string): string | undefined {
  if (!blockId) return undefined
  return site.pages?.find(page => page.blocks?.some(block => block.id === blockId))?.id
}

function isPersistableBlockId(blockId?: string): boolean {
  if (!blockId) return false
  if (blockId.startsWith('temp-')) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(blockId)
}

export default function ContactFormBlock({ site, style, props, liveItems, blockId }: Props) {
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const [searchParams] = useSearchParams()
  const vendor = useEffectiveVendor()
  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : 'Get In Touch'),
  })
  const showGdpr = props.show_gdpr !== false
  const isMultiStep = props.multi_step === true
  const successMsg = (props.success_message as string) || "We'll get back to you shortly."

  const layout = String(props.layout ?? 'split')
  const fullPage = props.full_page === true
  const bgStyle = String(props.bg_style ?? 'light')
  const isDark = bgStyle === 'dark'
  const showMap = props.show_map === true
  const imagePosition = props.image_position as string | undefined
  const columns = Number(props.columns) === 2 ? 2 : 1

  const isSplit = layout === 'split'
  const isStacked = layout === 'stacked'
  const isCard = layout === 'card'
  const isInline = layout === 'inline'
  const isMinimal = layout === 'minimal'
  const showInfoPanel = isSplit || isStacked
  const useSideImage = isSplit && !!imagePosition
  const imageOnRight = imagePosition === 'right'

  const profile = liveItems?.[0]
  const phoneFromBusiness = resolveBusinessContactPhone(undefined, profile, vendor)
  const emailFromBusiness = resolveBusinessContactEmail(undefined, profile, vendor)
  const addressFromBusiness = resolveBusinessContactAddress(
    undefined,
    profile,
    vendor,
  )
  // Live storefront: Business Settings / BU only. Editor may preview block props when unset.
  const phone = isBlockFieldHidden(props, 'phone')
    ? null
    : phoneFromBusiness
      || (isEditorCanvas ? String(props.phone ?? '').trim() : '')
      || null
  const emailAddr = isBlockFieldHidden(props, 'email')
    ? null
    : emailFromBusiness
      || (isEditorCanvas ? String(props.email ?? '').trim() : '')
      || null
  const address = isBlockFieldHidden(props, 'address')
    ? null
    : addressFromBusiness
      || (isEditorCanvas ? String(props.address ?? '').trim() : '')
      || null

  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)

  const sideImageHidden = isBlockFieldHidden(props, 'bg_image_url')
  const sideImageRaw = useSideImage && !sideImageHidden ? (props.bg_image_url as string | undefined) : undefined
  const sideImageUrl = sideImageRaw ? imgUrl(sideImageRaw) : undefined

  const mapSrc = showMap && address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed` : null

  const defaultFields: FormField[] = [
    { name: 'name', label: 'Full Name', type: 'text', required: true, placeholder: 'Your Name', step: 1 },
    { name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'your@email.com', step: 1 },
    { name: 'phone', label: 'Phone (optional)', type: 'tel', required: false, placeholder: 'Mobile number', step: 1 },
    { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'How can we help you?', step: 2 },
  ]
  const minimalDefaultFields: FormField[] = [
    { name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'your@email.com', step: 1 },
    { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'How can we help you?', step: 1 },
  ]

  const fields: FormField[] =
    (props.form_fields as FormField[] | undefined) || (isMinimal ? minimalDefaultFields : defaultFields)

  // Number of steps
  const maxStep = Math.max(...fields.map(f => f.step || 1), 1)
  const [currentStep, setCurrentStep] = useState(1)
  const [values, setValues] = useState<Record<string, string>>({})
  const [gdprConsent, setGdprConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fileUploads, setFileUploads] = useState<Record<string, File>>({})
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const formStartedAt = useRef(Date.now())
  const [hpWebsite, setHpWebsite] = useState('')

  const setValue = (name: string, value: string) => setValues(v => ({ ...v, [name]: value }))

  const isVisible = (field: FormField) => {
    if (!field.condition) return true
    return values[field.condition.field] === field.condition.equals
  }

  const stepFields = fields.filter(f => (f.step || 1) === currentStep && isVisible(f))

  const canProceed = stepFields.every(f => !f.required || values[f.name])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isMultiStep && currentStep < maxStep) {
      setCurrentStep(s => s + 1)
      return
    }
    setLoading(true)
    setSubmitError(null)
    try {
      const payload: Record<string, unknown> = {
        ...values,
        gdpr_consent: gdprConsent,
        form_type: 'contact',
        hp_website: hpWebsite,
        form_started_at: formStartedAt.current,
      }
      const pageId = resolvePageIdForBlock(site, blockId)
      if (pageId) payload.page_id = pageId
      if (isPersistableBlockId(blockId)) payload.block_id = blockId

      if (builderCanvas?.submitContactForm) {
        await builderCanvas.submitContactForm(site.id, payload)
      } else {
        const previewToken =
          searchParams.get('preview_token')?.trim()
          || searchParams.get('token')?.trim()
          || recallDraftEmbedPreviewToken()
          || undefined
        await publicSitesApi.submitContact(site.id, payload, { previewToken })
      }
      setDone(true)
    } catch (err) {
      setSubmitError(extractApiError(err, 'Could not send your message'))
    } finally {
      setLoading(false)
    }
  }

  const primary = style.primary_color || '#64C3A0'

  const labelClass = cn('text-xs font-medium block mb-1', isDark ? 'text-white/80' : 'text-gray-700')
  const inputBaseClass = cn(
    'w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent',
    isDark ? 'bg-white/10 border border-white/20 text-white placeholder:text-white/40' : 'border border-gray-200',
  )
  const mutedTextClass = isDark ? 'text-white/60' : 'text-gray-600'

  const titleNode = (className: string) => (
    <BuilderTextField
      fieldKey="title"
      blockId={blockId}
      blockProps={props}
      value={title ?? ''}
      as="h2"
      className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900', className)}
      placeholder="Section title"
    />
  )

  const infoPanel = (emailAddr || phone || address || isEditorCanvas) ? (
    <div className={cn(isStacked ? 'flex flex-wrap justify-center gap-6' : 'space-y-4 mt-8')}>
      {emailAddr && (
        <div className={cn('flex items-center gap-3', mutedTextClass)}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${primary}15` }}>
            <Mail className="w-5 h-5" style={{ color: primary }} />
          </div>
          <span>{emailAddr}</span>
        </div>
      )}
      {phone && (
        <div className={cn('flex items-center gap-3', mutedTextClass)}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${primary}15` }}>
            <Phone className="w-5 h-5" style={{ color: primary }} />
          </div>
          <span>{phone}</span>
        </div>
      )}
      {address && (
        <div className={cn('flex items-center gap-3', mutedTextClass)}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${primary}15` }}>
            <MapPin className="w-5 h-5" style={{ color: primary }} />
          </div>
          <span>{address}</span>
        </div>
      )}
    </div>
  ) : null

  const imagePanel = (
    <div className={cn('relative w-full h-64 lg:h-full min-h-[280px] rounded-2xl overflow-hidden', isDark ? 'bg-white/5' : 'bg-gray-100')}>
      {sideImageUrl ? (
        <BuilderSectionImage
          blockId={blockId}
          field="bg_image_url"
          blockProps={props}
          src={sideImageUrl}
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <div className={cn('absolute inset-0 flex flex-col items-center justify-center gap-1', isDark ? 'text-white/30' : 'text-gray-400')}>
          <ImageIcon className="w-8 h-8 opacity-60" aria-hidden="true" />
          {isEditorCanvas && <span className="text-xs font-medium">Add photo</span>}
        </div>
      )}
    </div>
  )

  const mapBlock = showMap ? (
    <div className={cn('w-full h-64 sm:h-72 rounded-2xl overflow-hidden border mt-8', isDark ? 'border-white/10' : 'border-gray-200 shadow-sm')}>
      {mapSrc ? (
        <iframe
          src={mapSrc}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Map"
        />
      ) : (
        <div className={cn('w-full h-full flex items-center justify-center', isDark ? 'bg-white/5 text-white/30' : 'bg-gray-100 text-gray-400')}>
          <div className="text-center">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Add an address to show the map</p>
          </div>
        </div>
      )}
    </div>
  ) : null

  const fieldsWrapClass = isInline
    ? 'flex flex-wrap gap-3 items-end'
    : columns === 2
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
      : 'space-y-4'

  // Multi-line / bulky field types don't fit a horizontal "inline" bar — let them
  // break onto their own full-width row instead of squeezing the row's height.
  const isBulkyField = (field: FormField) => ['textarea', 'checkbox', 'file'].includes(field.type)
  const isPhoneField = (field: FormField) =>
    field.type === 'tel' || /^(phone|mobile|whatsapp)$/i.test(field.name)

  const fieldItemClass = (field: FormField) => cn(
    isInline && (isBulkyField(field) ? 'w-full basis-full' : 'flex-1 min-w-[160px]'),
    columns === 2 && !isInline && isBulkyField(field) && 'sm:col-span-2',
  )

  const doneContent = (
    <div className="text-center py-8">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primary}15` }}>
        <Send className="w-8 h-8" style={{ color: primary }} />
      </div>
      <h3 className={cn('text-xl font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>Message Sent!</h3>
      <p className={mutedTextClass}>{successMsg}</p>
    </div>
  )

  const formEl = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Website
          <input
            type="text"
            name="hp_website"
            tabIndex={-1}
            autoComplete="off"
            value={hpWebsite}
            onChange={(e) => setHpWebsite(e.target.value)}
          />
        </label>
      </div>
      {/* Multi-step progress bar */}
      {isMultiStep && maxStep > 1 && (
        <div className="flex gap-1 mb-2">
          {Array.from({ length: maxStep }, (_, i) => (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full transition-all"
              style={{ backgroundColor: i + 1 <= currentStep ? primary : (isDark ? 'rgba(255,255,255,0.15)' : '#e5e7eb') }}
            />
          ))}
        </div>
      )}

      {/* Step label */}
      {isMultiStep && maxStep > 1 && (
        <p className={cn('text-xs', isDark ? 'text-white/40' : 'text-gray-400')}>Step {currentStep} of {maxStep}</p>
      )}

      <div className={fieldsWrapClass}>
        {stepFields.map(field => (
          <div key={field.name} className={fieldItemClass(field)}>
            {field.label && (
              <label className={labelClass}>
                {field.label}{field.required && ' *'}
              </label>
            )}

            {field.type === 'textarea' && (
              <textarea
                placeholder={field.placeholder || field.label}
                required={field.required}
                rows={4}
                value={values[field.name] || ''}
                onChange={e => setValue(field.name, e.target.value)}
                className={cn(inputBaseClass, 'resize-none')}
                style={{ '--tw-ring-color': primary } as React.CSSProperties}
              />
            )}

            {field.type === 'select' && (
              <select
                required={field.required}
                value={values[field.name] || ''}
                onChange={e => setValue(field.name, e.target.value)}
                className={inputBaseClass}
              >
                <option value="">Select an option…</option>
                {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            )}

            {field.type === 'checkbox' && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values[field.name] === 'true'}
                  onChange={e => setValue(field.name, e.target.checked ? 'true' : 'false')}
                  className="mt-0.5 rounded accent-primary"
                />
                <span className={cn('text-sm', mutedTextClass)}>{field.placeholder || field.label}</span>
              </label>
            )}

            {field.type === 'file' && (
              <div>
                <input
                  ref={el => { fileRefs.current[field.name] = el }}
                  type="file"
                  required={field.required}
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) setFileUploads(f => ({ ...f, [field.name]: file }))
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRefs.current[field.name]?.click()}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 border border-dashed rounded-xl text-sm transition-colors w-full justify-center',
                    isDark ? 'border-white/25 text-white/60 hover:border-white/50' : 'border-gray-300 text-gray-500 hover:border-current',
                  )}
                  style={{ '--hover-color': primary } as React.CSSProperties}
                >
                  <Upload className="w-4 h-4" />
                  {fileUploads[field.name] ? fileUploads[field.name].name : (field.placeholder || 'Upload File')}
                </button>
              </div>
            )}

            {isPhoneField(field) && (
              <PhoneInput
                id={`contact-${field.name}`}
                name={field.name}
                value={values[field.name] || ''}
                onChange={v => setValue(field.name, v)}
                placeholder={field.placeholder || 'Mobile number'}
                defaultCountryIso="IN"
                autoComplete="tel"
                showStatusHints={false}
                showErrorMessage={false}
              />
            )}

            {!isPhoneField(field) && !['textarea', 'select', 'checkbox', 'file', 'hidden'].includes(field.type) && (
              <input
                type={field.type}
                placeholder={field.placeholder || field.label}
                required={field.required}
                value={values[field.name] || ''}
                onChange={e => setValue(field.name, e.target.value)}
                className={inputBaseClass}
                style={{ '--tw-ring-color': primary } as React.CSSProperties}
              />
            )}
          </div>
        ))}
      </div>

      {/* GDPR consent (shown on last step) */}
      {showGdpr && (!isMultiStep || currentStep === maxStep) && (
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={gdprConsent}
            onChange={e => setGdprConsent(e.target.checked)}
            required
            className="mt-0.5 rounded accent-primary"
          />
          <span className={cn('text-xs', isDark ? 'text-white/50' : 'text-gray-500')}>
            I agree to the <a href="/privacy" className="underline" style={{ color: primary }}>Privacy Policy</a> and consent to being contacted.
          </span>
        </label>
      )}

      {submitError && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            isDark ? 'border-red-400/40 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700',
          )}
          role="alert"
        >
          {submitError}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-2">
        {isMultiStep && currentStep > 1 && (
          <button
            type="button"
            onClick={() => setCurrentStep(s => s - 1)}
            className={cn(
              'flex-1 py-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1 transition-all',
              isDark ? 'border-white/20 text-white/80 hover:bg-white/10' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
            )}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !canProceed}
          className="flex-1 py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all"
          style={{ backgroundColor: primary }}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isMultiStep && currentStep < maxStep ? (
            <>Next <ChevronRight className="w-4 h-4" /></>
          ) : (
            <><Send className="w-4 h-4" /> Send Message</>
          )}
        </button>
      </div>
    </form>
  )

  const formShellClass = cn(
    'w-full max-h-[90vh] overflow-y-auto',
    isInline || isMinimal
      ? 'bg-transparent'
      : cn(
          'rounded-2xl p-6 sm:p-8',
          isCard
            ? cn('border-2 shadow-xl', isDark ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-white')
            : cn('border shadow-sm', isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-white'),
        ),
  )

  const formBlock = (
    <div className={formShellClass}>
      {done ? doneContent : formEl}
    </div>
  )

  const wrapperStyle: CSSProperties | undefined = isDark ? { background: '#0f172a', color: '#f8fafc' } : undefined

  return (
    <div className="w-full" style={wrapperStyle}>
      <section className={builderSectionContainerWithMax('max-w-6xl')}>
        {isSplit ? (
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {imageOnRight ? (
              <>
                {formBlock}
                {useSideImage ? imagePanel : (
                  <div>
                    {showTitle && titleNode('text-3xl mb-4')}
                    {infoPanel}
                  </div>
                )}
              </>
            ) : (
              <>
                {useSideImage ? imagePanel : (
                  <div>
                    {showTitle && titleNode('text-3xl mb-4')}
                    {infoPanel}
                  </div>
                )}
                {formBlock}
              </>
            )}
          </div>
        ) : isStacked ? (
          <div className="space-y-10">
            {(showTitle || infoPanel) && (
              <div className="text-center">
                {showTitle && titleNode('text-3xl mb-4')}
                {infoPanel}
              </div>
            )}
            <div className="max-w-xl mx-auto w-full">{formBlock}</div>
            {mapBlock}
          </div>
        ) : (
          <div
            className={cn(
              'mx-auto w-full',
              isMinimal ? 'max-w-md' : isInline ? 'max-w-3xl' : 'max-w-xl',
              fullPage && 'min-h-[60vh] flex flex-col items-center justify-center py-8',
            )}
          >
            {showTitle && titleNode(cn('mb-6', isInline ? 'text-2xl' : fullPage ? 'text-center text-4xl' : 'text-center text-2xl'))}
            {formBlock}
            {mapBlock}
          </div>
        )}
      </section>
    </div>
  )
}
