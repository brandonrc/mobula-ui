import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'

/**
 * Create-cluster wizard placeholder (spec §5.3). This is the most important
 * form in the product and it ships with Milestone B, once
 * `POST /api/v1/clusters` exists — the steps below mirror `ClusterSpec`
 * exactly so the shape is already visible.
 */
const STEPS = [
  {
    title: '1. Basics',
    body: 'name, project (select from permitted projects), labels (forward-compat).',
  },
  {
    title: '2. Head node',
    body: 'head_cpu, head_memory.',
  },
  {
    title: '3. Worker groups',
    body: 'Repeatable block: name, cpu, memory, gpu, min/max replicas. With autoscaling on, Mobula owns only min/max (ADR-0007) — replicas is disabled.',
  },
  {
    title: '4. Runtime',
    body: 'ray_version, image; env vars and volumes are planned forward-compat fields.',
  },
  {
    title: '5. Lifecycle',
    body: 'ttl_seconds (idle reaping, null = disabled), suspend policy.',
  },
  {
    title: '6. Review',
    body: 'The exact TOML/JSON spec that will be submitted, rendered as the artifact — Mobula is declarative.',
  },
]

export function ClusterNewPage() {
  return (
    <>
      <PageHeader
        title="New cluster"
        description="Declarative spec in, observed state out. The wizard arrives in Milestone B with the Phase 3 management API (POST /api/v1/clusters)."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <CardTitle className="text-sm">{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
