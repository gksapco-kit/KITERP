import { createContext, useContext, type ReactNode } from 'react'

/**
 * True when StoreLayout renders the homepage nav/footer shell above <Outlet />.
 * Builder pages must not duplicate those blocks in page content.
 */
const LayoutOwnsShellContext = createContext(false)

export function LayoutOwnsShellProvider({
  value,
  children,
}: {
  value: boolean
  children: ReactNode
}) {
  return (
    <LayoutOwnsShellContext.Provider value={value}>
      {children}
    </LayoutOwnsShellContext.Provider>
  )
}

export function useLayoutOwnsShell(): boolean {
  return useContext(LayoutOwnsShellContext)
}
