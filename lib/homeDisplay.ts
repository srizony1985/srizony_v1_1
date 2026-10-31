import { getPublicSiteSnapshot } from '@/lib/site'

export async function getHomeDisplay() {
  const snapshot = await getPublicSiteSnapshot('/')
  return { page: snapshot.page, hero: snapshot.global.homeHero }
}
