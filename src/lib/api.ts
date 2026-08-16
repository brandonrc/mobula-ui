/**
 * Typed API client for the Mobula control plane.
 *
 * API types come from `@brandonrc/mobula-client` — generated from mobula's
 * `openapi.json` (the source of truth) and published to GitHub Packages.
 * We never hand-write shapes the backend owns; re-exports below keep call
 * sites importing from `./api` while the truth lives in the package.
 *
 * Endpoints that exist today: `/healthz`, `/api/v1/version`,
 * `/api/v1/clusters`, `/api/v1/services`. Endpoints marked "UI-ahead"
 * below (identity, registry) are not in the backend/spec yet and return
 * 404 — render that as a "not implemented yet" empty state, not a crash.
 */

import {
  ClustersApi,
  Configuration,
  ResponseError,
  SystemApi,
} from '@brandonrc/mobula-client'
import type { ClusterView, ServiceView, VersionInfo } from '@brandonrc/mobula-client'

import { isClusterState, type ClusterState } from './cluster-state'

// Canonical API shapes, re-exported from the generated client.
export type { ClusterView, ServiceView, VersionInfo }

// Mobula's four roles (mobula-auth). Kept in sync with the backend enum;
// `operator` was previously missing here — the kind of drift the generated
// client exists to prevent.
export type Role = 'viewer' | 'developer' | 'operator' | 'admin'

/**
 * UI-ahead: mobula-auth `Identity` is not yet exposed as an endpoint in
 * openapi.json, so this shape can't come from the client. When the backend
 * adds `GET /api/v1/identity`, delete this and import it from the client.
 * Note `roles` is a list (a caller can hold several) — matching the
 * backend's `Vec<Role>`.
 */
export interface Identity {
  subject: string
  email?: string
  groups: string[]
  roles: Role[]
}

/**
 * UI-ahead: no registry read endpoint exists in openapi.json yet. Import
 * from the client once the backend exposes it.
 */
export interface RegistryCluster {
  id: string
  hostname: string
  api_base_url: string
  token_set: boolean
  validation?: {
    ok: boolean
    message?: string
    checked_at?: string
  } | null
}

/**
 * A `ClusterView`'s state for display. The backend's `observed_state` is
 * null until the reconciler first observes the cluster, so fall back to the
 * `desired` state, then to `pending`. Every cluster badge in the UI routes
 * through here so the mapping from the wire shape to the nine renderable
 * `ClusterState`s lives in exactly one place.
 */
export function clusterViewState(view: ClusterView): ClusterState {
  if (isClusterState(view.observedState)) return view.observedState
  if (isClusterState(view.desired)) return view.desired
  return 'pending'
}

export interface MobulaApiErrorInit {
  kind: 'http' | 'network'
  status: number
  message: string
  requiredRole?: Role
  grantedRole?: Role
}

/**
 * API failure carrying enough context for the fail-closed UI (spec §1.4.6):
 * 403s render the required vs granted role, network failures render the
 * backend-unreachable empty state, 404s render "not implemented yet".
 */
export class MobulaApiError extends Error {
  readonly kind: 'http' | 'network'
  readonly status: number
  readonly requiredRole?: Role
  readonly grantedRole?: Role

  constructor(init: MobulaApiErrorInit) {
    super(init.message)
    this.name = 'MobulaApiError'
    this.kind = init.kind
    this.status = init.status
    this.requiredRole = init.requiredRole
    this.grantedRole = init.grantedRole
  }

  /** Endpoint does not exist in the running control plane. */
  get isNotImplemented(): boolean {
    return this.kind === 'http' && this.status === 404
  }

  /** `mobula serve` is down or unreachable. */
  get isUnreachable(): boolean {
    return this.kind === 'network'
  }

  /**
   * Network failure, or a 5xx from the control plane / dev proxy (spec §6:
   * "502 from gateway = cluster unreachable"). In dev, the Vite proxy
   * answers 500 when `mobula serve` isn't running.
   */
  get isUnavailable(): boolean {
    return (
      this.kind === 'network' || [500, 502, 503, 504].includes(this.status)
    )
  }

  get isForbidden(): boolean {
    return this.kind === 'http' && this.status === 403
  }
}

const ROLES: readonly Role[] = ['viewer', 'developer', 'operator', 'admin']

/**
 * A caller holds a set of roles (backend `Vec<Role>`); for display, pick
 * the most privileged. Admin > operator > developer > viewer.
 */
