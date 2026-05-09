import { useParams } from 'react-router-dom'
import StorefrontCartPage from './StorefrontCartPage'

export default function StorefrontCartRoute() {
  const { templateId = '' } = useParams<{ templateId: string }>()
  return (
    <StorefrontCartPage
      basePath={`/template-browser/${templateId}`}
      storeName="Demo Store"
    />
  )
}
