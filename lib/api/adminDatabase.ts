import { adminRequest } from './http'

export type DriveBackupItem = {
  id: string
  name: string
  type: 'point-in-time' | 'json-mirror'
  createdTime: string | null
  sizeBytes: number
  webViewLink: string | null
  sha256: string | null
  restorable?: boolean
  canEdit?: boolean
  canDownload?: boolean
}

export type DriveBackupStatus = {
  configured: boolean
  folderName?: string
  isSharedDrive?: boolean
  canAddChildren?: boolean
  folderCanEdit?: boolean
  canListChildren?: boolean
  backups?: DriveBackupItem[]
  workflow?: { configured: boolean; available: boolean; name?: string; state?: string; path?: string; error?: string }
  readiness?: {
    authentication: boolean
    folderRead: boolean
    fileListing: boolean
    canCreateArchive: boolean
    createArchiveError?: string | null
    jsonMirrorCount?: number
    writableJsonMirrorCount?: number
    canUpdateJsonMirrors?: boolean
    archiveCount?: number
    restorableArchiveCount?: number
    downloadableRestoreCount?: number
    canRestore: boolean
  }
  error?: string
}

export type DriveBackupOperationResponse = { ok?: boolean; message?: string; error?: string }

export const getGoogleDriveBackupStatus = () =>
  adminRequest<DriveBackupStatus>('/api/admin/database/drive-backups', {}, 'Unable to read Google Drive backup status.')

export const requestGoogleDriveBackup = () =>
  adminRequest<DriveBackupOperationResponse>('/api/admin/database/drive-backups', {
    method: 'POST',
    json: { operation: 'backup' },
  }, 'Unable to start a point-in-time backup.')

export const requestGoogleDriveRestore = (backupId: string, confirmation: 'RESTORE PRODUCTION') =>
  adminRequest<DriveBackupOperationResponse>('/api/admin/database/drive-backups', {
    method: 'POST',
    json: { operation: 'restore', backupId, confirmation },
  }, 'Unable to start the selected restore.')