export function primaryRole(roles: readonly Role[]): Role | undefined {
  const rank: Record<Role, number> = {
    viewer: 0,
    developer: 1,
    operator: 2,
    admin: 3,
  }
  return [...roles].sort((a, b) => rank[b] - rank[a])[0]
}

function asRole(value: unknown): Role | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.toLowerCase()
  return (ROLES as readonly string[]).includes(normalized)
    ? (normalized as Role)
    : undefined
}

/**
 * Pull required/granted role out of an error response body, tolerating both
 * snake_case (backend JSON) and camelCase shapes. Used to render 403s per
 * spec §5.10.
 */
export function rolesFromErrorBody(body: unknown): {
  requiredRole?: Role
  grantedRole?: Role
} {
  if (typeof body !== 'object' || body === null) return {}
  const record = body as Record<string, unknown>
  const requiredRole =
    asRole(record.required_role) ?? asRole(record.requiredRole)
  const grantedRole = asRole(record.granted_role) ?? asRole(record.grantedRole)
  return { requiredRole, grantedRole }
}

function messageFromErrorBody(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const record = body as Record<string, unknown>
  for (const key of ['message', 'error', 'detail']) {
    if (typeof record[key] === 'string') return record[key]
  }
  return undefined
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', ...init?.headers },
    })
  } catch {
    throw new MobulaApiError({
      kind: 'network',
      status: 0,
      message:
        'Cannot reach the Mobula control plane. Start it with `mobula serve --dev-allow-unauthenticated`.',
    })
  }

  if (!res.ok) {
    const body = await res.json().catch(() => undefined)
    throw new MobulaApiError({
      kind: 'http',
      status: res.status,
      message:
        messageFromErrorBody(body) ??
        `Request failed: ${res.status} ${res.statusText}`,
      ...rolesFromErrorBody(body),
    })
  }

  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/**
 * Turn a thrown value from the generated client into a `MobulaApiError`.
 * The client throws `ResponseError` (carrying the raw `Response`) on a
 * non-2xx status and `FetchError` when the network call itself fails; both
 * become the fail-closed shape the UI already knows how to render.
 */
async function toMobulaError(err: unknown): Promise<MobulaApiError> {
  if (err instanceof MobulaApiError) return err
  if (err instanceof ResponseError) {
    const body = await err.response.json().catch(() => undefined)
    return new MobulaApiError({
      kind: 'http',
      status: err.response.status,
      message:
        messageFromErrorBody(body) ??
        `Request failed: ${err.response.status} ${err.response.statusText}`,
      ...rolesFromErrorBody(body),
    })
  }
  // A client-wrapped `FetchError` (network reject) or anything unexpected:
  // the control plane is unreachable.
  return new MobulaApiError({
    kind: 'network',
    status: 0,
    message:
      'Cannot reach the Mobula control plane. Start it with `mobula serve --dev-allow-unauthenticated`.',
  })
}

/** Run a generated-client call, normalizing any failure to `MobulaApiError`. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    throw await toMobulaError(err)
  }
}

// One shared client. `basePath: ''` makes the generated client issue
// relative URLs (`/api/v1/clusters`) against the UI's own origin — the Vite
// dev proxy and the production deploy both serve the API there. (Its default
// basePath is `http://localhost`, which would be wrong in the browser.)
const config = new Configuration({ basePath: '' })
const clustersApi = new ClustersApi(config)
const systemApi = new SystemApi(config)

/**
 * A job in the persistent, cross-cluster history (`GET /api/v1/jobs`, Phase
 * 3). Records outlive the clusters that ran them, so `cluster` may name a
 * cluster that no longer exists.
 */
export interface JobView {
  id: string
  cluster: string
  submitter: string
  /** Ray job status: PENDING | RUNNING | SUCCEEDED | FAILED | STOPPED. */
  status: string
  /** Wall-clock seconds once terminal; `null` while running. */
  duration_secs: number | null
  /** Unix seconds when the job was submitted. */
  submitted_at: number
}

export const api = {
  healthz: () => call(() => systemApi.healthz()),
  version: () => call(() => systemApi.version()),
  clusters: () => call(() => clustersApi.listClusters()),
  jobs: () => request<JobView[]>('/api/v1/jobs'),
  // UI-ahead: no generated endpoint yet — hand-fetched and 404 until the
  // backend adds them (see the `Identity` / `RegistryCluster` notes above).
  identity: () => request<Identity>('/api/v1/identity'),
  registryClusters: () => request<RegistryCluster[]>('/api/v1/registry/clusters'),
}
