import { lazy, type ComponentType } from 'react'

export interface MonthConfig {
  id: string
  label: string
  component: React.LazyExoticComponent<ComponentType>
}

export const months: MonthConfig[] = [
  { id: '2026-06', label: 'June 2026', component: lazy(() => import('./jun-2026')) },
  { id: '2026-05', label: 'May 2026', component: lazy(() => import('./may-2026')) },
  { id: '2026-04', label: 'April 2026', component: lazy(() => import('./apr-2026')) },
  { id: '2026-03', label: 'March 2026', component: lazy(() => import('./mar-2026')) },
  { id: '2026-02', label: 'February 2026', component: lazy(() => import('./feb-2026')) },
  { id: '2026-01', label: 'January 2026', component: lazy(() => import('./jan-2026')) },
]

export const defaultMonth = months[0].id
