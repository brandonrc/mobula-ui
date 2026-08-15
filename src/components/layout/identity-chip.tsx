import { CircleUserRound } from 'lucide-react'

import { useAuth } from '@/auth/auth-context'
import { Badge } from '@/components/ui/badge'
import { primaryRole, type Role } from '@/lib/api'

const ROLE_VARIANT: Record<Role, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  operator: 'secondary',
  developer: 'secondary',
  viewer: 'outline',
} as const

/**
 * Top-bar identity/role chip. Milestone A shows the dev-mode stub identity
 * (spec §5.10); the real one comes from `GET /api/v1/identity` once PKCE
 * login exists.
 */
export function IdentityChip() {
  const { identity, devAuth } = useAuth()

  if (!identity) {
    return (
      <div
        className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1 text-xs text-muted-foreground"
        title="VITE_MOBULA_DEV_AUTH is off and OIDC login is not implemented yet (spec §5.10)"
      >
        <CircleUserRound className="size-4" aria-hidden />
        <span>auth not configured</span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs"
      title={devAuth ? 'Dev-mode identity (VITE_MOBULA_DEV_AUTH)' : undefined}
    >
      <CircleUserRound className="size-4 text-muted-foreground" aria-hidden />
      <span className="max-w-40 truncate">{identity.subject}</span>
      {(() => {
        const role = primaryRole(identity.roles)
        return role ? <Badge variant={ROLE_VARIANT[role]}>{role}</Badge> : null
      })()}
    </div>
  )
}
