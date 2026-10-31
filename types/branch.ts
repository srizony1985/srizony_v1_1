import type { Bilingual } from '@/types/entityType'

export type BranchManager = {
  name?: Bilingual
  title?: Bilingual
  phone?: string
  email?: string
}

/** Shared type for the database-managed office/branch directory. */
export type Branch = {
  id: string
  kind: 'head' | 'branch'
  name: Bilingual
  district: Bilingual
  division: Bilingual
  address?: Bilingual
  lat: number
  lng: number
  manager?: BranchManager
}
