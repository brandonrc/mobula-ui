import { Settings } from 'lucide-react'

import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'

/**
 * Settings / quotas placeholder (spec §5.9). Exists in the IA now so
 * navigation doesn't churn later; project list and per-project quota
 * editors land with Phase 3+.
 */
export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Org and project settings, quotas, and defaults."
      />
      <EmptyState
        icon={Settings}
        title="Nothing to configure yet"
        description="Project list and per-project quota editors (CPU/GPU/instance caps, Kueue-backed) arrive with Phase 3; price-sheet upload for cost views is Phase 4."
      />
    </>
  )
}
