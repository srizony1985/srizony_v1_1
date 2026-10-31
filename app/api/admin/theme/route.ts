import { NextResponse } from 'next/server'

/** Theme and colour editing is intentionally not part of the CMS. */
function removed() {
  return NextResponse.json({ error: 'Theme and colour selection has been removed. Website appearance is controlled by the fixed design system.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() { return removed() }
export async function PUT() { return removed() }
