/**
 * Typed API client for the Mobula control plane.
 *
 * API types come from `@brandonrc/mobula-client` — generated from mobula's
 * `openapi.json` (the source of truth) and published to GitHub Packages.
 * We never hand-write shapes the backend owns; re-exports below keep call
 * sites importing from `./api` while the truth lives in the package.
 *
 * Endpoints that exist today: `/healthz`, `/api/v1/version`,
 * `/api/v1/clusters`, `/api/v1/services`, `/api/v1/jobs`, `/api/v1/pools`,
 * `/api/v1/usage`. Endpoints marked "UI-ahead" below (identity, registry)
 * are not in the backend/spec yet and return 404 — render that as a
 * "not implemented yet" empty state, not a crash.
 */

import {
  ClustersApi,
  Configuration,
  JobsApi,
  PoolsApi,
  ResponseError,
  ServicesApi,
  SystemApi,
  UsageApi,
} from '@brandonrc/mobula-client'
import type {
  AllocationSpec,
  ClusterSpec,
  ClusterView,
  CreateCluster,
  CreatePool,
  DeployService,
  FlavorSpec,
  JobView,
  PoolSpec,
  PoolUsageView,
  PoolView,
  PutAllocation,
  ResourceUtilization,
  ServiceSpec,
  ServiceView,
  UpgradeStrategy,
  UsageGroup,
  UsageReport,
  VersionInfo,
  WorkerGroup,
} from '@brandonrc/mobula-client'

import type { AuditListResponse } from './audit'
import { getCurrentToken, notifySessionExpired } from './auth-token'
import { isClusterState, type ClusterState } from './cluster-state'

// Canonical API shapes, re-exported from the generated client.
export type {
  AllocationSpec,
  ClusterSpec,
  ClusterView,
  CreateCluster,
  CreatePool,
  DeployService,
  FlavorSpec,
  JobView,
  PoolSpec,
  PoolUsageView,
  PoolView,
  PutAllocation,
  ResourceUtilization,
  ServiceSpec,
  ServiceView,
  UpgradeStrategy,
  UsageGroup,
  UsageReport,
  VersionInfo,
  WorkerGroup,
}

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
 * UI-ahead: local-auth endpoints (api-v1.md §5.15, ADR-0011) are not yet in
 * the published `@brandonrc/mobula-client` — hand-written here like
 * `Identity`/`RegistryCluster`; delete and import from the client once
 * published. `identity.roles` comes from the local user's role column.
 */
export interface LocalLoginResponse {
  token: string
  token_type: string
  /** Unix seconds; informational for the UI. */
  expires_at: number
  identity: { subject: string; roles: Role[] }
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

  /** 401 — no session, or the held token was rejected (expired/revoked). */
  get isUnauthorized(): boolean {
    return this.kind === 'http' && this.status === 401
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

/**
 * Error bodies come in two shapes: JSON envelopes (authz denials carry
 * required/granted role) and plain-text strings (axum `(StatusCode, String)`
 * responses — e.g. 400 `invalid spec: …` / 409 `quota_exceeded …` on cluster
 * and pool creates). Read the body once as text, try JSON first, then fall
 * back to the raw string so those messages surface verbatim in forms.
 */
async function errorFromResponse(res: Response): Promise<MobulaApiError> {
  // A 401 while holding a token means it expired or was revoked — clear
  // the session so the UI routes to sign-in instead of retrying a dead
  // bearer. Anonymous 401s leave the session alone (there is none).
  if (res.status === 401 && getCurrentToken() != null) notifySessionExpired()
  const text = await res.text().catch(() => '')
  let body: unknown
  try {
    body = text ? JSON.parse(text) : undefined
  } catch {
    body = undefined
  }
  const trimmed = text.trim()
  return new MobulaApiError({
    kind: 'http',
    status: res.status,
    message:
      messageFromErrorBody(body) ??
      (trimmed !== '' ? trimmed : undefined) ??
      `Request failed: ${res.status} ${res.statusText}`,
    ...rolesFromErrorBody(body),
  })
}

/** Bearer header for the hand-rolled requests; empty when signed out. */
function authHeaders(): Record<string, string> {
  const token = getCurrentToken()
  return token != null ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', ...authHeaders(), ...init?.headers },
    })
  } catch {
    throw new MobulaApiError({
      kind: 'network',
      status: 0,
      message:
        'Cannot reach the Mobula control plane. Start it with `mobula serve --dev-allow-unauthenticated`.',
    })
  }

  if (!res.ok) throw await errorFromResponse(res)

  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Same failure semantics as `request()`, but returns the raw body text. */
async function requestText(path: string, init?: RequestInit): Promise<string> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: { ...authHeaders(), ...init?.headers },
    })
  } catch {
    throw new MobulaApiError({
      kind: 'network',
      status: 0,
      message:
        'Cannot reach the Mobula control plane. Start it with `mobula serve --dev-allow-unauthenticated`.',
    })
  }

  if (!res.ok) throw await errorFromResponse(res)
  return res.text()
}

