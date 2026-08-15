import { useState } from 'react'
import { useParams } from 'react-router'

import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Cluster detail (spec §5.4). Tab layout is in place; the tab contents land
 * with Milestones B (overview, nodes, config) and C (jobs, logs).
 */
const TABS = [
  { id: 'overview', label: 'Overview', note: 'Desired spec vs observed state, endpoints, and the transition timeline arrive with GET /api/v1/clusters/{id} (Milestone B).' },
  { id: 'nodes', label: 'Nodes', note: 'Head + worker-group breakdown. Scale is group-level (D2) — there is no "add node" button, there is "edit worker group".' },
  { id: 'jobs', label: 'Jobs', note: 'Live jobs for this cluster via the control-plane proxy (Milestone C) — never raw Ray dashboard URLs.' },
  { id: 'logs', label: 'Logs', note: 'Streaming log viewer over the control-plane WS bridge (Milestone C).' },
  { id: 'metrics', label: 'Metrics', note: 'Native Ray-API views plus Grafana deep-links in a new tab (D3: no iframes anywhere).' },
  { id: 'events', label: 'Events', note: 'Per-cluster audit/transition stream (JSONL today, Postgres-backed with Phase 3).' },
  { id: 'config', label: 'Config', note: 'Effective spec + registry entry; masked token with rotate control for Admins (Milestone B).' },
] as const

type TabId = (typeof TABS)[number]['id']

export function ClusterDetailPage() {
  const { clusterId } = useParams<{ clusterId: string }>()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0]

  return (
    <>
      <PageHeader
        title={clusterId ?? 'Cluster'}
        description={
          <>
            {/* State-machine fidelity (spec §1.4.1): we show no state badge
                until the API reports one — never an invented state. */}
            State and actions render once the Phase 3 detail endpoint exists.{' '}
            <Badge variant="muted">state unavailable</Badge>
          </>
        }
      />

      <div className="mb-6 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
              t.id === activeTab &&
                'border-primary font-medium text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <EmptyState title={`${tab.label} — coming soon`} description={tab.note} />
    </>
  )
}
