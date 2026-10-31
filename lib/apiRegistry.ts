// Registry shown in Settings → Database & APIs. Regenerate when routes change (see scripts/gen-api-registry notes in README).
export type ApiEndpoint = { method: string; path: string; access: string; description: string }
export const API_REGISTRY: ApiEndpoint[] = [
 {
  "method": "GET",
  "path": "/api/admin/content",
  "access": "CMS session",
  "description": "Page documents (legacy JSON store)"
 },
 {
  "method": "PUT",
  "path": "/api/admin/content",
  "access": "CMS session",
  "description": "Page documents (legacy JSON store)"
 },
 {
  "method": "GET",
  "path": "/api/admin/content/index",
  "access": "CMS session",
  "description": "Page/menu index"
 },
 {
  "method": "GET",
  "path": "/api/admin/dashboard",
  "access": "CMS session",
  "description": "Dashboard analytics"
 },
 {
  "method": "GET",
  "path": "/api/admin/database",
  "access": "CMS session",
  "description": "Table inventory"
 },
 {
  "method": "GET",
  "path": "/api/admin/database/export",
  "access": "Admin session",
  "description": "Export editable CMS and public site data as structured JSON"
 },
 {
  "method": "POST",
  "path": "/api/admin/database/import",
  "access": "Admin session",
  "description": "Validate and merge CMS site-data JSON by primary key; omitted records are preserved"
 },
 {
  "method": "GET",
  "path": "/api/admin/donations",
  "access": "CMS session",
  "description": "Donation report"
 },
 {
  "method": "DELETE",
  "path": "/api/admin/entities",
  "access": "CMS session",
  "description": "Read-only table browser"
 },
 {
  "method": "GET",
  "path": "/api/admin/entities",
  "access": "CMS session",
  "description": "Read-only table browser"
 },
 {
  "method": "PATCH",
  "path": "/api/admin/entities",
  "access": "CMS session",
  "description": "Read-only table browser"
 },
 {
  "method": "POST",
  "path": "/api/admin/entities",
  "access": "CMS session",
  "description": "Read-only table browser"
 },
 {
  "method": "GET",
  "path": "/api/admin/form-users",
  "access": "CMS session",
  "description": "Public form users"
 },
 {
  "method": "GET",
  "path": "/api/admin/jobs",
  "access": "CMS session",
  "description": "Job summaries and applications"
 },
 {
  "method": "PATCH",
  "path": "/api/admin/jobs",
  "access": "CMS session",
  "description": "Job summaries and applications"
 },
 {
  "method": "POST",
  "path": "/api/admin/login",
  "access": "Public",
  "description": "CMS sign-in"
 },
 {
  "method": "POST",
  "path": "/api/admin/media/upload",
  "access": "CMS session",
  "description": "Media upload"
 },
 {
  "method": "DELETE",
  "path": "/api/admin/navigation",
  "access": "CMS session",
  "description": "Menu tree: add, rename, remove, drag-and-drop order"
 },
 {
  "method": "GET",
  "path": "/api/admin/navigation",
  "access": "CMS session",
  "description": "Menu tree: add, rename, remove, drag-and-drop order"
 },
 {
  "method": "PATCH",
  "path": "/api/admin/navigation",
  "access": "CMS session",
  "description": "Menu tree: add, rename, remove, drag-and-drop order"
 },
 {
  "method": "POST",
  "path": "/api/admin/navigation",
  "access": "CMS session",
  "description": "Menu tree: add, rename, remove, drag-and-drop order"
 },
 {
  "method": "PUT",
  "path": "/api/admin/navigation",
  "access": "CMS session",
  "description": "Menu tree: add, rename, remove, drag-and-drop order"
 },
 {
  "method": "DELETE",
  "path": "/api/admin/session",
  "access": "CMS session",
  "description": "CMS sign-out"
 },
 {
  "method": "GET",
  "path": "/api/admin/session",
  "access": "CMS session",
  "description": "CMS sign-out"
 },
 {
  "method": "DELETE",
  "path": "/api/admin/site-content",
  "access": "CMS session",
  "description": "Slug-managed content (projects, products, team, notices, reports, jobs)"
 },
 {
  "method": "GET",
  "path": "/api/admin/site-content",
  "access": "CMS session",
  "description": "Slug-managed content (projects, products, team, notices, reports, jobs)"
 },
 {
  "method": "PATCH",
  "path": "/api/admin/site-content",
  "access": "CMS session",
  "description": "Slug-managed content (projects, products, team, notices, reports, jobs)"
 },
 {
  "method": "POST",
  "path": "/api/admin/site-content",
  "access": "CMS session",
  "description": "Slug-managed content (projects, products, team, notices, reports, jobs)"
 },
 {
  "method": "PUT",
  "path": "/api/admin/site-content",
  "access": "CMS session",
  "description": "Slug-managed content (projects, products, team, notices, reports, jobs)"
 },
 {
  "method": "GET",
  "path": "/api/admin/submissions",
  "access": "CMS session",
  "description": "Contact requests"
 },
 {
  "method": "PATCH",
  "path": "/api/admin/submissions",
  "access": "CMS session",
  "description": "Contact requests"
 },
 {
  "method": "DELETE",
  "path": "/api/admin/users",
  "access": "CMS session",
  "description": "CMS user management"
 },
 {
  "method": "GET",
  "path": "/api/admin/users",
  "access": "CMS session",
  "description": "CMS user management"
 },
 {
  "method": "PATCH",
  "path": "/api/admin/users",
  "access": "CMS session",
  "description": "CMS user management"
 },
 {
  "method": "POST",
  "path": "/api/admin/users",
  "access": "CMS session",
  "description": "CMS user management"
 },
 {
  "method": "GET",
  "path": "/api/admin/visitors",
  "access": "CMS session",
  "description": "Visitor report"
 },
 {
  "method": "GET",
  "path": "/api/auth/callback/google",
  "access": "Public",
  "description": ""
 },
 {
  "method": "POST",
  "path": "/api/auth/email",
  "access": "Public",
  "description": ""
 },
 {
  "method": "DELETE",
  "path": "/api/auth/me",
  "access": "Public",
  "description": ""
 },
 {
  "method": "GET",
  "path": "/api/auth/me",
  "access": "Public",
  "description": ""
 },
 {
  "method": "POST",
  "path": "/api/auth/start",
  "access": "Public",
  "description": ""
 },
 {
  "method": "GET",
  "path": "/api/cron/maintenance",
  "access": "Cron secret",
  "description": ""
 },
 {
  "method": "GET",
  "path": "/api/donations/callback",
  "access": "Public",
  "description": ""
 },
 {
  "method": "POST",
  "path": "/api/donations/callback",
  "access": "Public",
  "description": ""
 },
 {
  "method": "POST",
  "path": "/api/donations/initiate",
  "access": "Public",
  "description": ""
 },
 {
  "method": "GET",
  "path": "/api/footer",
  "access": "Public",
  "description": ""
 },
 {
  "method": "GET",
  "path": "/api/home",
  "access": "Public",
  "description": ""
 },
 {
  "method": "POST",
  "path": "/api/jobs/apply",
  "access": "Public",
  "description": "Public job application"
 },
 {
  "method": "POST",
  "path": "/api/jobs/resume",
  "access": "Public, rate-limited; stores private PDF resumes",
  "description": "Upload a PDF resume and receive a short-lived one-time token for the job application form"
 },
 {
  "method": "GET",
  "path": "/api/media",
  "access": "Public",
  "description": ""
 },
 {
  "method": "GET",
  "path": "/api/media/[id]",
  "access": "Public",
  "description": ""
 },
 {
  "method": "GET",
  "path": "/api/media/by-key/[...key]",
  "access": "Public image only",
  "description": "Same-origin proxy for legacy Neon storage URLs; requires a ready public image record"
 },
 {
  "method": "GET",
  "path": "/api/navigation",
  "access": "Public",
  "description": "Public navigation"
 },
 {
  "method": "GET",
  "path": "/api/news",
  "access": "Public",
  "description": "Public news feed (projects, notices, reports, jobs by date)"
 },
 {
  "method": "GET",
  "path": "/api/pages",
  "access": "Public",
  "description": ""
 },
 {
  "method": "POST",
  "path": "/api/queries",
  "access": "Public",
  "description": "Contact form submission"
 },
 {
  "method": "GET",
  "path": "/api/site",
  "access": "Public",
  "description": "Public page snapshot"
 },
 {
  "method": "GET",
  "path": "/api/theme",
  "access": "Public",
  "description": "Public theme"
 },
 {
  "method": "POST",
  "path": "/api/visitors",
  "access": "Public",
  "description": "Visitor tracking beacon"
 },
 {
  "method": "GET",
  "path": "/api/website-essentials",
  "access": "Public read",
  "description": "Public social links, published PDFs, staff and working locations"
 },
 {
  "method": "PUT",
  "path": "/api/website-essentials",
  "access": "Admin / editor session",
  "description": "Update public social links, PDFs, staff directory and map locations"
 }
]