/**
 * Turn a thrown value from the generated client into a `MobulaApiError`.
 * The client throws `ResponseError` (carrying the raw `Response`) on a
 * non-2xx status and `FetchError` when the network call itself fails; both
 * become the fail-closed shape the UI already knows how to render.
 */
async function toMobulaError(err: unknown): Promise<MobulaApiError> {
  if (err instanceof MobulaApiError) return err
  if (err instanceof ResponseError) return errorFromResponse(err.response)
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
// `accessToken` in function form so every request re-reads the current
// session token — sign-in/sign-out/expiry apply without rebuilding the
// client. Returning '' sends no Authorization header (the generator skips
// falsy tokens).
const config = new Configuration({
  basePath: '',
  accessToken: () => getCurrentToken() ?? '',
})
const clustersApi = new ClustersApi(config)
const jobsApi = new JobsApi(config)
const poolsApi = new PoolsApi(config)
const servicesApi = new ServicesApi(config)
const systemApi = new SystemApi(config)
const usageApi = new UsageApi(config)

export const api = {
  healthz: () => call(() => systemApi.healthz()),
  version: () => call(() => systemApi.version()),
  clusters: () => call(() => clustersApi.listClusters()),
  cluster: (id: string) => call(() => clustersApi.getCluster({ id })),
  createCluster: (createCluster: CreateCluster) =>
    call(() => clustersApi.createCluster({ createCluster })),
  deleteCluster: (id: string) => call(() => clustersApi.deleteCluster({ id })),
  jobs: () => call(() => jobsApi.listJobs()),
  pools: () => call(() => poolsApi.listPools()),
  pool: (name: string) => call(() => poolsApi.getPool({ name })),
  createPool: (spec: PoolSpec) =>
    call(() => poolsApi.createPool({ createPool: { spec } })),
  deletePool: (name: string) => call(() => poolsApi.deletePool({ name })),
  allocations: (name: string) =>
    call(() => poolsApi.listAllocations({ name })),
  putAllocation: (name: string, project: string, putAllocation: PutAllocation) =>
    call(() => poolsApi.putAllocation({ name, project, putAllocation })),
  deleteAllocation: (name: string, project: string) =>
    call(() => poolsApi.deleteAllocation({ name, project })),
  poolUsage: (name: string) => call(() => poolsApi.poolUsage({ name })),
  /**
   * Ray Serve services (Phase 4). The routes are only mounted when `serve`
   * runs with a service provisioner — otherwise these 404, which the UI
   * renders as "services API not available on this deployment".
   */
  services: () => call(() => servicesApi.listServices()),
  service: (name: string) => call(() => servicesApi.getService({ name })),
  deployService: (deployService: DeployService) =>
    call(() => servicesApi.deployService({ deployService })),
  deleteService: (name: string) =>
    call(() => servicesApi.deleteService({ name })),
  /** Window bounds are unix seconds; both optional (backend defaults: last 24h). */
  usage: (from?: number, to?: number) =>
    call(() => usageApi.usageReport({ from, to })),
  // UI-ahead: no generated endpoint yet — hand-fetched and 404 until the
  // backend adds them (see the `Identity` / `RegistryCluster` notes above).
  identity: () => request<Identity>('/api/v1/identity'),
  registryClusters: () => request<RegistryCluster[]>('/api/v1/registry/clusters'),
  /**
   * UI-ahead: `GET /api/v1/audit` landed backend-side (api-v1.md §5.9,
   * 2026-08-16) but is not yet in the published `@brandonrc/mobula-client`
   * — hand-fetched like identity/registry above, with the query string
   * built by `buildAuditQuery` in `./audit`. Migrate to the generated
   * AuditApi once the client is republished. 404 on older backends → the
   * page renders the not-implemented state.
   */
  audit: (queryString: string) =>
    request<AuditListResponse>(`/api/v1/audit${queryString}`),
  /** `?format=csv` export — same filters, raw text body for download. */
  auditCsv: (queryString: string) =>
    requestText(`/api/v1/audit${queryString}`, {
      headers: { Accept: 'text/csv' },
    }),
  /**
   * UI-ahead: local auth (api-v1.md §5.15, ADR-0011) is not yet in the
   * published `@brandonrc/mobula-client` — hand-fetched like identity/audit
   * above; migrate to the generated client once published. `providers` is
   * public and always mounted on auth-enabled backends (404 on older ones
   * → the login page falls back to env-based discovery). `login` is public;
   * every failure is the identical 401 `invalid_credentials`. `logout`
   * revokes the caller's PAT.
   */
  authProviders: () => request<unknown>('/api/v1/auth/providers'),
  authLogin: (username: string, password: string) =>
    request<LocalLoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
  authLogout: () =>
    request<void>('/api/v1/auth/logout', { method: 'POST' }),
}
