import {
  Boxes,
  ChartColumn,
  LayoutDashboard,
  Layers,
  ListChecks,
  Rocket,
  ScrollText,
  Settings,
  SquareTerminal,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

/** Information architecture from spec §4. */
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/clusters', label: 'Clusters', icon: Boxes },
  { to: '/services', label: 'Services', icon: Rocket },
  { to: '/pools', label: 'Pools', icon: Layers },
  { to: '/usage', label: 'Usage', icon: ChartColumn },
  { to: '/jobs', label: 'Jobs', icon: ListChecks },
  { to: '/registry', label: 'Registry', icon: SquareTerminal },
  { to: '/audit', label: 'Audit', icon: ScrollText },
  { to: '/access', label: 'Access', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <span className="text-sm font-semibold tracking-tight">Mobula</span>
        <span className="text-xs text-muted-foreground">console</span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive && 'bg-accent font-medium text-accent-foreground',
              )
            }
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-2">
        {/* Link out, don't rebuild (spec §4). Proxied in dev, same-origin in prod. */}
        <a
          href="/docs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ScrollText className="size-4" aria-hidden />
          API docs ↗
        </a>
      </div>
    </aside>
  )
}
