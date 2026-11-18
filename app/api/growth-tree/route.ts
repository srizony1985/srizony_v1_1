import { NextResponse } from 'next/server'
import { readCmsSettingValueInfo } from '@/lib/cms/settings-store'
import {
  DEFAULT_GROWTH_MILESTONES,
  GROWTH_TREE_SETTING_KEY,
  normalizeGrowthMilestones,
} from '@/lib/GrowthMilestones'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate' }

export async function GET() {
  try {
    const result = await readCmsSettingValueInfo<unknown>(GROWTH_TREE_SETTING_KEY)
    return NextResponse.json({
      ok: true,
      milestones: normalizeGrowthMilestones(result.value),
      dataSource: result.source,
      readOnly: result.source === 'google-drive-snapshot',
      snapshotAt: result.snapshotAt,
    }, { headers })
  } catch (error) {
    console.error('[Growth tree API] Unable to read CMS milestones; serving bootstrap content.', error)
    return NextResponse.json({
      ok: true,
      milestones: DEFAULT_GROWTH_MILESTONES,
      dataSource: 'defaults',
      readOnly: true,
    }, { headers })
  }
}
