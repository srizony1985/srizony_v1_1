# UI fixes and optional typography scopes

## Changes

### Mobile navigation
- The social/contact topbar is hidden below the mobile-navigation breakpoint. It remains available on tablet/desktop layouts.
- The navigation drawer keeps the primary navigation and donation action without duplicating the topbar.

### Desktop active navigation
- `/bn` and `/bn/*` paths are normalized to their canonical route before active-item matching.
- Exact active pages receive `aria-current="page"` and a persistent visual marker.
- Parent folders and ancestor submenu rows receive an active-path background and inline accent marker, including level 2 and level 3 parents.

### Map attribution
- Leaflet/MapTiler and OpenStreetMap credits are compacted and styled to fit the map controls without obscuring the map.
- Required copyright attribution is intentionally retained. It must not be removed or made unreadable under the provider and data licencing terms. MapTiler logo requirements depend on the account plan.

### Diagrams and process steps
- Added/retained the reusable `ProcessSteps` component for guided sequences.
- Job application steps and CMS journey timelines use numbered cards, visual connectors, and a responsive stacked layout.
- Existing SDG, governance-tree and impact-flow diagrams remain in `components/pages/Diagram.tsx` and continue to be rendered by the CMS section renderer.

### Career position overview
- The Apply now action is placed in the top-right action area of Position overview on desktop and remains full-width-friendly on small screens.
- Application deadline facts receive warning-token emphasis and a clear submit-before label.
- The bottom application panel explains the application sequence without duplicating the primary apply action.

## Typography scope model

The typography settings document is now version 2:

```json
{
  "version": 2,
  "global": { "...": "full validated preference set" },
  "header": {},
  "content": {},
  "footer": {}
}
```

- `global` is the default preference set.
- `header`, `content`, and `footer` are optional partial overrides.
- An omitted property inherits the global value.
- Invalid font names, out-of-range numbers, and invalid colours are discarded during normalization.
- Existing flat or legacy per-preset typography records remain readable. The next save converts them to version 2 automatically.
- `lib/themeRuntime.ts` produces scoped CSS variables; `app/globals.css` consumes them only in the matching site region.
- The settings editor previews each scope, supports resetting one scope to inheritance, and refreshes the public layout after a successful save.

No SQL migration is required. The setting is stored in the existing JSONB `site_settings` record under `cms-theme-typography`.

## Save behaviour and failover

Typography edits are written to the primary Neon `site_settings` row. If the API is reading a Google Drive snapshot, the control is read-only and explains why; a read-only snapshot is not a write target. On successful Neon save, the `site-content` tag is immediately expired and the root layout is revalidated so the new typography reaches the public site without waiting for the normal cache window.

## Validation performed

- 170 JavaScript source/regression tests pass.
- 259 TypeScript/TSX source files transpile with zero syntax diagnostics (declaration files are excluded from transpile output generation).
- Runtime checks cover legacy-settings compatibility, optional scope inheritance, input validation, and scoped CSS variable generation.
- PostCSS parses `app/globals.css` successfully (one stylesheet in the project).
- A full semantic TypeScript check / Next.js build was attempted but cannot complete in the supplied source-only environment because React, Next.js, and related dependency/type packages are not installed. Run `npm ci`, then `npx tsc --noEmit` and `npm run build` in the deployment environment.
