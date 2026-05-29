import { Mail, Send } from 'lucide-react'
import type { Block, FormFieldItem } from '../../types/builder'
import { SectionHeading } from '../builder/SectionHeading'

interface ContactFormBlockProps {
  block: Block
  fields: FormFieldItem[]
  layoutStyle: React.CSSProperties
  interactive?: boolean
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

function renderField(f: FormFieldItem, interactive: boolean) {
  const required = f.required

  if (f.type === 'textarea') {
    return (
      <textarea
        placeholder={f.placeholder}
        className={`${inputClass} min-h-[120px] resize-y`}
        rows={4}
        disabled={!interactive}
        required={required}
      />
    )
  }

  if (f.type === 'select') {
    return (
      <select className={inputClass} disabled={!interactive} required={required} defaultValue="">
        <option value="" disabled>
          {f.placeholder || 'Select an option'}
        </option>
        {f.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }

  return (
    <input
      type={f.type === 'email' || f.type === 'tel' ? f.type : 'text'}
      placeholder={f.placeholder}
      className={inputClass}
      disabled={!interactive}
      required={required}
    />
  )
}

export function ContactFormBlock({ block, fields, layoutStyle, interactive = false }: ContactFormBlockProps) {
  const { props } = block

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-100 bg-gradient-to-r from-brand-50 to-indigo-50 px-6 py-8 dark:border-gray-700 dark:from-brand-950/40 dark:to-indigo-950/30 sm:px-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <SectionHeading
                  title={props.text}
                  subtitle={props.subtitle}
                  styles={block.styles}
                  className="mb-0"
                  centered={false}
                  titleClassName="text-2xl font-bold"
                  subtitleClassName="mt-2 text-sm leading-relaxed"
                />
              </div>
            </div>
          </div>

          <form className="space-y-5 px-6 py-8 sm:px-8" onSubmit={(e) => e.preventDefault()}>
            {fields.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-400">
                No fields yet — add form fields in the properties panel.
              </p>
            ) : (
              fields.map((f) => {
                const fieldId = f.id ?? f.label
                return (
                  <div key={fieldId}>
                    <label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                      {f.label}
                      {f.required && <span className="text-red-500">*</span>}
                    </label>
                    {renderField(f, interactive)}
                  </div>
                )
              })
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={!interactive && fields.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 sm:w-auto"
              >
                <Send className="h-4 w-4" />
                {props.buttonText ?? 'Send Message'}
              </button>
              {props.submitNote && <p className="mt-3 text-center text-xs text-gray-500 sm:text-left">{props.submitNote}</p>}
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
