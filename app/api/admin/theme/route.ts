import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, hasAdminRole } from '@/lib/adminAuth'
import { getCmsEditorData, getThemeConfig, saveDocument } from '@/lib/site'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
// Clients may send a complete theme object containing nested label/typography
// metadata. The API intentionally accepts that shape but persists only editable
// six-digit hex color tokens, preserving all non-color theme metadata.
const paletteSchema = z.record(z.string(), z.unknown())

export async function GET() {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const config = await getThemeConfig()
  return NextResponse.json(config, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(req: Request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasAdminRole(admin, 'admin')) return NextResponse.json({ error: 'Administrator permission required.' }, { status: 403 })
  const body = await req.json().catch(() => null)
  const result = z.object({ name: z.string().trim().min(1).max(40), palette: paletteSchema }).safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: 'Theme payload must include a theme name and a palette object.', details: result.error.issues.map((issue) => issue.message) }, { status: 400 })
  }

  const config = await getThemeConfig()
  const current = config.themes as Record<string, Record<string, unknown>>
  const existingPalette = current[result.data.name] || current.forest || {}
  const updates: Record<string, string> = {}
  const invalidTokens: string[] = []

  for (const [key, value] of Object.entries(result.data.palette)) {
    const existingValue = existingPalette[key]
    // Nested metadata such as `label` and `typography` is valid input, but is
    // not an editable color token and must not overwrite its stored structure.
    if (typeof existingValue !== 'string' || !HEX_COLOR.test(existingValue)) continue
    if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
      invalidTokens.push(key)
      continue
    }
    updates[key] = value
  }

  if (invalidTokens.length) {
    return NextResponse.json({
      error: `Invalid color value${invalidTokens.length > 1 ? 's' : ''}: ${invalidTokens.join(', ')}. Use six-digit hexadecimal colors such as #137b50.`,
      field: 'palette',
      invalidTokens,
    }, { status: 400 })
  }
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No editable color tokens were provided.', field: 'palette' }, { status: 400 })
  }

  const next = { ...current, [result.data.name]: { ...existingPalette, ...updates } }
  try {
    const content = await getCmsEditorData()
    await saveDocument('site-global', { ...(content.global || {}), themes: next }, 'global')
    return NextResponse.json({ ok: true, themes: next })
  } catch {
    return NextResponse.json({ error: 'Database update failed.' }, { status: 503 })
  }
}
