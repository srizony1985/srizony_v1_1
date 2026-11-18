import 'server-only'

export type DataProvider = 'neon'

/** Neon is the authoritative primary/write provider; selected public reads have a separate validated, read-only Google Drive snapshot failover. */
export async function getSelectedDataProvider(): Promise<DataProvider> { return 'neon' }

/** Kept for backwards-compatible API callers; selecting a non-Neon provider is rejected. */
export async function setSelectedDataProvider(provider: DataProvider) {
  if (provider !== 'neon') throw new Error('Neon PostgreSQL remains the only writable CMS source of truth; Google Drive snapshots are read-only failover.')
}
