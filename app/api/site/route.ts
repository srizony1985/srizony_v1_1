import { NextResponse } from 'next/server'
import { getPublicSiteSnapshot } from '@/lib/site'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug') || '/'
    const snapshot = await getPublicSiteSnapshot(slug)
    const pageOnly = searchParams.get('view') === 'page'
    const payload = pageOnly
      ? { ok: true, canonicalSlug: snapshot.canonicalSlug, page: snapshot.page, notFound: snapshot.notFound }
      : { ok: true, ...snapshot }
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Public site read failed', error)
    return NextResponse.json({ ok: false, error: { code: 'SITE_READ_FAILED', message: 'Unable to load published site content.' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
