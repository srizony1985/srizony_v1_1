import { NextResponse } from 'next/server'
import { getAdminSession, hasAdminRole } from '@/lib/adminAuth'
import { getSelectedDataProvider, setSelectedDataProvider, type DataProvider } from '@/lib/data-provider'
import { checkGoogleDriveConnection } from '@/lib/google/drive'

export const dynamic = 'force-dynamic'

async function authorize() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasAdminRole(session, 'admin')) return NextResponse.json({ error: 'Administrator permission required.' }, { status: 403 })
  return null
}

export async function GET() {
  const denied = await authorize()
  if (denied) return denied
  const selected = await getSelectedDataProvider()
  const providers = [
    { id: 'neon', label: 'Neon PostgreSQL', configured: Boolean(process.env.DATABASE_URL?.trim()) },
    { id: 'google-drive', label: 'Google Drive JSON', configured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim() && process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()) },
  ]
  return NextResponse.json({ selected, providers, note: 'This selector sets the active CMS document-store preference. Relational CMS tables still use Neon until their repositories are migrated to the provider interface.' }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const denied = await authorize()
  if (denied) return denied
  const body = await request.json().catch(() => null) as { provider?: DataProvider; verifyDrive?: boolean } | null
  if (body?.provider !== 'neon' && body?.provider !== 'google-drive') return NextResponse.json({ error: 'Choose Neon PostgreSQL or Google Drive JSON.' }, { status: 400 })
  try {
    if (body.provider === 'google-drive') {
      if (body.verifyDrive) await checkGoogleDriveConnection()
      else if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
        return NextResponse.json({ error: 'Configure Google service-account credentials and a Drive folder before switching.' }, { status: 400 })
      }
    }
    await setSelectedDataProvider(body.provider)
    return NextResponse.json({ ok: true, selected: body.provider })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to change data provider.' }, { status: 503 })
  }
}
