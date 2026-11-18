import { NextResponse } from 'next/server'
import { getThemeConfig } from '@/lib/site'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const headers = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

export async function GET() {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.info('[Theme Typography API] Handler reached')
    }

    const config = await getThemeConfig()

    if (!config) {
      console.error('[Theme Typography API] Configuration not found')

      return NextResponse.json(
        { error: 'Theme configuration not found' },
        { status: 404, headers },
      )
    }

    return NextResponse.json(config, { status: 200, headers })
  } catch (error) {
    console.error('[Theme Typography API] Failed to load configuration:', error)

    return NextResponse.json(
      { error: 'Unable to load typography configuration' },
      { status: 500, headers },
    )
  }
}