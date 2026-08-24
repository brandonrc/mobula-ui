import { useQuery } from '@tanstack/react-query'
import { CloudOff } from 'lucide-react'

import { ApiErrorState, EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
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
import { api, MobulaApiError } from '@/lib/api'
import type { ClusterJobView, ClusterNodesView, NodeView } from '@/lib/api'
import { cn } from '@/lib/utils'

/** `memory_bytes` → GiB with one decimal; em dash when the field is absent. */
export function formatMemoryGiB(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`
}

/** CPU cores; em dash when absent. Trims to at most two decimals. */
export function formatCpuCores(cpu: number | null | undefined): string {
  if (cpu == null) return '—'
  const cores = Math.round(cpu * 100) / 100
  return `${cores} ${cores === 1 ? 'core' : 'cores'}`
}

/** GPU count; em dash when absent. */
export function formatGpu(gpu: number | null | undefined): string {
  if (gpu == null) return '—'
  return String(gpu)
}

/** Epoch-ms start time → locale string; em dash when absent. */
export function formatJobStart(ms: number | null | undefined): string {
  if (ms == null) return '—'
  return new Date(ms).toLocaleString()
}

/**
 * Job wall-clock from epoch-ms bounds. Renders a dash while still running
 * (no `end_time`) or when either bound is missing.
 */
export function formatJobDuration(
  start: number | null | undefined,
  end: number | null | undefined,
): string {
  if (start == null || end == null) return '—'
  const secs = Math.max(0, Math.round((end - start) / 1000))
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

/** Ray job status → badge classes (matches the global Jobs page). */
function jobStatusClasses(status: string): string {
  switch (status.toUpperCase()) {
    case 'SUCCEEDED':
      return 'border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    case 'RUNNING':
      return 'border-transparent bg-blue-500/15 text-blue-600 dark:text-blue-400'
    case 'FAILED':
      return 'border-transparent bg-red-500/15 text-red-600 dark:text-red-400'
    case 'PENDING':
      return 'border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400'
    default: // STOPPED and anything else
      return 'border-transparent bg-muted text-muted-foreground'
  }
}

function NodeStatusBadge({ phase, ready }: { phase: string; ready: boolean }) {
  return (
    <Badge
      variant={ready ? 'success' : 'warning'}
      className="font-medium"
      title={ready ? 'Pod is ready' : 'Pod is not ready'}
    >
      {phase}
      {ready ? '' : ' · not ready'}
    </Badge>
  )
}

function NodesTable({ nodes }: { nodes: NodeView[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pod</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">CPU</TableHead>
          <TableHead className="text-right">Memory</TableHead>
          <TableHead className="text-right">GPU</TableHead>
          <TableHead>Node IP</TableHead>
          <TableHead>Host</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {nodes.map((node) => (
          <TableRow key={node.pod_name}>
            <TableCell className="font-mono text-xs">{node.pod_name}</TableCell>
            <TableCell>
              <NodeStatusBadge phase={node.phase} ready={node.ready} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCpuCores(node.cpu)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMemoryGiB(node.memory_bytes)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatGpu(node.gpu)}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {node.node_ip ?? '—'}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {node.host ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * Presentational Nodes view: the head node then each worker group (with its
 * ready/desired count) and the pods in it. Backed by
 * `GET /api/v1/clusters/{id}/nodes` — observability only (D2: scale is
 * group-level, there is no "add node" button).
 */
export function NodesSection({ data }: { data: ClusterNodesView }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Head node</CardTitle>
        </CardHeader>
        <CardContent>
          {data.head ? (
            <NodesTable nodes={[data.head]} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No head node is currently reported for this cluster.
            </p>
          )}
        </CardContent>
      </Card>

      {data.worker_groups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Worker groups</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This cluster has no worker groups.
            </p>
          </CardContent>
        </Card>
      ) : (
        data.worker_groups.map((group) => (
          <Card key={group.name}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle>{group.name}</CardTitle>
              <Badge
                variant={group.ready >= group.desired ? 'success' : 'warning'}
                className="font-medium tabular-nums"
                title="ready / desired replicas"
              >
                {group.ready}/{group.desired} ready
              </Badge>
            </CardHeader>
            <CardContent>
              {group.nodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No pods are currently scheduled for this group.
                </p>
              ) : (
                <NodesTable nodes={group.nodes} />
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

/**
 * Presentational Jobs view: live jobs for one cluster, or the first-run
 * empty state. Backed by `GET /api/v1/clusters/{id}/jobs`.
 */
export function JobsSection({ jobs }: { jobs: ClusterJobView[] }) {
  if (jobs.length === 0) {
    return (
      <EmptyState
        title="No jobs on this cluster yet."
        description="Submit a job to this cluster through Mobula's gateway and it will appear here while it runs."
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jobs</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Entrypoint</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job, index) => {
              const id = job.job_id ?? job.submission_id ?? '—'
              const status = job.status ?? 'UNKNOWN'
              return (
                <TableRow key={job.job_id ?? job.submission_id ?? index}>
                  <TableCell className="font-mono text-xs">{id}</TableCell>
                  <TableCell>
                    <Badge className={cn('font-medium', jobStatusClasses(status))}>
                      {status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    {job.entrypoint ? (
                      <span
                        className="block truncate font-mono text-xs"
                        title={job.entrypoint}
                      >
                        {job.entrypoint}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatJobStart(job.start_time)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatJobDuration(job.start_time, job.end_time)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

/**
 * Error rendering shared by the Nodes and Jobs tabs. A per-cluster 503 means
 * the control plane is up but the cluster's Ray dashboard is unreachable —
 * render that as a clean inline message rather than the generic
 * control-plane-unreachable state. Everything else (401/403/404/network)
 * routes through the shared `ApiErrorState`.
 */
export function ClusterTabError({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  if (error instanceof MobulaApiError && error.status === 503) {
    return (
      <EmptyState
        icon={CloudOff}
        title="Cluster unreachable"
        description="The control plane could not reach this cluster's Ray dashboard (503). It may be starting up, suspended, or temporarily unavailable — try again shortly."
        action={
          onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      />
    )
  }
  return <ApiErrorState error={error} onRetry={onRetry} />
}

/** Container: fetches the cluster's nodes and renders the Nodes tab body. */
export function ClusterNodesTab({ clusterId }: { clusterId: string }) {
  const query = useQuery({
    queryKey: ['clusters', clusterId, 'nodes'],
    queryFn: () => api.clusterNodes(clusterId),
    retry: false,
    refetchInterval: 15_000,
  })

  if (query.isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (query.isError) {
    return <ClusterTabError error={query.error} onRetry={() => query.refetch()} />
  }
  return <NodesSection data={query.data} />
}

/** Container: fetches the cluster's live jobs and renders the Jobs tab body. */
export function ClusterJobsTab({ clusterId }: { clusterId: string }) {
  const query = useQuery({
    queryKey: ['clusters', clusterId, 'jobs'],
    queryFn: () => api.clusterJobs(clusterId),
    retry: false,
    refetchInterval: 15_000,
  })

  if (query.isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }
  if (query.isError) {
    return <ClusterTabError error={query.error} onRetry={() => query.refetch()} />
  }
  return <JobsSection jobs={query.data} />
}
