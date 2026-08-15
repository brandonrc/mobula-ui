import { ScrollText } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'

/**
 * Audit log viewer (spec §5.7). The backend emits JSONL audit events today;
 * the filterable, Postgres-backed viewer (GET /api/v1/audit) is Phase 3.
 * Authz denials will render as first-class rows carrying required/granted
 * role.
 */
export function AuditPage() {
  return (
    <>
      <PageHeader
        title="Audit"
        description="Who did what, on which cluster, with what result. (Admin)"
      />
      <EmptyState
        icon={ScrollText}
        title="Audit API arrives with Phase 3"
        description="Mobula already writes JSONL audit events (subject, cluster, method, path, status, latency_ms). This viewer — with time-range, subject, and status filters plus JSON/CSV export — ships once GET /api/v1/audit is backed by Postgres."
      />
    </>
  )
}
