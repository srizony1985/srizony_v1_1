import { NextResponse } from 'next/server'

/** Retired compatibility endpoint. Public clients use the consolidated site snapshot API. */
export async function GET() {
  return NextResponse.json(
    { error: { code: 'ENDPOINT_RETIRED', message: 'This endpoint is retired. Use /api/site?slug=%2Fnews.' } },
    { status: 410, headers: {
      'Cache-Control': 'no-store',
      'Deprecation': 'true',
      'Link': '</api/site?slug=%2Fnews>; rel="successor-version"',
    } },
  )
}
