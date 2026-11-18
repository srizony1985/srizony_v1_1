
import type { ExternalValue } from '@/types/json'
import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/cms/guard'
import { db } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { readCmsSettingValueInfo } from '@/lib/cms/settings-store'
import { auditAdminAction } from '@/lib/security'
import {
  normalizeThemeTypographySettings,
  THEME_TYPOGRAPHY_SETTING_KEY,
} from '@/lib/themeTypography'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const headers = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers })
}

/**
 * Public typography read endpoint.
 */
export async function GET() {
  try {
    const result = await readCmsSettingValueInfo<ExternalValue>(
      THEME_TYPOGRAPHY_SETTING_KEY,
    )

    return NextResponse.json(
      {
        typography: normalizeThemeTypographySettings(result.value),
        dataSource: result.source,
        snapshotAt: result.snapshotAt,
        snapshotAgeMs: result.snapshotAgeMs,
        readOnly: result.source === 'google-drive-snapshot',
      },
      {
        headers: {
          ...headers,
          'X-Srizony-Data-Source': result.source,
          ...(result.snapshotAt
            ? {
                'X-Snapshot-Updated-At': result.snapshotAt,
                Warning: '110 - "Response is stale"',
              }
            : {}),
        },
      },
    )
  } catch (error) {
    console.error('[Typography API] Failed to load settings:', error)
    return jsonError('Unable to load typography settings.', 503)
  }
}

/**
 * Protected typography update endpoint.
 * Requires an authenticated admin or editor.
 */
export async function PUT(request: Request) {
  try {
    const guard = await requireAdmin('admin', 'editor')

    if (guard.denied) {
      return guard.denied
    }

    if (!db) {
      return jsonError('Neon database is not configured.', 503)
    }

    let payload: { typography?: ExternalValue } | null

    try {
      payload = await request.json()
    } catch {
      return jsonError('Invalid JSON request body.', 400)
    }

    if (
      !payload ||
      !payload.typography ||
      typeof payload.typography !== 'object' ||
      Array.isArray(payload.typography)
    ) {
      return jsonError(
        'A valid typography configuration is required.',
        400,
      )
    }

    const typography = normalizeThemeTypographySettings(
      payload.typography,
    )

    await db
      .insert(siteSettings)
      .values({
        key: THEME_TYPOGRAPHY_SETTING_KEY,
        value: typography,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: {
          value: typography,
          updatedAt: new Date(),
        },
      })

    revalidateTag('site-content', { expire: 0 })
    revalidatePath('/', 'layout')

    await auditAdminAction({
      actorEmail: guard.admin!.email,
      action: 'theme.typography.update',
      entity: 'theme',
      entityId: 'site-theme',
      metadata: { typography },
      request,
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Typography settings updated successfully.',
        typography,
      },
      { headers },
    )
  } catch (error) {
    console.error('[Typography API] Failed to update settings:', error)

    return jsonError(
      'Unable to save typography settings.',
      503,
    )
  }
}
