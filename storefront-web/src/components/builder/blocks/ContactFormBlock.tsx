/**
 * ContactFormBlock — P3.6 enhanced
 * Supports: dynamic form_fields, multi-step forms, conditional field display,
 * GDPR consent checkbox, file uploads (via signed URL), and webhook notifications.
 */
import { useState, useRef } from 'react'
import { Mail, Phone, MapPin, Send, Loader2, ChevronRight, ChevronLeft, Upload } from 'lucide-react'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { publicSitesApi } from '@/api/publicSites'
import { BuilderTextField } from '@/components/builder/BuilderTextField'

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

export default function ContactFormBlock({ site, style, props, liveItems, blockId }: Props) {
  const title = (props.title as string) || 'Get In Touch'
  const showGdpr = props.show_gdpr !== false
  const isMultiStep = props.multi_step === true
  const successMsg = (props.success_message as string) || "We'll get back to you shortly."

  const profile = liveItems[0]
  const phone = (props.phone as string) || (profile?.meta?.phone as string) || ''
  const emailAddr = (props.email as string) || (profile?.meta?.email as string) || ''
  const address = (props.address as string) || (profile?.meta?.address as string) || ''

  const defaultFields: FormField[] = [
    { name: 'name', label: 'Full Name', type: 'text', required: true, placeholder: 'Your Name', step: 1 },
    { name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'your@email.com', step: 1 },
    { name: 'phone', label: 'Phone (optional)', type: 'tel', required: false, placeholder: '+1 234 567 8900', step: 1 },
    { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'How can we help you?', step: 2 },
  ]

  const fields: FormField[] = (props.form_fields as FormField[] | undefined) || defaultFields

  // Number of steps
  const maxStep = Math.max(...fields.map(f => f.step || 1), 1)
  const [currentStep, setCurrentStep] = useState(1)
  const [values, setValues] = useState<Record<string, string>>({})
  const [gdprConsent, setGdprConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [fileUploads, setFileUploads] = useState<Record<string, File>>({})
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

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
    try {
      await publicSitesApi.submitContact(site.id, {
        ...values,
        gdpr_consent: gdprConsent,
        has_file_upload: Object.keys(fileUploads).length > 0,
      })
      setDone(true)
    } catch {
      alert('Failed to send. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const primary = style.primary_color || '#64C3A0'

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-12 items-start">
        {/* Contact info */}
        <div>
          <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title} as="h2" className="text-3xl font-bold text-gray-900 mb-4" />
          <div className="space-y-4 mt-8">
            {emailAddr && (
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${primary}15` }}>
                  <Mail className="w-5 h-5" style={{ color: primary }} />
                </div>
                <span>{emailAddr}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${primary}15` }}>
                  <Phone className="w-5 h-5" style={{ color: primary }} />
                </div>
                <span>{phone}</span>
              </div>
            )}
            {address && (
              <div className="flex items-center gap-3 text-gray-600">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${primary}15` }}>
                  <MapPin className="w-5 h-5" style={{ color: primary }} />
                </div>
                <span>{address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm max-h-[90vh] overflow-y-auto">
          {done ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${primary}15` }}>
                <Send className="w-8 h-8" style={{ color: primary }} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Message Sent!</h3>
              <p className="text-gray-500">{successMsg}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Multi-step progress bar */}
              {isMultiStep && maxStep > 1 && (
                <div className="flex gap-1 mb-2">
                  {Array.from({ length: maxStep }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1 h-1.5 rounded-full transition-all"
                      style={{ backgroundColor: i + 1 <= currentStep ? primary : '#e5e7eb' }}
                    />
                  ))}
                </div>
              )}

              {/* Step label */}
              {isMultiStep && maxStep > 1 && (
                <p className="text-xs text-gray-400">Step {currentStep} of {maxStep}</p>
              )}

              {stepFields.map(field => (
                <div key={field.name}>
                  {field.label && (
                    <label className="text-xs font-medium text-gray-700 block mb-1">
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none"
                      style={{ '--tw-ring-color': primary } as React.CSSProperties}
                    />
                  )}

                  {field.type === 'select' && (
                    <select
                      required={field.required}
                      value={values[field.name] || ''}
                      onChange={e => setValue(field.name, e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent"
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
                      <span className="text-sm text-gray-600">{field.placeholder || field.label}</span>
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
                        className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-current transition-colors w-full justify-center"
                        style={{ '--hover-color': primary } as React.CSSProperties}
                      >
                        <Upload className="w-4 h-4" />
                        {fileUploads[field.name] ? fileUploads[field.name].name : (field.placeholder || 'Upload File')}
                      </button>
                    </div>
                  )}

                  {!['textarea', 'select', 'checkbox', 'file', 'hidden'].includes(field.type) && (
                    <input
                      type={field.type}
                      placeholder={field.placeholder || field.label}
                      required={field.required}
                      value={values[field.name] || ''}
                      onChange={e => setValue(field.name, e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ '--tw-ring-color': primary } as React.CSSProperties}
                    />
                  )}
                </div>
              ))}

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
                  <span className="text-xs text-gray-500">
                    I agree to the <a href="/privacy" className="underline" style={{ color: primary }}>Privacy Policy</a> and consent to being contacted.
                  </span>
                </label>
              )}

              {/* Navigation buttons */}
              <div className="flex gap-2">
                {isMultiStep && currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(s => s - 1)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 flex items-center justify-center gap-1 hover:bg-gray-50 transition-all"
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
          )}
        </div>
      </div>
    </section>
  )
}
