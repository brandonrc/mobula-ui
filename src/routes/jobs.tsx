import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Global job history (spec §5.5). The persistent cross-cluster table lands
 * with Phase 3 Postgres (GET /api/v1/jobs). Submission stays CLI-first (D4)
 * — the UI will teach the `ray job submit` path rather than replace it.
 */
export function JobsPage() {
  return (
    <>
      <PageHeader
        title="Jobs"
        description="Cross-cluster, persistent job history — the direct answer to “Ray dashboards forget everything.”"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Job history</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="History arrives with Phase 3"
              description="Job records (id, cluster, submitter, Ray status, duration, submitted-at) will be stored in Mobula's Postgres and listed here, surviving the clusters that ran them."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submitting jobs — CLI-first (D4)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              There is deliberately no submit form in v1. Submit through the
              Ray Jobs CLI against Mobula's gateway; the command helper on
              this page will generate the exact command plus auth headers once
              clusters are registered.
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
{`ray job submit \\
  --address http://<cluster-host>:8484 \\
  --working-dir . -- python train.py

# Your JWT travels via:
export RAY_JOB_HEADERS='{"Authorization": "Bearer '"$(mobula token)"'"}'`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
