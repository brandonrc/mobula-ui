import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/auth/auth-context'
import { ApiErrorState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { Identity } from '@/lib/api'

function IdentityCard({ identity, source }: { identity: Identity; source: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who am I</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Subject</span>
          <span className="font-mono text-xs">{identity.subject}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Email</span>
          <span className="font-mono text-xs">{identity.email ?? '—'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Groups</span>
          <span className="flex flex-wrap justify-end gap-1">
            {identity.groups.length > 0
              ? identity.groups.map((g) => (
                  <Badge key={g} variant="secondary">
                    {g}
                  </Badge>
                ))
              : '—'}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Roles</span>
          <span className="flex gap-1">
            {identity.roles.length
              ? identity.roles.map((r) => <Badge key={r}>{r}</Badge>)
              : '—'}
          </span>
        </div>
        <p className="pt-1 text-xs text-muted-foreground">{source}</p>
      </CardContent>
    </Card>
  )
}

/**
 * Access control (spec §5.8). v1 is read-only: a "who am I" panel (from
 * GET /api/v1/identity when it exists, otherwise the dev-auth stub) and a
 * view of the effective role mappings, which stay in auth.toml + restart.
 */
export function AccessPage() {
  const { identity: devIdentity, devAuth } = useAuth()
  const query = useQuery({
    queryKey: ['identity'],
    queryFn: api.identity,
    retry: false,
  })

  return (
    <>
      <PageHeader
        title="Access"
        description="Users, roles, role mappings, and service accounts. (Admin)"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {query.isPending ? (
          <p className="text-sm text-muted-foreground">Loading identity…</p>
        ) : query.isSuccess ? (
          <IdentityCard
            identity={query.data}
            source="Reported by GET /api/v1/identity."
          />
        ) : (
          <div className="space-y-4">
            <ApiErrorState error={query.error} onRetry={() => query.refetch()} />
            {devAuth && devIdentity ? (
              <IdentityCard
                identity={devIdentity}
                source="Dev-mode stub identity (VITE_MOBULA_DEV_AUTH) — shown until /api/v1/identity and OIDC login exist."
              />
            ) : null}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Role mappings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Effective mappings come from{' '}
              <code className="text-foreground">auth.toml</code> (e.g.{' '}
              <code className="text-foreground">/platform-admins → admin</code>
              ). Editing stays in the config file + restart for v1; the
              read-only view renders here once{' '}
              <code className="text-foreground">GET /api/v1/access/roles</code>{' '}
              exists.
            </p>
            <p>
              Roles are fixed:{' '}
              <code className="text-foreground">viewer &lt; developer &lt; admin</code>,
              enforced deny-by-default by the backend. The UI renders from the
              caller's role, never from feature flags (spec §1.4.4).
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
