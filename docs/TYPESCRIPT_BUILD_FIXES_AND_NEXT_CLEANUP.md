# TypeScript build fixes and Next.js cleanup

This update addresses the TypeScript diagnostics reported after `npm run db:bootstrap` and the subsequent `npx tsc --noEmit` run.

## Fixes

- `LandingComponentKey` is now defined once in `types/entityType.ts` and reused by `lib/cms/component-policy.ts`. The deprecated `stories` and `newsFeed` keys remain accepted for existing CMS page snapshots and are normalized to `news` by the public homepage adapter.
- `LANDING_COMPONENT_TYPE` is checked with `satisfies Record<LandingComponentKey, Section['type']>`, preventing the page-builder, renderer and stored-page unions from drifting apart.
- The CMS JSON import response is explicitly typed before record counts are reduced.
- Database export/import handlers capture `db` into a local `database` variable, check for `null`, and use only the narrowed variable inside asynchronous retry callbacks.
- Content collection JSON is checked as a non-array object before reading `enabled` and `component`.
- Homepage collection limits are read after narrowing to a carousel section; nullable heading values are normalized before string comparisons; normalized fallback sections are checked against the `PageSection` union.
- Regression tests cover the legacy key, DB null guards, content-collection narrowing and carousel-only properties.

## Re-run on macOS

Run these commands from the project root. The first command stops the current Next.js dev server in its terminal with `Ctrl+C`.

```bash
# Stop any active `next dev` or `next build` process first.
ps aux | grep -E '[n]ext (dev|build|start)'

# Remove only generated Next.js build output after all Next processes have stopped.
rm -rf .next

# Re-run checks.
npm run test:functional
npx tsc --noEmit
npm run build
```

## About `ENOTEMPTY: ... rmdir '.next/server/app'`

This error is separate from TypeScript diagnostics. It usually occurs when a Next.js process or file watcher is still writing to `.next` while another process tries to clean it. Stop the dev server and any other build process, remove `.next`, then run one build process at a time. Do not delete `node_modules`, source files or database contents to resolve this error.

## Database status

The user's log shows `db:migrate` and `db:seed` completed successfully and created 45 pages and 77 CMS content items. Do not rerun migrations or reset the database solely to resolve TypeScript or `.next` build errors. No database migration is introduced by this patch.

## Verification boundary

The source-level regression tests and TypeScript/TSX syntax checks can be run independently. A full semantic typecheck and production build require a complete local dependency installation. This package must not be considered production-build verified until `npx tsc --noEmit` and `npm run build` both finish successfully on the target project.
