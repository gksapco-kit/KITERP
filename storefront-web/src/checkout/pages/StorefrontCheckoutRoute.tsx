import { useParams } from 'react-router-dom'
import StorefrontCheckoutPage from './StorefrontCheckoutPage'

export default function StorefrontCheckoutRoute() {
  const { templateId = '' } = useParams<{ templateId: string }>()
  return (
    <StorefrontCheckoutPage
      basePath={`/template-browser/${templateId}`}
      storeName="Demo Store"
    />
  )
}
