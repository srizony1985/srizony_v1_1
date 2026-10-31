import 'server-only'

export type DataProvider = 'neon'

/** All CMS documents and relational domains are stored in the same Neon PostgreSQL database. */
export async function getSelectedDataProvider(): Promise<DataProvider> { return 'neon' }

/** Kept for backwards-compatible API callers; selecting a non-Neon provider is rejected. */
export async function setSelectedDataProvider(provider: DataProvider) {
  if (provider !== 'neon') throw new Error('Neon PostgreSQL is the only supported CMS source of truth.')
}
