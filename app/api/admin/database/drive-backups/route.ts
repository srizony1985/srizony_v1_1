import type { ExternalValue } from '@/types/json'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/cms/guard'
import { listGoogleDriveBackups } from '@/lib/google/drive'
import { auditAdminAction } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GITHUB_API = 'https://api.github.com'
const BACKUP_WORKFLOW = 'production-google-drive-backup.yml'

type WorkflowStatus = {
  configured: boolean
  available: boolean
  name?: string
  state?: string
  path?: string
  error?: string
}

function githubConfig() {
  const token = process.env.GITHUB_BACKUP_TOKEN?.trim()
  const repository = process.env.GITHUB_BACKUP_REPOSITORY?.trim() || process.env.GITHUB_REPOSITORY?.trim()
  const ref = process.env.GITHUB_BACKUP_REF?.trim() || 'main'
  if (!token || !repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('Configure GITHUB_BACKUP_TOKEN and GITHUB_BACKUP_REPOSITORY to enable CMS-triggered backup and restore jobs.')
  }
  return { token, repository, ref }
}

async function getWorkflowStatus(): Promise<WorkflowStatus> {
  try {
    const { token, repository } = githubConfig()
    const response = await fetch(
      `${GITHUB_API}/repos/${repository}/actions/workflows/${BACKUP_WORKFLOW}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      },
    )

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      return {
        configured: true,
        available: false,
        error: `GitHub Actions workflow check failed (${response.status}): ${detail.slice(0, 240) || response.statusText}`,
      }
    }

    const workflow = await response.json() as { name?: string; state?: string; path?: string }
    const available = workflow.state === 'active'
    return {
      configured: true,
      available,
      name: workflow.name,
      state: workflow.state,
      path: workflow.path,
      ...(!available ? { error: `The ${BACKUP_WORKFLOW} workflow is not active on GitHub.` } : {}),
    }
  } catch (error) {
    return {
      configured: false,
      available: false,
      error: error instanceof Error ? error.message : 'GitHub Actions workflow is unavailable.',
    }
  }
}

async function dispatchBackupWorkflow(inputs: Record<string, string | boolean>) {
  const { token, repository, ref } = githubConfig()
  const response = await fetch(`${GITHUB_API}/repos/${repository}/actions/workflows/${BACKUP_WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref, inputs }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`GitHub Actions could not be started (${response.status}): ${detail.slice(0, 400) || response.statusText}`)
  }
}

function archiveCreationError(drive: Awaited<ReturnType<typeof listGoogleDriveBackups>>) {
  if (!drive.isSharedDrive) {
    return 'Full archive uploads by this service account require a Shared Drive. Move the backup folder into a Shared Drive and add the service account as a Contributor or Content manager.'
  }
  if (!drive.canAddChildren) {
    return 'The service account cannot create files in this Shared Drive folder. Grant a role that allows adding files (for example Contributor or Content manager).'
  }
  return null
}

async function ensureWorkflowReady() {
  const workflow = await getWorkflowStatus()
  if (!workflow.available) throw new Error(workflow.error || 'The Google Drive backup GitHub Actions workflow is not available.')
}

export async function GET() {
  const guard = await requireAdmin('admin')
  if (guard.denied) return guard.denied

  const workflow = await getWorkflowStatus()

  try {
    const drive = await listGoogleDriveBackups()
    const jsonMirrors = drive.backups.filter((item) => item.type === 'json-mirror')
    const archives = drive.backups.filter((item) => item.type === 'point-in-time')
    const restorableArchives = archives.filter((item) => item.restorable)
    const writableMirrorCount = jsonMirrors.filter((item) => item.canEdit).length
    const downloadableRestoreCount = restorableArchives.filter((item) => item.canDownload).length
    const createArchiveError = archiveCreationError(drive)
    const workflowReady = workflow.available
    const canCreateArchive = !createArchiveError && workflowReady

    return NextResponse.json({
      configured: true,
      ...drive,
      workflow,
      readiness: {
        authentication: true,
        folderRead: true,
        fileListing: drive.canListChildren,
        canCreateArchive,
        createArchiveError,
        jsonMirrorCount: jsonMirrors.length,
        writableJsonMirrorCount: writableMirrorCount,
        canUpdateJsonMirrors: jsonMirrors.length > 0 && writableMirrorCount === jsonMirrors.length,
        archiveCount: archives.length,
        restorableArchiveCount: restorableArchives.length,
        downloadableRestoreCount,
        canRestore: canCreateArchive && downloadableRestoreCount > 0,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({
      configured: false,
      backups: [],
      workflow,
      readiness: {
        authentication: false,
        folderRead: false,
        fileListing: false,
        canCreateArchive: false,
        canRestore: false,
      },
      error: error instanceof Error ? error.message : 'Google Drive backup status is unavailable.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin('admin')
  if (guard.denied) return guard.denied

  const payload = await request.json().catch(() => null) as {
    operation?: ExternalValue
    backupId?: ExternalValue
    confirmation?: ExternalValue
  } | null
  const operation = payload?.operation
  if (operation !== 'backup' && operation !== 'restore') {
    return NextResponse.json({ error: 'Choose either backup or restore.' }, { status: 400 })
  }

  try {
    const drive = await listGoogleDriveBackups()
    const createError = archiveCreationError(drive)
    if (createError) throw new Error(createError)
    await ensureWorkflowReady()

    if (operation === 'backup') {
      await dispatchBackupWorkflow({ operation: 'backup', full_snapshot: true })
      await auditAdminAction({ actorEmail: guard.admin!.email, action: 'database.point_in_time_backup.request', entity: 'google_drive_backup', metadata: { source: 'cms' }, request })
      return NextResponse.json({ ok: true, message: 'Point-in-time backup job accepted by GitHub Actions.' }, { status: 202 })
    }

    if (payload?.confirmation !== 'RESTORE PRODUCTION') {
      return NextResponse.json({ error: 'Type RESTORE PRODUCTION to confirm the destructive restore.' }, { status: 400 })
    }
    if (typeof payload.backupId !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(payload.backupId)) {
      return NextResponse.json({ error: 'Select a valid point-in-time backup.' }, { status: 400 })
    }

    const selected = drive.backups.find((item) => item.id === payload.backupId && item.restorable)
    if (!selected) return NextResponse.json({ error: 'The selected file is not a verified full backup in this Drive folder.' }, { status: 404 })
    if (!selected.canDownload) return NextResponse.json({ error: 'The service account cannot download this archive. Check the archive permissions in Google Drive.' }, { status: 403 })

    await dispatchBackupWorkflow({
      operation: 'restore',
      restore_file_id: selected.id,
      confirm_restore: 'RESTORE PRODUCTION',
    })
    await auditAdminAction({ actorEmail: guard.admin!.email, action: 'database.point_in_time_restore.request', entity: 'google_drive_backup', entityId: selected.id, metadata: { backupName: selected.name }, request })
    return NextResponse.json({ ok: true, message: `Restore job accepted for ${selected.name}. A pre-restore backup will be created first.` }, { status: 202 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to start the backup operation.' }, { status: 503 })
  }
}
