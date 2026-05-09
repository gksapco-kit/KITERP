import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'
import { usePlatformStaffList, useCreatePlatformStaff, useUpdatePlatformStaff } from '@/hooks/usePlatformStaff'
import { Headphones, Loader2, UserMinus, UserX } from 'lucide-react'

export default function PlatformTeam() {
  const { user } = useAuthStore()
  const { data: members, isLoading, isError } = usePlatformStaffList()
  const createStaff = useCreatePlatformStaff()
  const updateStaff = useUpdatePlatformStaff()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  if (!isSuperuserAdmin(user)) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const em = email.trim()
    const ph = phone.trim()
    if (!em && !ph) {
      return
    }
    createStaff.mutate(
      {
        full_name: fullName.trim(),
        password,
        email: em || undefined,
        phone: ph || undefined,
      },
      {
        onSuccess: () => {
          setFullName('')
          setEmail('')
          setPhone('')
          setPassword('')
        },
      },
    )
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Headphones className="w-7 h-7 text-primary" />
          Platform support team
        </h1>
        <p className="text-gray-600 mt-1">
          Add users by email and/or phone so they can sign in here and help vendors (read-only vendor
          directory; no approvals or global settings).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add support user</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            <div>
              <Label htmlFor="ps-name">Full name</Label>
              <Input
                id="ps-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                className="mt-1"
                autoComplete="name"
              />
            </div>
            <div>
              <Label htmlFor="ps-email">Email (optional if phone set)</Label>
              <Input
                id="ps-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="ps-phone">Phone (optional if email set)</Label>
              <Input
                id="ps-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1"
                placeholder="+91..."
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="ps-password">Initial password</Label>
              <Input
                id="ps-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={createStaff.isPending || (!email.trim() && !phone.trim())}>
              {createStaff.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                'Add support user'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current support users</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading…
            </div>
          )}
          {isError && (
            <p className="text-sm text-red-600">Could not load list. Are you logged in as a superuser?</p>
          )}
          {!isLoading && !isError && (!members || members.length === 0) && (
            <p className="text-sm text-gray-500">No support users yet.</p>
          )}
          {!isLoading && members && members.length > 0 && (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-4 py-2 font-medium text-gray-600">Name</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Email</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Phone</th>
                    <th className="px-4 py-2 font-medium text-gray-600">Status</th>
                    <th className="px-4 py-2 font-medium text-gray-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 font-medium">{m.full_name}</td>
                      <td className="px-4 py-3 text-gray-600">{m.email || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{m.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            m.is_active
                              ? 'text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs'
                              : 'text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-xs'
                          }
                        >
                          {m.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updateStaff.isPending}
                          onClick={() =>
                            updateStaff.mutate({
                              userId: m.id,
                              data: { is_active: !m.is_active },
                            })
                          }
                          title={m.is_active ? 'Deactivate login' : 'Reactivate'}
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={updateStaff.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                'Remove platform access? They will no longer be able to open this admin app.',
                              )
                            ) {
                              updateStaff.mutate({ userId: m.id, data: { remove_access: true } })
                            }
                          }}
                          title="Remove admin access"
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
