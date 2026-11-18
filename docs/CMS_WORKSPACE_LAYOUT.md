# CMS Workspace Layout Refactor

## Layout contract

The CMS is now structured as one fixed-height application viewport (`100dvh`) with two primary columns:

- **Sidebar:** brand/logo, menu search, scrollable navigation, and a bottom-pinned footer containing website access and sign-out.
- **Workspace:** a stationary header, an optional provider-status notice, the single vertical content viewport, and a bottom-pinned workspace footer.

The workspace header presents the current route title next to the sidebar toggle. On the right, status is ordered as data provider, signed-in user, then global actions (Reload, Save all, and theme mode). Compact tablet/mobile layouts retain provider and user icon indicators while collapsing their text labels.

The workspace footer shows the CMS identity and `Developed by Scarlet Labs`.

## Scrolling behavior

- The document/root and shell do not scroll.
- The sidebar navigation is the only independently scrollable sidebar region. Its logo, search field, and footer remain visible.
- The workspace data region (`.admin-main`) owns the page's vertical scrolling.
- Standard section controls, filters, search fields, and tabs use the shared `.admin-page-toolbar` sticky behavior.
- UI Content search/add controls are sticky.
- Page Builder route search and route tabs are grouped into one sticky toolbar above the editor.
- Data tables may scroll horizontally; their rows remain part of the main vertical page flow.
- Dialogs and dropdown/popover surfaces retain their own bounded scrolling where needed for usability.

## Responsive behavior

At widths up to 760px, the sidebar becomes an off-canvas drawer. The workspace remains a fixed-height viewport; the mobile header retains the menu toggle, current page title, provider indicator, user indicator, and compact global action buttons. Safe-area padding is retained at the bottom of the sidebar and content region.

## Source changes

- `app/admin/dashboard/_components/Shell.tsx`
  - Orders provider status, user identity, and global actions in the workspace header.
  - Adds Scarlet Labs attribution to the fixed workspace footer.
- `app/admin/dashboard/_components/AdminCommon.tsx`
  - Adds the shared `admin-page-toolbar` class to standard CMS page toolbars.
- `app/admin/dashboard/page-builder/page.tsx`
  - Moves page filtering and page-route tabs into one sticky Page Builder toolbar, above the editable page body.
- `app/admin/dashboard/ui-content/page.tsx`
  - Applies the shared sticky toolbar behavior to UI Content search and add controls.
- `app/globals.css`
  - Replaces the previous viewport contract with the fixed sidebar/workspace contract, sticky toolbar behavior, and mobile drawer overrides.

No database schema, data, API routes, or authentication behavior was changed.

## Validation

- PostCSS parsed `app/globals.css` successfully: 4,638 top-level nodes and 17,843 declarations; no parse error.
- TypeScript `transpileModule` syntax checks passed for all four changed TSX files.
- A full Next.js production build and browser interaction tests were not run because the provided archive does not include `node_modules`.
