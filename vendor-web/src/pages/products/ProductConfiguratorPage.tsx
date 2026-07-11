import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useProduct } from '@/hooks/useVendor'
import {
  SimpleVariantWizard,
  type VariantWizardHeaderActions,
  type VariantWizardHeaderStepper,
} from '@/components/products/SimpleVariantWizard'
import { WizardStepIndicator } from '@/components/products/VariantSetupEntry'

export default function ProductConfiguratorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { data: product, isLoading } = useProduct(id || '')
  const [isManageView, setIsManageView] = useState(searchParams.get('view') === 'manage')
  const [isEditSetup, setIsEditSetup] = useState(false)
  const [headerActions, setHeaderActions] = useState<VariantWizardHeaderActions | null>(null)
  const [headerStepper, setHeaderStepper] = useState<VariantWizardHeaderStepper | null>(null)

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
  }

  if (!id || !product) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500">Product not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/products')}>Back to Products</Button>
      </div>
    )
  }

  const pageTitle = isEditSetup
    ? 'Edit variant options'
    : isManageView
      ? 'Manage variant prices & stock'
      : 'Set up product variants'

  const productVariantsPath = `/products/${id}?edit=true&tab=variants`

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(productVariantsPath)}>
            <ArrowLeft className="h-4 w-4" /> Back to Product
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
              <Layers className="h-5 w-5 text-primary" />
              {pageTitle}
            </h1>
            <p className="text-sm text-gray-500">{product.name}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
          {headerActions?.showEditVariantOptions && (
            <Button variant="outline" size="sm" className="shrink-0" onClick={headerActions.onEditVariantOptions}>
              {headerActions.editVariantOptionsLabel ?? 'Edit variant options'}
            </Button>
          )}
          {headerActions?.showDone && headerActions.onDone && (
            <Button size="sm" className="shrink-0" onClick={headerActions.onDone}>
              {headerActions.doneLabel ?? 'Done — back to product'}
            </Button>
          )}
          {headerStepper && (
            <div className="min-w-0 w-full rounded-lg border bg-muted/30 px-2 py-1 sm:w-auto sm:max-w-full">
              <WizardStepIndicator
                steps={headerStepper.steps}
                current={headerStepper.current}
                onStepClick={headerStepper.onStepClick}
                canClickStep={headerStepper.canClickStep}
                showLabels={headerStepper.showLabels}
                compact={headerStepper.compact}
              />
            </div>
          )}
        </div>
      </div>

      <SimpleVariantWizard
        productId={id}
        onDone={() => navigate(productVariantsPath)}
        preferManageView={searchParams.get('view') === 'manage'}
        onManageViewChange={setIsManageView}
        onEditSetupChange={setIsEditSetup}
        onHeaderActionsChange={setHeaderActions}
        onHeaderStepperChange={setHeaderStepper}
      />
    </div>
  )
}
