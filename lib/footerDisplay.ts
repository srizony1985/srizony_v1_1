import { getPublicSiteSnapshot } from '@/lib/site'
export async function getFooterDisplay() {
  const { global } = await getPublicSiteSnapshot('/')
  return { primaryNav: global.primaryNav, navGroups: global.navGroups, ui: global.ui, contactInfo: global.contactInfo, logo: global.siteIdentity.logo || global.images.logo }
}
