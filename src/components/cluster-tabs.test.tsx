import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  ClusterTabError,
  JobsSection,
  NodesSection,
  formatCpuCores,
  formatGpu,
  formatJobDuration,
  formatJobStart,
  formatMemoryGiB,
} from '@/components/cluster-tabs'
import { MobulaApiError } from '@/lib/api'
import type { ClusterJobView, ClusterNodesView } from '@/lib/api'

describe('formatters', () => {
  it('formats memory bytes as GiB', () => {
    expect(formatMemoryGiB(2 * 1024 ** 3)).toBe('2.0 GiB')
    expect(formatMemoryGiB(null)).toBe('—')
    expect(formatMemoryGiB(undefined)).toBe('—')
  })

  it('formats cpu as cores with singular/plural', () => {
    expect(formatCpuCores(1)).toBe('1 core')
    expect(formatCpuCores(8)).toBe('8 cores')
    expect(formatCpuCores(0.5)).toBe('0.5 cores')
    expect(formatCpuCores(null)).toBe('—')
  })

  it('formats gpu count', () => {
    expect(formatGpu(2)).toBe('2')
    expect(formatGpu(null)).toBe('—')
  })

  it('formats job start and duration from epoch ms', () => {
    expect(formatJobStart(null)).toBe('—')
    expect(formatJobDuration(1000, 6000)).toBe('5s')
    expect(formatJobDuration(0, 90_000)).toBe('1m 30s')
    // still running (no end): dash, not a crash
    expect(formatJobDuration(1000, null)).toBe('—')
  })
})

const nodesData: ClusterNodesView = {
  cluster_id: 'team-b-scoring',
  head: {
    pod_name: 'raycluster-head-abc',
    is_head: true,
    phase: 'Running',
    ready: true,
    node_ip: '10.0.0.1',
    host: 'ip-10-0-0-1',
    cpu: 8,
    memory_bytes: 34_359_738_368,
    gpu: 0,
  },
  worker_groups: [
    {
      name: 'gpu-workers',
      desired: 2,
      ready: 1,
      nodes: [
        {
          pod_name: 'raycluster-worker-xyz',
          group: 'gpu-workers',
          is_head: false,
          phase: 'Running',
          ready: true,
          node_ip: '10.0.0.2',
          host: 'ip-10-0-0-2',
          cpu: 4,
          memory_bytes: 17_179_869_184,
          gpu: 1,
        },
      ],
    },
  ],
}

describe('NodesSection', () => {
  it('renders the head pod and each worker group with its nodes', () => {
    const html = renderToStaticMarkup(<NodesSection data={nodesData} />)
    expect(html).toContain('raycluster-head-abc')
    expect(html).toContain('gpu-workers')
    expect(html).toContain('raycluster-worker-xyz')
    expect(html).toContain('1/2 ready')
    // memory formatted to GiB, cpu to cores
    expect(html).toContain('GiB')
    expect(html).toContain('cores')
  })

  it('renders a placeholder when there is no head node', () => {
    const html = renderToStaticMarkup(
      <NodesSection data={{ ...nodesData, head: null }} />,
    )
    expect(html).toContain('No head node')
  })
})

describe('JobsSection', () => {
  it('renders a row per job', () => {
    const jobs: ClusterJobView[] = [
      {
        job_id: 'raysubmit_123',
        status: 'RUNNING',
        entrypoint: 'python train.py --epochs 10',
        start_time: 1_700_000_000_000,
        end_time: null,
      },
      {
        submission_id: 'sub_456',
        status: 'SUCCEEDED',
        entrypoint: 'python eval.py',
        start_time: 1_700_000_000_000,
        end_time: 1_700_000_060_000,
      },
    ]
    const html = renderToStaticMarkup(<JobsSection jobs={jobs} />)
    expect(html).toContain('raysubmit_123')
    expect(html).toContain('sub_456')
    expect(html).toContain('RUNNING')
    expect(html).toContain('SUCCEEDED')
    // entrypoint carries a title for the truncated cell
    expect(html).toContain('title="python train.py --epochs 10"')
  })

  it('renders the empty state when there are no jobs', () => {
    const html = renderToStaticMarkup(<JobsSection jobs={[]} />)
    expect(html).toContain('No jobs on this cluster yet.')
  })
})

describe('ClusterTabError', () => {
  it('renders a clean cluster-unreachable message on a 503', () => {
    const html = renderToStaticMarkup(
      <ClusterTabError
        error={
          new MobulaApiError({
            kind: 'http',
            status: 503,
            message: 'bad gateway to cluster',
          })
        }
      />,
    )
    expect(html).toContain('Cluster unreachable')
    expect(html).toContain('503')
  })
})
