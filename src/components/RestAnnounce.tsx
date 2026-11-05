import { createContext, useContext, type ReactNode } from 'react'

const RestAnnounceContext = createContext<(message: string | null) => void>(() => {})

export function RestAnnounceProvider({
  announce,
  children,
}: {
  announce: (message: string | null) => void
  children: ReactNode
}) {
  return <RestAnnounceContext.Provider value={announce}>{children}</RestAnnounceContext.Provider>
}

export function useRestAnnounce(): (message: string | null) => void {
  return useContext(RestAnnounceContext)
}
