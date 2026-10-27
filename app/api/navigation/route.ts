import { NextResponse } from 'next/server'
import { getPublicSiteSnapshot } from '@/lib/site'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const site = await getPublicSiteSnapshot('/')
    return NextResponse.json(
      { primaryNav: site.global.primaryNav, navGroups: site.global.navGroups, ui: site.global.ui },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate', Vary: 'Cookie' } },
    )
  } catch (error) {
    console.error('Public navigation read failed', error)
    return NextResponse.json(
      { error: 'Unable to load navigation.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
