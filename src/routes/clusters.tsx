import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Link } from 'react-router'

import { ClusterStateBadge } from '@/components/cluster-state-badge'
import { DataTable } from '@/components/data-table'
import { ApiErrorState, EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { api, clusterViewState } from '@/lib/api'
import type { ClusterView } from '@/lib/api'

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
    cell: ({ row }) => <ClusterStateBadge state={clusterViewState(row.original)} />,
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
]

/**
 * Cluster list (spec §5.2). Backed by greenfield `GET /api/v1/clusters`;
 * until that exists the page renders the not-implemented / unreachable
 * empty states, and the first-run state distinguishes "register existing"
 * from "create new" — different mental models, both offered.
 */
export function ClustersPage() {
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
          <Button asChild size="sm">
            <Link to="/clusters/new">New cluster</Link>
          </Button>
        }
      />

      {query.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : query.isError ? (
        <ApiErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState
          title="No clusters yet"
          description="Mobula can adopt Ray clusters you already run, or (with the Phase 3 provisioner) create new ones from a declarative spec."
          action={
            <>
              <Button asChild size="sm" variant="outline">
                <Link to="/registry">Register an existing cluster</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/clusters/new">Create a new cluster</Link>
              </Button>
            </>
          }
        />
      ) : (
        <DataTable columns={columns} data={query.data} />
      )}
    </>
  )
}
