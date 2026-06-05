import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/PhoneInput'
import type { QuoteFormField } from '@/types'
import { QuoteFileField } from './QuoteFileField'
import { QuoteLocationField } from './QuoteLocationField'

type Props = {
  field: QuoteFormField
  value: string
  onChange: (value: string) => void
  inputClassName: (key: string) => string
  readOnly?: boolean
  readOnlyClassName?: string
  today?: string
}

export function QuoteFormFieldInput({
  field,
  value,
  onChange,
  inputClassName,
  readOnly = false,
  readOnlyClassName = '',
  today,
}: Props) {
  const locked = readOnly
  const cls = `${inputClassName(field.key)} ${locked ? readOnlyClassName : ''}`

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          value={value}
          onChange={(e) => !locked && onChange(e.target.value)}
          readOnly={locked}
          placeholder={field.placeholder}
          rows={3}
          className={`${cls} resize-none`}
        />
      )
    case 'date':
      return (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={today}
          className={inputClassName(field.key)}
        />
      )
    case 'time':
      return (
        <Input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName(field.key)}
        />
      )
    case 'number':
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          min="0"
          className={inputClassName(field.key)}
        />
      )
    case 'select':
      return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClassName(field.key)}>
          <option value="">{field.placeholder || 'Select...'}</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    case 'phone':
      return (
        <PhoneInput
          value={value}
          onChange={(v) => !locked && onChange(v)}
          disabled={locked}
          defaultCountryIso="IN"
          className={inputClassName(field.key)}
        />
      )
    case 'document':
      return (
        <QuoteFileField
          kind="document"
          value={value}
          onChange={onChange}
          placeholder={field.placeholder}
          disabled={locked}
        />
      )
    case 'photo_video':
      return (
        <QuoteFileField
          kind="photo_video"
          value={value}
          onChange={onChange}
          placeholder={field.placeholder}
          disabled={locked}
        />
      )
    case 'photo_document':
      return (
        <QuoteFileField
          kind="photo_document"
          value={value}
          onChange={onChange}
          placeholder={field.placeholder}
          disabled={locked}
        />
      )
    case 'location':
      return (
        <QuoteLocationField
          value={value}
          onChange={onChange}
          placeholder={field.placeholder || 'Address or landmark'}
          inputClassName={inputClassName(field.key)}
          disabled={locked}
        />
      )
    default:
      return (
        <Input
          type={field.type === 'email' ? 'email' : 'text'}
          value={value}
          onChange={(e) => !locked && onChange(e.target.value)}
          readOnly={locked}
          placeholder={field.placeholder}
          className={cls}
        />
      )
  }
}
