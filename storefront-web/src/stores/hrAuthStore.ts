import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type HrEmployeePreview = {
  id: string
  employee_code: string | null
  full_name: string | null
  email: string | null
}

/** Store chosen via ?branch= / login body — validated server-side when employee is outlet-pinned. */
export type HrLoginBranch = {
  id: string
  code: string | null
  name: string | null
}

interface HrAuthState {
  accessToken: string | null
  employee: HrEmployeePreview | null
  /** Present when employee signed in with a branch hint (URL or API). */
  loginBranch: HrLoginBranch | null
  isAuthenticated: boolean
  setSession: (access_token: string, employee: HrEmployeePreview, loginBranch?: HrLoginBranch | null) => void
  logout: () => void
}

export const useHrAuthStore = create<HrAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      employee: null,
      loginBranch: null,
      isAuthenticated: false,
      setSession: (access_token, employee, loginBranch = null) => {
        localStorage.setItem('employee_access_token', access_token)
        set({
          accessToken: access_token,
          employee,
          loginBranch: loginBranch ?? null,
          isAuthenticated: true,
        })
      },
      logout: () => {
        localStorage.removeItem('employee_access_token')
        localStorage.removeItem('employee-hr-auth-storage')
        set({ accessToken: null, employee: null, loginBranch: null, isAuthenticated: false })
      },
    }),
    {
      name: 'employee-hr-auth-storage',
      partialize: (s) => ({
        accessToken: s.accessToken,
        employee: s.employee,
        loginBranch: s.loginBranch,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
)
