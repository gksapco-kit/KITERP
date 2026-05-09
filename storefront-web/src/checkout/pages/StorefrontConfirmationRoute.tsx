import { useParams } from 'react-router-dom'
import StorefrontConfirmationPage from './StorefrontConfirmationPage'

export default function StorefrontConfirmationRoute() {
  const { templateId = '' } = useParams<{ templateId: string }>()
  return (
    <StorefrontConfirmationPage
      basePath={`/template-browser/${templateId}`}
      storeName="Demo Store"
    />
  )
}
