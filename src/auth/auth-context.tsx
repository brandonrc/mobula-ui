import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

import type { Identity } from '@/lib/api'

/**
 * Milestone A auth stub (spec §5.10).
 *
 * Real web login is OIDC Authorization Code + PKCE, which the backend does
 * not implement yet. Until then the UI runs in dev mode, mirroring
 * `mobula serve --dev-allow-unauthenticated`: when the feature flag is on,
 * the shell assumes a fake Admin identity so role-shaped UI can be built
 * against it. PKCE is deliberately NOT implemented here.
 */
export function isDevAuthEnabled(): boolean {
  const flag = import.meta.env.VITE_MOBULA_DEV_AUTH
  if (flag === 'true') return true
  if (flag === 'false') return false
  // Default on in `vite dev`, off in production builds unless opted in.
  return import.meta.env.DEV
}

const DEV_IDENTITY: Identity = {
  subject: 'dev-admin@mobula.local',
  email: 'dev-admin@mobula.local',
  groups: ['platform-admins'],
  roles: ['admin'],
}

interface AuthContextValue {
  /** The current caller, or null when dev auth is disabled (pre-PKCE). */
  identity: Identity | null
  devAuth: boolean
}

const AuthContext = createContext<AuthContextValue>({
  identity: null,
  devAuth: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const devAuth = isDevAuthEnabled()
  return (
    <AuthContext.Provider
      value={{ identity: devAuth ? DEV_IDENTITY : null, devAuth }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
