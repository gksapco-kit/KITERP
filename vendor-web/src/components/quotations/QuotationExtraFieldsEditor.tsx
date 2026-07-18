import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { vendorApi } from '@/api/vendor'
import { toast } from 'sonner'
import { Plus, Trash2, X, Link2, Mail, Phone, ImageIcon, Type } from 'lucide-react'
import { ImageSourcePicker } from '@/components/common/ImageSourcePicker'
import {
  ClickableImageButton,
  ImageLightboxSession,
  urlsToLightboxItems,
} from '@/components/common/CatalogMediaLightbox'
import {
  QUOTATION_EXTRA_FIELD_TYPES,
  getQuotationImageUrls,
  newQuotationExtraField,
  quotationFieldHasContent,
  type QuotationExtraField,
  type QuotationExtraFieldType,
} from '@/types/quotation'
import { resolveMediaUrl } from '@/lib/printUtils'
import { cn } from '@/lib/utils'

function QuotationImageThumbnails({
  field,
  editable,
  onOpen,
  onRemove,
  thumbnailClassName = 'h-16 w-16',
}: {
  field: QuotationExtraField
  editable?: boolean
  onOpen: (imageIndex: number) => void
  onRemove?: (imageIndex: number) => void
  thumbnailClassName?: string
}) {
  const urls = getQuotationImageUrls(field)
  if (urls.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((url, imgIdx) => (
        <div key={`${field.id}-${imgIdx}-${url}`} className="relative group">
          <ClickableImageButton
            src={resolveMediaUrl(url)}
            alt={`${field.label || 'Image'} ${imgIdx + 1}`}
            title={editable ? 'View and edit image' : 'View image'}
            className="rounded-lg border bg-white"
            imgClassName={`${thumbnailClassName} object-cover`}
            onClick={() => onOpen(imgIdx)}
          />
          {editable && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(imgIdx)
              }}
              className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-white border shadow text-red-500"
              aria-label="Remove image"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

const TYPE_ICONS: Record<QuotationExtraFieldType, React.ElementType> = {
  text: Type,
  email: Mail,
  phone: Phone,
  link: Link2,
  image: ImageIcon,
}

export function QuotationExtraFieldsEditor({
  fields,
  onChange,
  compact = false,
}: {
  fields: QuotationExtraField[]
  onChange: (fields: QuotationExtraField[]) => void
  compact?: boolean
}) {
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [lightboxFieldId, setLightboxFieldId] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const lightboxField = useMemo(
    () => fields.find(f => f.id === lightboxFieldId) ?? null,
    [fields, lightboxFieldId],
  )

  const closeLightbox = () => {
    setLightboxFieldId(null)
    setLightboxIndex(null)
  }

  const openLightbox = (fieldId: string, imageIndex: number) => {
    setLightboxFieldId(fieldId)
    setLightboxIndex(imageIndex)
  }

  const lightboxItems = useMemo(
    () => (lightboxField
      ? urlsToLightboxItems(getQuotationImageUrls(lightboxField), {
          idPrefix: lightboxField.id,
          altText: (i) => lightboxField.label || `Image ${i + 1}`,
        })
      : []),
    [lightboxField],
  )

  const saveEditedImage = async (imageIndex: number, file: File) => {
    if (!lightboxFieldId) return
    const field = fields.find(f => f.id === lightboxFieldId)
    if (!field) return
    const result = await vendorApi.uploadVendorBrandingAsset(file)
    const urls = [...getQuotationImageUrls(field)]
    urls[imageIndex] = result.url
    updateField(lightboxFieldId, { values: urls, value: urls[0] || '' })
  }

  const updateField = (id: string, patch: Partial<QuotationExtraField>) => {
    onChange(fields.map(f => (f.id === id ? { ...f, ...patch } : f)))
  }

  const removeField = (id: string) => {
    onChange(fields.filter(f => f.id !== id))
  }

  const appendImages = (id: string, urls: string[]) => {
    if (!urls.length) return
    const field = fields.find(f => f.id === id)
    if (!field) return
    const merged = [...getQuotationImageUrls(field), ...urls]
    updateField(id, { values: merged, value: merged[0] || '' })
  }

  const removeImageAt = (id: string, index: number) => {
    const field = fields.find(f => f.id === id)
    if (!field) return
    const next = getQuotationImageUrls(field).filter((_, i) => i !== index)
    updateField(id, { values: next, value: next[0] || '' })
  }

  const handleImagesUpload = async (id: string, files: File[]) => {
    if (!files.length) return
    setUploadingId(id)
    try {
      const urls: string[] = []
      for (const file of files) {
        const result = await vendorApi.uploadVendorBrandingAsset(file)
        urls.push(result.url)
      }
      appendImages(id, urls)
      toast.success(urls.length > 1 ? `${urls.length} images added` : 'Image added')
    } catch {
      toast.error('Could not upload image — use PNG or JPG under 2MB')
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>Additional Fields</Label>
          <p className="text-xs text-gray-400 mt-0.5">Add custom info — links, images, contact details, notes, etc.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 shrink-0"
          onClick={() => onChange([...fields, newQuotationExtraField()])}
        >
          <Plus className="w-3.5 h-3.5" /> Add Field
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-gray-400 border border-dashed rounded-lg px-4 py-6 text-center">
          No extra fields yet. Click <span className="font-medium text-gray-600">Add Field</span> to include links, images, or other details on this quotation.
        </p>
      ) : (
        <div className="space-y-3">
          {fields.map((field, index) => {
            const Icon = TYPE_ICONS[field.type]
            return (
              <div key={field.id} className="border rounded-lg p-3 bg-gray-50/80 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400 w-5">{index + 1}.</span>
                  <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                  <Input
                    placeholder="Field label (e.g. Project brief, Site photo)"
                    value={field.label}
                    onChange={e => updateField(field.id, { label: e.target.value })}
                    className="flex-1 h-8 text-sm bg-white"
                  />
                  <Select
                    className="w-28 shrink-0"
                    triggerClassName="h-8 text-sm"
                    value={field.type}
                    onChange={nextType => updateField(field.id, {
                      type: nextType as QuotationExtraFieldType,
                      value: '',
                      values: nextType === 'image' ? [] : undefined,
                    })}
                    options={QUOTATION_EXTRA_FIELD_TYPES.map(t => ({ value: t.value, label: t.label }))}
                  />
                  <button
                    type="button"
                    onClick={() => removeField(field.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 shrink-0"
                    aria-label="Remove field"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {field.type === 'text' && (
                  <Input
                    placeholder="Enter text value"
                    value={field.value}
                    onChange={e => updateField(field.id, { value: e.target.value })}
                    className="text-sm bg-white"
                  />
                )}
                {field.type === 'email' && (
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={field.value}
                    onChange={e => updateField(field.id, { value: e.target.value })}
                    className="text-sm bg-white"
                  />
                )}
                {field.type === 'phone' && (
                  <PhoneInput
                    value={field.value}
                    onChange={v => updateField(field.id, { value: v })}
                    defaultCountryIso="IN"
                    compactCountry
                  />
                )}
                {field.type === 'link' && (
                  <Input
                    type="url"
                    placeholder="https://example.com/document"
                    value={field.value}
                    onChange={e => updateField(field.id, { value: e.target.value })}
                    className="text-sm bg-white"
                  />
                )}
                {field.type === 'image' && (
                  <div className="space-y-2">
                    <QuotationImageThumbnails
                      field={field}
                      editable
                      onOpen={imgIdx => openLightbox(field.id, imgIdx)}
                      onRemove={imgIdx => removeImageAt(field.id, imgIdx)}
                    />
                    <ImageSourcePicker
                      title="Quotation images"
                      showGallery
                      galleryMultiSelect
                      onFile={file => handleImagesUpload(field.id, [file])}
                      onFiles={files => handleImagesUpload(field.id, files)}
                      onUrl={url => appendImages(field.id, [url])}
                      uploading={uploadingId === field.id}
                      disabled={uploadingId === field.id}
                      buttonLabel="Add images"
                      buttonVariant="outline"
                      buttonSize="sm"
                      buttonClassName="gap-1.5"
                      deviceHint="Select multiple from gallery or device · PNG/JPG · max 2 MB each"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ImageLightboxSession
        items={lightboxItems}
        openIndex={lightboxField && lightboxIndex !== null ? lightboxIndex : null}
        onClose={closeLightbox}
        editable
        onSaveImage={saveEditedImage}
      />
    </div>
  )
}

export function QuotationExtraFieldsDisplay({ fields }: { fields: QuotationExtraField[] }) {
  const visible = fields.filter(quotationFieldHasContent)
  const [lightboxFieldId, setLightboxFieldId] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const lightboxField = useMemo(
    () => visible.find(f => f.id === lightboxFieldId) ?? null,
    [visible, lightboxFieldId],
  )

  const lightboxItems = useMemo(
    () => (lightboxField
      ? urlsToLightboxItems(getQuotationImageUrls(lightboxField), {
          idPrefix: lightboxField.id,
          altText: (i) => lightboxField.label || `Image ${i + 1}`,
        })
      : []),
    [lightboxField],
  )

  if (visible.length === 0) return null

  return (
    <div className="bg-white rounded-xl border p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Additional Information</h3>
      <div className="space-y-3">
        {visible.map(field => (
          <div key={field.id} className="text-sm">
            <p className="text-xs text-gray-400 mb-0.5">{field.label}</p>
            {field.type === 'image' ? (
              <QuotationImageThumbnails
                field={field}
                thumbnailClassName="h-24 w-24"
                onOpen={imgIdx => {
                  setLightboxFieldId(field.id)
                  setLightboxIndex(imgIdx)
                }}
              />
            ) : field.type === 'link' ? (
              <a href={field.value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                {field.value}
              </a>
            ) : field.type === 'email' ? (
              <a href={`mailto:${field.value}`} className="text-blue-600 hover:underline">{field.value}</a>
            ) : field.type === 'phone' ? (
              <a href={`tel:${field.value}`} className="text-gray-700">{field.value}</a>
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap">{field.value}</p>
            )}
          </div>
        ))}
      </div>

      <ImageLightboxSession
        items={lightboxItems}
        openIndex={lightboxField && lightboxIndex !== null ? lightboxIndex : null}
        onClose={() => {
          setLightboxFieldId(null)
          setLightboxIndex(null)
        }}
      />
    </div>
  )
}
