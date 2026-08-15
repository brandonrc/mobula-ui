import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'

import { ClusterStateBadge } from '@/components/cluster-state-badge'
import { ApiErrorState, EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  )
}

/**
 * Fleet overview (spec §5.1). The aggregating `GET /api/v1/overview`
 * endpoint is greenfield; until it lands this page degrades to the cluster
 * list plus placeholders.
 */
export function OverviewPage() {
  const clustersQuery = useQuery({
    queryKey: ['clusters'],
    queryFn: api.clusters,
    retry: false,
    refetchInterval: 30_000,
  })
  const clusters = clustersQuery.data
  const running = clusters?.filter((c) => c.state === 'running').length

  return (
    <>
      <PageHeader
        title="Overview"
        description="Your Ray fleet at a glance — the screen the OSS Ray dashboard doesn't have."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Clusters running"
          value={clusters ? `${running ?? 0} / ${clusters.length}` : '—'}
        />
        {/* Resource totals and job stats arrive with GET /api/v1/overview (spec §8). */}
        <StatCard title="Total GPUs / CPUs" value="—" />
        <StatCard title="Active jobs" value="—" />
        <StatCard title="Failed jobs (24h)" value="—" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Clusters</CardTitle>
          </CardHeader>
          <CardContent>
            {clustersQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : clustersQuery.isError ? (
              <ApiErrorState
                error={clustersQuery.error}
                onRetry={() => clustersQuery.refetch()}
              />
            ) : clusters && clusters.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clusters.map((cluster) => (
                    <TableRow key={cluster.id}>
                      <TableCell>
                        <Link
                          to={`/clusters/${cluster.id}`}
                          className="font-medium hover:underline"
                        >
                          {cluster.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cluster.project ?? '—'}
                      </TableCell>
                      <TableCell>
                        <ClusterStateBadge state={cluster.state} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="No clusters yet"
                description="Register an existing Ray cluster or create a new one to see it here."
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link to="/clusters">Go to clusters</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No activity feed yet"
              description="Audit events (subject, cluster, method, path, status, latency) will stream here once GET /api/v1/overview lands — history survives clusters because it lives in Mobula, not on the head node."
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
