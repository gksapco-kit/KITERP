import { useState, useMemo, useEffect } from 'react'
import { ArrowLeft, ArrowRight, Check, LayoutTemplate, Sparkles } from 'lucide-react'
import { businessCategories, businessTypeOptions } from '../../lib/categories'
import { getDefaultTemplateId, getTemplatesForSelection } from '../../lib/websiteTemplates'
import { useBuilderStore } from '../../store/useBuilderStore'
import type { BusinessCategory, BusinessType, SiteConfig } from '../../types/builder'

type Step = 'business' | 'type' | 'category' | 'template'

export function OnboardingWizard() {
  const completeOnboarding = useBuilderStore((s) => s.completeOnboarding)
  const [step, setStep] = useState<Step>('business')
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState<BusinessType | null>(null)
  const [category, setCategory] = useState<BusinessCategory | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)

  const steps: Step[] = ['business', 'type', 'category', 'template']
  const stepIndex = steps.indexOf(step)

  const availableTemplates = useMemo(() => {
    if (!category || !businessType) return []
    return getTemplatesForSelection(category, businessType)
  }, [category, businessType])

  useEffect(() => {
    if (category && businessType && step === 'template' && !templateId) {
      setTemplateId(getDefaultTemplateId(category, businessType))
    }
  }, [category, businessType, step, templateId])

  const canNext =
    (step === 'business' && businessName.trim().length > 0) ||
    (step === 'type' && businessType !== null) ||
    (step === 'category' && category !== null) ||
    (step === 'template' && templateId !== null)

  const handleNext = () => {
    if (step === 'business') setStep('type')
    else if (step === 'type') setStep('category')
    else if (step === 'category') {
      setTemplateId(null)
      setStep('template')
    } else if (step === 'template' && businessType && category && templateId) {
      const config: SiteConfig = {
        businessName: businessName.trim(),
        businessType,
        category,
        templateId,
      }
      completeOnboarding(config)
    }
  }

  const handleBack = () => {
    if (step === 'type') setStep('business')
    else if (step === 'category') setStep('type')
    else if (step === 'template') setStep('category')
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-50 via-white to-indigo-50 p-6">
      <div className={`w-full rounded-2xl border border-gray-100 bg-white p-8 shadow-xl ${step === 'template' ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Create Your Website</h1>
            <p className="text-sm text-gray-500">
              {step === 'template' ? 'Pick a ready-made design for your industry' : 'Answer a few questions to get started'}
            </p>
          </div>
        </div>

        <div className="mb-8 flex gap-2">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition ${i <= stepIndex ? 'bg-brand-600' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {step === 'business' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">What's your business name?</h2>
            <p className="text-sm text-gray-500">This will be used as your website title and branding.</p>
            <input
              autoFocus
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && canNext && handleNext()}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-lg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="e.g. Bloom Boutique"
            />
          </div>
        )}

        {step === 'type' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">What do you offer?</h2>
            <p className="text-sm text-gray-500">We'll create the right pages for your business.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {businessTypeOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBusinessType(opt.id)}
                  className={`rounded-xl border-2 p-5 text-left transition ${
                    businessType === opt.id
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{opt.icon}</span>
                  <p className="mt-2 font-semibold text-gray-900">{opt.label}</p>
                  <p className="mt-1 text-xs text-gray-500">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'category' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">What category best describes you?</h2>
            <p className="text-sm text-gray-500">We'll show templates tailored to your industry.</p>
            <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
              {businessCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${
                    category === cat.id
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <div>
                    <p className="font-medium text-gray-900">{cat.label}</p>
                    <p className="text-xs text-gray-500">{cat.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'template' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-brand-600" />
              <h2 className="text-lg font-semibold text-gray-900">Choose a website template</h2>
            </div>
            <p className="text-sm text-gray-500">
              Each template includes a custom home page design. You can edit everything after.
            </p>
            {availableTemplates.length === 0 ? (
              <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">No templates for this combination.</p>
            ) : (
              <div className="grid max-h-[420px] gap-4 overflow-y-auto sm:grid-cols-2">
                {availableTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setTemplateId(tpl.id)}
                    className={`overflow-hidden rounded-xl border-2 text-left transition ${
                      templateId === tpl.id
                        ? 'border-brand-600 ring-2 ring-brand-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`flex h-28 items-center justify-center bg-gradient-to-br ${tpl.preview.gradient}`}>
                      <span className="text-5xl">{tpl.preview.emoji}</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900">{tpl.name}</p>
                        {tpl.popular && (
                          <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                            Popular
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{tpl.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 'business'}
            className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:invisible"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canNext}
            className="flex items-center gap-1 rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {step === 'template' ? (
              <>
                <Check className="h-4 w-4" />
                Start Editing
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
