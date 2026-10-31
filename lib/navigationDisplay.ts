import { getPublicSiteSnapshot } from '@/lib/site'
export async function getNavigationDisplay() {
  const { global } = await getPublicSiteSnapshot('/')
  return { primaryNav: global.primaryNav, navGroups: global.navGroups, ui: global.ui }
}
