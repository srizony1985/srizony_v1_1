import { adminRequest } from './http'
import type { Milestone } from '@/lib/GrowthMilestones'

export type GrowthTreeApiResponse = {
  ok?: boolean
  milestones?: Milestone[]
  dataSource?: string
  readOnly?: boolean
  snapshotAt?: string | null
  message?: string
  error?: string
  warning?: string
}

export const getGrowthTreeAdmin = () =>
  adminRequest<GrowthTreeApiResponse>(
    '/api/admin/growth-tree',
    {},
    'Unable to load homepage growth-tree records.',
  )

export const saveGrowthTreeAdmin = (milestones: Milestone[]) =>
  adminRequest<GrowthTreeApiResponse>(
    '/api/admin/growth-tree',
    { method: 'PUT', json: { milestones } },
    'Unable to save homepage growth-tree records.',
  )
