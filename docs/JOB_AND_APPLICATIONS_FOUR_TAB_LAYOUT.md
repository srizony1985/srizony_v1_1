# Job & Applications — Four-tab layout correction

Date: 2026-11-09

## Tab contract

The Job & Applications page exposes exactly four primary tabs:

1. **Vacancies** — the only tab with a two-column workspace. The left pane searches/filters vacancy records; the right pane creates or edits the selected vacancy. The review action changes to Applications and preselects the corresponding vacancy filter.
2. **Applications** — one full-width application register across vacancies. Includes status filters, vacancy filter, search across applicant/vacancy/contact/response values, sorting, CV links, full applicant detail, and row-level status updates.
3. **Application Process** — manages the public visibility of the whole application-process section and each of its three individual steps. Changes are saved to `cms-document:job-application-process.json` through the typed admin API.
4. **Application Form** — the existing form builder, mounted only when this tab is active.

There is no Applicant Inbox or Notifications tab. New-application counts remain informational on each vacancy and do not create another navigation destination.

## Public visibility integration

- `lib/jobApplicationProcess.ts` contains the serializable config type, defaults, and safe normalizer.
- `app/api/admin/job-application-process/route.ts` enforces admin/editor permissions, validates all three unique steps, persists the document, writes an audit event, and invalidates the public site cache tags.
- `lib/site.ts` includes the process settings in public site snapshots for `/carrer-job` routes. SiteProvider forwards the snapshot value to PageTemplate; JobPostingDetail renders only the enabled section/steps.
- No client component makes a direct API call for public process visibility; the public configuration arrives through the existing site snapshot.

## Layout behaviour

- The vacancy tab alone renders `.jobs-workspace` with the two-column vacancy list/editor.
- Applications renders a full-width table with its own status/search/filter toolbar and sticky table headings. Applicant records do not render in the vacancy split pane.
- Application Process has its own visibility settings workspace.
- Application Form continues to use the existing form builder.
- Mobile collapses the vacancy split layout to one column and retains the full-width application list.

## Verification

- TypeScript/TSX syntax transpilation passed for all changed TS/TSX files.
- PostCSS parsed the consolidated global stylesheet successfully.
- Static contract checks confirm exactly four tab items, no inbox/notification tab in the UI, global application listing, and server-backed public process visibility.
- Full semantic TypeScript checking, production build, and browser/database integration tests were not run because dependencies and the connected CMS environment are not available in this archive workspace.
