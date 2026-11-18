# CMS workspace, API boundary and React update

## Workspace layout contract

The CMS uses a single `100dvh` application shell. Its two columns are the sidebar and workspace.

- Sidebar brand and menu search remain stationary.
- Only `.cms-sidebar-nav` scrolls vertically. The logout/view-site controls remain pinned to the sidebar bottom.
- Workspace header remains stationary and contains the collapse toggle, current route title, data-provider status, user identity, and global actions.
- `.cms-page-frame` is a stationary, non-scrolling shell region. Its child `.cms-page-content-viewport` is the single vertical data viewport, with the rounded border and page scroll.
- `.admin-page-toolbar` is sticky and borderless. It holds search, tabs, filters, page navigation, and page actions.
- `.cms-content-summary` and sortable table headings are sticky below the toolbar. The viewport has a single vertical scrollbar; recognized table wrappers only provide horizontal overflow.
- Table/list wrappers do not create a second vertical scroll region. Wide tables may scroll horizontally.
- Page notes, instructions, comments, page navigation, pagination, and recognized page-footers are sticky at the bottom of the page viewport.
- `.cms-page-statusbar` and the Scarlet Labs credit footer remain pinned below the page viewport.
- On narrow screens the sidebar becomes an off-canvas drawer while the workspace keeps the same one-viewport model.

## API boundary

Client components do not call `fetch`, `XMLHttpRequest`, or an HTTP client directly. They import typed functions from `lib/api/*.ts` and invoke them from event handlers or loading hooks. The API modules own endpoint paths, HTTP methods, request/response types, authentication handling, JSON parsing and error conversion.

### Service map

- `lib/api/http.ts`: shared typed transport (`request`, `adminRequest`) and normalized error messages.
- `lib/api/auth.ts`: admin authentication and session revocation.
- `lib/api/public.ts`: public site snapshots, navigation, visitor tracking, public form delivery and payment initiation.
- `lib/api/adminWorkspace.ts`: provider health/status reads.
- `lib/api/adminResources.ts`: website essentials, media upload, pipeline identity, database JSON import/export.
- `lib/api/adminDatabase.ts`: Google Drive backup status, backup and restore actions.
- `lib/api/adminJobs.ts` and `lib/api/jobs.ts`: application form configuration, vacancy reads/writes and applicant status management.
- `lib/api/adminFooter.ts`, `adminTheme.ts`, `adminUiContent.ts`, `navigation.ts`, `pageBuilder.ts`, `portfolio.ts`, `reports.ts`, `settings.ts`, and `siteContent.ts`: focused typed domain services.

### Client component rules

1. No direct `fetch()` / `axios` / `XMLHttpRequest` in `.tsx` components.
2. No `async` function or `await` expression in client components. Imported API functions return typed Promises; UI handlers compose them with `.then()`, `.catch()` and `.finally()`.
3. Do not expose raw `Response` objects to UI. API functions parse and validate responses, return domain data, and throw normalized errors where appropriate.
4. Pass `AbortSignal` for requests tied to component lifecycle and abort on cleanup.
5. Keep authentication, delivery, reads, writes and management operations in `.ts` service modules.
6. Server Components, route handlers, server actions and scripts may use `async`/`await`; they are not client UI components.

## React state and Effects guidance

This project is updated to `react@19.3.1` and `react-dom@19.3.1` with matching lockfile integrity metadata.

- Use `useState` for independent, local UI state (selected tab, text input, toggles, loading flags).
- Use `useReducer` when one feature has many related transitions that should be kept in a single pure reducer.
- Use `useActionState` for form/action state where the action result and pending state should be managed together.
- Use `useOptimistic` only for an interaction where optimistic feedback is useful and can be reconciled with the authoritative response.
- Use `useMemo` for expensive derived values, not to synchronize state.
- Use `useEffect` only to synchronize with an external system: event listeners, browser storage, timers, subscriptions, and abortable client-side data hydration. Always clean up listeners, timers, and requests.
- Do not use Effects merely to copy one React state value into another or derive values that can be computed during render.
- Use event handlers for user-triggered writes; do not trigger writes because a derived value changed.

Existing client `useEffect` usage is kept for real external synchronization (route data hydration, event listeners, user preferences, and before-unload warning). Server-rendered initial data should continue to be loaded on the server where possible.

## `@next/env` CommonJS / ESM compatibility

The project lockfile resolves `@next/env` to a CommonJS build in this installation. Node.js native ESM does not always expose its `loadEnvConfig` property as a statically detectable named export. Use Node's `createRequire` bridge in Drizzle configuration and standalone `.mjs` tools:

```js
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(process.cwd())
```

The TypeScript Drizzle config and `scripts/load-env.ts` use an absolute project-file path with `createRequire`. This avoids relying on Node's synthetic named-export detection and matches the installed CommonJS package.

## Verification status

- TypeScript/TSX parser: all 241 TypeScript source files parse with zero syntax errors.
- CSS parser: `app/globals.css` parses with zero top-level CSS syntax errors.
- `node --check`: Google Drive backup/restore JavaScript modules pass syntax checks.
- `package.json` and `package-lock.json`: valid JSON; React and React DOM runtime versions and package integrity entries are aligned at 19.3.1.
- A full `tsc --noEmit`, lint, and Next production build could not be verified because this archive has no `node_modules`. Running global TypeScript in this state reports missing dependencies/types, not a completed project type-check. Install dependencies before treating the build as production-verified.
