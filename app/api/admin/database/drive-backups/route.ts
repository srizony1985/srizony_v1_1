import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/cms/guard'
import { listGoogleDriveBackups } from '@/lib/google/drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireAdmin('admin')
  if (guard.denied) return guard.denied

  try {
    const drive = await listGoogleDriveBackups()
    return NextResponse.json({ configured: true, ...drive }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({
      configured: false,
      backups: [],
      error: error instanceof Error ? error.message : 'Google Drive JSON backup status is unavailable.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
