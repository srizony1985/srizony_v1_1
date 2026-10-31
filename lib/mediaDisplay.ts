import { getPublicSiteSnapshot } from '@/lib/site'
export async function getMediaDisplay() {
  const { global } = await getPublicSiteSnapshot('/')
  return { media: global.media }
}
