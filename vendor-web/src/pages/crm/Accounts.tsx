import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/** Accounts merged into Contacts — redirect legacy route. */
export default function AccountsPage() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/crm/contacts?type=company', { replace: true })
  }, [navigate])
  return null
}
