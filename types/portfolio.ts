import type { Bilingual } from '@/types/entityType'
import type { JsonValue } from '@/types/json'

export type PortfolioText = string | Bilingual

export type PortfolioBrandIdentity = {
  name?: PortfolioText
  descriptor?: PortfolioText
  tagline?: PortfolioText
  summary?: PortfolioText
  logo?: string
}

/** Optional organization profile values stored alongside the public CMS global. */
export type PortfolioGlobal = {
  brandIdentity?: PortfolioBrandIdentity
  [key: string]: JsonValue | PortfolioBrandIdentity | undefined
}
