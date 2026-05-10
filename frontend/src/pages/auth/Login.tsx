import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AxiosError } from 'axios'

import { formatLoginError, useLogin } from '@/hooks/useAuth'

/** Align with backend auth_service._PHONE_RE */
const PHONE_RE = /^\+?\d{7,15}$/

const schema = z.object({
  login: z
    .string()
    .min(3, 'Enter email or phone')
    .superRefine((val, ctx) => {
      const trimmed = val.trim()
      if (!trimmed) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter email or phone' })
        return
      }
      const compactPhone = trimmed.replace(/\s/g, '')
      const emailOk = z.string().email().safeParse(trimmed).success
      const phoneOk = PHONE_RE.test(compactPhone)
      if (!emailOk && !phoneOk) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Enter a valid email or phone number (7–15 digits; spaces OK; optional +country code)',
        })
      }
    }),
  password: z.string().min(1, 'Password is required'),
})

type FormData = z.infer<typeof schema>

export default function Login() {
  const loginMutation = useLogin()
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = (data: FormData) => {
    loginMutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <Label htmlFor="login">Email or phone number</Label>
        <Input
          id="login"
          type="text"
          inputMode="text"
          autoComplete="username"
          placeholder="you@company.com or +91 98765 43210"
          {...register('login')}
          className="mt-1"
        />
        {errors.login && (
          <p className="mt-1 text-sm text-red-500">{errors.login.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="mt-1"
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={loginMutation.isPending}
      >
        {loginMutation.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        Sign in
      </Button>

      {loginMutation.isError && (
        <p className="text-center text-sm text-red-600" role="alert">
          {loginMutation.error &&
          typeof loginMutation.error === 'object' &&
          'response' in loginMutation.error
            ? formatLoginError(loginMutation.error as AxiosError<{ detail?: unknown }>)
            : 'Sign-in failed. Check email or phone and password, and that the API is running on port 8000.'}
        </p>
      )}

      <p className="text-center text-sm text-gray-600">
        Do not have an account?{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  )
}
