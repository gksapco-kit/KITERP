import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Send } from 'lucide-react'
import { MULTI_STEP_FORM_DEFAULTS } from '../../lib/multiStepFormDefaults'
import { blockThemeGradientStyle, softThemeGradientShellStyle } from '../../lib/themeGradientUtils'
import type { Block, FormFieldItem } from '../../types/builder'
import { SectionHeading } from '../builder/SectionHeading'

interface MultiStepFormBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
}

type StepLayout = 'numbered' | 'tabs' | 'minimal' | 'sidebar'
type StepTheme = 'light' | 'premium' | 'dark'

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

function StepProgress({
  steps,
  current,
  layout,
  showLabels,
  theme,
  onGoTo,
  canNavigate,
}: {
  steps: { id?: string; title: string }[]
  current: number
  layout: StepLayout
  showLabels: boolean
  theme: StepTheme
  onGoTo: (i: number) => void
  canNavigate: boolean
}) {
  const isDark = theme === 'dark'
  const doneClass = isDark ? 'bg-emerald-500 text-white' : 'bg-brand-600 text-white'
  const activeClass = isDark ? 'bg-white text-gray-900 ring-2 ring-white/30' : 'bg-brand-600 text-white ring-4 ring-brand-100'
  const idleClass = isDark ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'

  if (layout === 'minimal') {
    const pct = steps.length > 1 ? ((current + 1) / steps.length) * 100 : 100
    return (
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className={isDark ? 'font-medium text-white/80' : 'font-medium text-gray-600'}>
            Step {current + 1} of {steps.length}
          </span>
          {showLabels && steps[current] && (
            <span className={isDark ? 'text-white/55' : 'text-gray-400'}>{steps[current].title}</span>
          )}
        </div>
        <div className={`h-1.5 overflow-hidden rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100 dark:bg-gray-800'}`}>
          <div className="h-full rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  if (layout === 'sidebar') {
    return (
      <nav className="mb-8 space-y-1 lg:mb-0">
        {steps.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <button
              key={step.id ?? i}
              type="button"
              disabled={!canNavigate}
              onClick={() => canNavigate && onGoTo(i)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                active
                  ? isDark
                    ? 'bg-white/10 font-semibold text-white'
                    : 'bg-brand-50 font-semibold text-brand-800'
                  : done
                    ? isDark
                      ? 'text-emerald-300/90 hover:bg-white/5'
                      : 'text-brand-700 hover:bg-gray-50'
                    : isDark
                      ? 'text-white/45 hover:bg-white/5'
                      : 'text-gray-400 hover:bg-gray-50'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done ? doneClass : active ? activeClass : idleClass
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {showLabels && <span className="truncate">{step.title}</span>}
            </button>
          )
        })}
      </nav>
    )
  }

  const isTabs = layout === 'tabs'

  return (
    <div className={`mb-8 ${isTabs ? 'border-b' : ''} ${isDark ? 'border-white/10' : 'border-gray-100 dark:border-gray-700'}`}>
      <ol className={`flex ${isTabs ? 'gap-1' : 'items-center justify-between'}`}>
        {steps.map((step, i) => {
          const done = i < current
          const active = i === current
          const last = i === steps.length - 1

          if (isTabs) {
            return (
              <li key={step.id ?? i} className="flex-1">
                <button
                  type="button"
                  disabled={!canNavigate}
                  onClick={() => canNavigate && onGoTo(i)}
                  className={`w-full border-b-2 px-2 py-3 text-center text-sm font-medium transition ${
                    active
                      ? 'border-brand-600 text-brand-600'
                      : done
                        ? 'border-transparent text-brand-600/70 hover:text-brand-600'
                        : isDark
                          ? 'border-transparent text-white/40 hover:text-white/70'
                          : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {showLabels ? step.title : `Step ${i + 1}`}
                </button>
              </li>
            )
          }

          return (
            <li key={step.id ?? i} className={`flex flex-1 items-center ${last ? 'flex-none' : ''}`}>
              <button
                type="button"
                disabled={!canNavigate}
                onClick={() => canNavigate && onGoTo(i)}
                className="group flex flex-col items-center gap-2"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${
                    done ? doneClass : active ? activeClass : idleClass
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                {showLabels && (
                  <span
                    className={`max-w-[5.5rem] truncate text-center text-xs font-medium sm:max-w-none ${
                      active
                        ? isDark
                          ? 'text-white'
                          : 'text-gray-900'
                        : isDark
                          ? 'text-white/45'
                          : 'text-gray-400'
                    }`}
                  >
                    {step.title}
                  </span>
                )}
              </button>
              {!last && (
                <div
                  className={`mx-2 h-0.5 flex-1 rounded-full sm:mx-3 ${
                    done ? (isDark ? 'bg-emerald-500/60' : 'bg-brand-300') : isDark ? 'bg-white/10' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function MultiStepFormBlock({ block, layoutStyle, interactive = false }: MultiStepFormBlockProps) {
  const { props, styles } = block
  const layout = (props.multiStepFormLayout ?? MULTI_STEP_FORM_DEFAULTS.multiStepFormLayout) as StepLayout
  const theme = (props.multiStepFormTheme ?? MULTI_STEP_FORM_DEFAULTS.multiStepFormTheme) as StepTheme
  const showProgress = props.showMultiStepProgress !== false
  const showLabels = props.showMultiStepLabels !== false
  const backText = props.multiStepBackText ?? MULTI_STEP_FORM_DEFAULTS.multiStepBackText
  const nextText = props.multiStepNextText ?? MULTI_STEP_FORM_DEFAULTS.multiStepNextText
  const submitText = props.multiStepSubmitText ?? MULTI_STEP_FORM_DEFAULTS.multiStepSubmitText

  const steps = (props.multiStepFormSteps ?? []).filter((s) => s.enabled !== false)
  const [current, setCurrent] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const canInteract = interactive
  const safeCurrent = steps.length === 0 ? 0 : Math.min(current, steps.length - 1)
  const step = steps[safeCurrent]
  const isLast = safeCurrent >= steps.length - 1
  const isDark = theme === 'dark'

  const shellClass = isDark
    ? 'border border-white/10 bg-gray-900/80 shadow-2xl'
    : theme === 'premium'
      ? 'border border-gray-200/80 bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.15)] ring-1 ring-gray-100 dark:border-gray-700 dark:bg-gray-900/50 dark:ring-gray-800'
      : 'border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800'

  const goNext = () => {
    if (!canInteract) return
    if (isLast) setSubmitted(true)
    else setCurrent((c) => Math.min(c + 1, steps.length - 1))
  }

  const goBack = () => {
    if (!canInteract) return
    setCurrent((c) => Math.max(c - 1, 0))
  }

  if (steps.length === 0) {
    return (
      <section style={layoutStyle} className="w-full py-12 text-center text-sm text-gray-400">
        Add steps in the properties panel
      </section>
    )
  }

  const formBody = submitted ? (
    <div className="flex flex-col items-center justify-center py-12 text-center sm:py-16">
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
        <Check className="h-7 w-7" />
      </div>
      <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {props.multiStepSuccessTitle ?? MULTI_STEP_FORM_DEFAULTS.multiStepSuccessTitle}
      </h3>
      <p className={`mt-2 max-w-sm text-sm leading-relaxed ${isDark ? 'text-white/65' : 'text-gray-500'}`}>
        {props.multiStepSuccessMessage ?? MULTI_STEP_FORM_DEFAULTS.multiStepSuccessMessage}
      </p>
      {canInteract && (
        <button
          type="button"
          onClick={() => {
            setSubmitted(false)
            setCurrent(0)
          }}
          className="mt-6 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Start over
        </button>
      )}
    </div>
  ) : (
    <>
      {showProgress && layout !== 'sidebar' && (
        <StepProgress
          steps={steps}
          current={safeCurrent}
          layout={layout}
          showLabels={showLabels}
          theme={theme}
          onGoTo={setCurrent}
          canNavigate={canInteract}
        />
      )}

      {step && (
        <div className="mb-6">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{step.title}</h3>
          {step.description && (
            <p className={`mt-1 text-sm ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{step.description}</p>
          )}
        </div>
      )}

      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        {(step?.fields ?? []).map((f) => {
          const fieldId = f.id ?? f.label
          return (
            <div key={fieldId}>
              <label className={`mb-1.5 flex items-center gap-1 text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                {f.label}
                {f.required && <span className="text-red-500">*</span>}
              </label>
              {renderField(f, canInteract)}
            </div>
          )
        })}

        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
          <div>
            {safeCurrent > 0 ? (
              <button
                type="button"
                onClick={goBack}
                disabled={!canInteract}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  isDark
                    ? 'text-white/80 hover:bg-white/10'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                <ArrowLeft className="h-4 w-4" />
                {backText}
              </button>
            ) : (
              props.submitNote && (
                <p className={`text-xs ${isDark ? 'text-white/45' : 'text-gray-400'}`}>{props.submitNote}</p>
              )
            )}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={!canInteract}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60"
          >
            {isLast ? (
              <>
                <Send className="h-4 w-4" />
                {submitText}
              </>
            ) : (
              <>
                {nextText}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </>
  )

  const inner = (
    <div className={`overflow-hidden rounded-2xl ${shellClass}`}>
      <div className={`px-6 py-8 sm:px-10 sm:py-10 ${layout === 'sidebar' ? 'lg:grid lg:grid-cols-[220px_1fr] lg:gap-10' : ''}`}>
        {layout === 'sidebar' && showProgress && !submitted && (
          <StepProgress
            steps={steps}
            current={safeCurrent}
            layout={layout}
            showLabels={showLabels}
            theme={theme}
            onGoTo={setCurrent}
            canNavigate={canInteract}
          />
        )}
        <div>{formBody}</div>
      </div>
    </div>
  )

  if (isDark) {
    return (
      <section style={layoutStyle} className="w-full">
        <div className="rounded-2xl px-4 py-10 sm:px-8 sm:py-12" style={blockThemeGradientStyle(styles)}>
          <div className="mx-auto max-w-3xl">
            {(props.text || props.subtitle) && (
              <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-8 text-white [&_p]:text-white/65" />
            )}
            {inner}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section style={layoutStyle} className="w-full">
      <div className="mx-auto max-w-3xl">
        {(props.text || props.subtitle) && <SectionHeading title={props.text} subtitle={props.subtitle} styles={styles} className="mb-8" />}
        {theme === 'premium' ? (
          <div className="rounded-[1.25rem] p-1" style={softThemeGradientShellStyle(styles)}>{inner}</div>
        ) : (
          inner
        )}
      </div>
    </section>
  )
}
