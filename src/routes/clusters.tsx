import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'

import { useCanManageClusters } from '@/auth/permissions'
import { ClusterStateBadge } from '@/components/cluster-state-badge'
import { DataTable } from '@/components/data-table'
import { ApiErrorState, EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { api, clusterViewState } from '@/lib/api'
import type { ClusterView } from '@/lib/api'
import { conditionPresentation, formatHourlyCost } from '@/lib/clusters'

const columns: ColumnDef<ClusterView>[] = [
  {
    accessorKey: 'id',
    header: 'Name',
    cell: ({ row }) => (
      <Link
        to={`/clusters/${row.original.id}`}
        className="font-medium hover:underline"
      >
        {row.original.id}
      </Link>
    ),
  },
  {
    accessorKey: 'project',
    header: 'Project',
    cell: ({ row }) => row.original.project,
  },
  {
    accessorKey: 'observedState',
    header: 'State',
    cell: ({ row }) => {
      const condition = conditionPresentation(row.original.condition)
      return (
        <span className="flex items-center gap-1.5">
          <ClusterStateBadge state={clusterViewState(row.original)} />
          {condition ? (
            // The reconcile engine's drift/health alarm (ADR-0004) —
            // distinct from the lifecycle state badge beside it.
            <span title={condition.tooltip}>
              <TriangleAlert
                className="size-3.5 text-amber-500"
                aria-label={condition.label}
              />
            </span>
          ) : null}
        </span>
      )
    },
  },
  {
    accessorKey: 'rayVersion',
    header: 'Ray',
    cell: ({ row }) => row.original.rayVersion,
  },
  {
    accessorKey: 'generation',
    header: 'Gen',
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.generation}</span>
    ),
  },
  {
    accessorKey: 'estMaxHourly',
    header: 'Est. max $/hr',
    cell: ({ row }) => (
      <span
        className="font-mono text-xs"
        title={
          row.original.estMaxHourly == null
            ? 'No price sheet configured on the control plane'
            : undefined
        }
      >
        {formatHourlyCost(row.original.estMaxHourly)}
      </span>
    ),
  },
]

/**
 * Cluster list (spec §5.2), backed by the implemented
 * `GET /api/v1/clusters`. The create affordance is gated on Operator/Admin
 * (Write on Target::Cluster, api-v1.md §2.2); reads stay open to Viewer+.
 */
export function ClustersPage() {
  const canManage = useCanManageClusters()
  const query = useQuery({
    queryKey: ['clusters'],
    queryFn: api.clusters,
    retry: false,
    refetchInterval: 30_000,
  })

  return (
    <>
      <PageHeader
        title="Clusters"
        description="Every Ray cluster Mobula manages, across all projects you can see."
        actions={
          canManage ? (
            <Button asChild size="sm">
              <Link to="/clusters/new">New cluster</Link>
            </Button>
          ) : undefined
        }
      />

      {query.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : query.isError ? (
        <ApiErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState
          title="No clusters yet"
          description="Mobula can adopt Ray clusters you already run, or create new ones from a declarative spec (Operator/Admin)."
          action={
            <>
              <Button asChild size="sm" variant="outline">
                <Link to="/registry">Register an existing cluster</Link>
              </Button>
              {canManage ? (
                <Button asChild size="sm">
                  <Link to="/clusters/new">Create a new cluster</Link>
                </Button>
              ) : null}
            </>
          }
        />
      ) : (
        <DataTable columns={columns} data={query.data} />
      )}
    </>
  )
}
