/** Centralized admin resource transport. Keep endpoint URLs and cache policy out of UI components. */
export function websiteEssentialsRequest(init: RequestInit = {}) {
  return fetch('/api/website-essentials', { cache: 'no-store', ...init })
}

export function adminMediaUpload(form: FormData) {
  return fetch('/api/admin/media/upload', { method: 'POST', body: form, cache: 'no-store' })
}

export function cmsPipelineRequest(init: RequestInit = {}) {
  return fetch('/api/admin/cms-pipeline', { cache: 'no-store', ...init })
}

export function databaseExportRequest() {
  return fetch('/api/admin/database/export', { credentials: 'same-origin', cache: 'no-store' })
}

export function databaseImportRequest(rawJson: string) {
  return fetch('/api/admin/database/import', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: rawJson,
  })
}
