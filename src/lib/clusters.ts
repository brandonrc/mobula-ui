import type { ClusterView, Identity } from './api'

/**
 * Cluster lifecycle mutations (create, terminate) need `Write`/`Delete` on
 * `Target::Cluster` — Operator or Admin only (api-v1.md §2.2, ADR-0009).
 * Developer is deliberately code-but-not-lifecycle (open question Q9 in the
 * UI spec). Reads are Viewer+ and never gated. Fails closed on null identity.
 */
export function canManageClusters(identity: Identity | null): boolean {
  if (!identity) return false
  return identity.roles.includes('operator') || identity.roles.includes('admin')
}

/**
 * `$1.25/hr` for a configured estimate; `—` when the control plane has no
 * price sheet (`est_*_hourly` null — see `PolicyConfig.prices`).
 */
export function formatHourlyCost(value: number | null | undefined): string {
  if (value == null) return '—'
  return `$${value.toFixed(2)}/hr`
}

export interface ConditionPresentation {
  label: string
  tooltip: string
}

/**
 * The reconcile engine's drift/health alarm (ADR-0004), distinct from
 * `observed_state`. Known conditions get a curated tooltip; unknown ones
 * pass through verbatim so a future condition never renders blank.
 */
export function conditionPresentation(
  condition: string | null | undefined,
): ConditionPresentation | null {
  switch (condition) {
    case 'spec_drift':
      return {
        label: 'spec drift',
        tooltip:
          'The cluster was edited out of band and no longer matches the desired spec.',
      }
    case 'degraded':
      return {
        label: 'degraded',
        tooltip:
          'The reconcile engine reports this cluster is not fully healthy.',
      }
    default:
      return condition
        ? { label: condition, tooltip: 'Alarm raised by the reconcile engine.' }
        : null
  }
}

/**
 * True while the reconcile engine hasn't caught up to the desired spec
 * (`generation` bumped, `observed_generation` lagging) — the "reconcile in
 * progress" signal from spec §5.4.
 */
export function generationDrift(
  view: Pick<ClusterView, 'generation' | 'observedGeneration'>,
): boolean {
  return view.generation !== view.observedGeneration
}
