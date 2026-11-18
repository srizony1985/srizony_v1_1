import type { ExternalValue } from '@/types/json'
import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireAdmin } from '@/lib/cms/guard'
import { db } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { readCmsSettingValueInfo } from '@/lib/cms/settings-store'
import { auditAdminAction } from '@/lib/security'
import { DEFAULT_FOOTER_CONFIG, FOOTER_CONFIG_SETTING_KEY, normalizeFooterConfig } from '@/lib/footerConfig'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  try {
    const result = await readCmsSettingValueInfo<ExternalValue>(FOOTER_CONFIG_SETTING_KEY)
    return NextResponse.json({ footer: normalizeFooterConfig(result.value ?? DEFAULT_FOOTER_CONFIG), dataSource: result.source, snapshotAt: result.snapshotAt, snapshotAgeMs: result.snapshotAgeMs, readOnly: result.source === 'google-drive-snapshot' }, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Srizony-Data-Source': result.source,
        ...(result.snapshotAt ? { 'X-Snapshot-Updated-At': result.snapshotAt, Warning: '110 - "Response is stale"' } : {}),
      },
    })
  } catch (error) {
    console.error('[footer-config] Unable to load footer configuration.', error)
    return NextResponse.json({ error: 'Unable to load footer configuration.' }, { status: 503 })
  }
}

export async function PUT(request: Request) {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  if (!db) return NextResponse.json({ error: 'Neon is not configured.' }, { status: 503 })

  const payload = await request.json().catch(() => null) as { footer?: ExternalValue } | null
  if (!payload || !payload.footer || typeof payload.footer !== 'object' || Array.isArray(payload.footer)) {
    return NextResponse.json({ error: 'A valid footer configuration is required.' }, { status: 400 })
  }

  try {
    const footer = normalizeFooterConfig(payload.footer)
    await db.insert(siteSettings).values({ key: FOOTER_CONFIG_SETTING_KEY, value: footer, updatedAt: new Date() }).onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: footer, updatedAt: new Date() },
    })
    revalidateTag('site-content', 'max')
    revalidatePath('/')
    await auditAdminAction({
      actorEmail: guard.admin!.email,
      action: 'footer.layout.update',
      entity: 'footer',
      entityId: 'site-footer',
      metadata: { enabled: footer.enabled, layoutColumns: footer.layoutColumns, sectionCount: footer.sections.length },
      request,
    })
    return NextResponse.json({ ok: true, footer }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[footer-config] Unable to save footer configuration.', error)
    return NextResponse.json({ error: 'Unable to save footer configuration.' }, { status: 503 })
  }
}
