# CMS Sidebar UX Refresh

## Purpose

The CMS shell now uses the Srizony Foundation identity consistently. Scarlet Labs attribution has been removed from the CMS navigation and workspace chrome to avoid competing organization branding.

## Navigation structure

- Overview: Dashboard
- Content management: Site Navigation, Site Content, Page Builder, Portfolio, Jobs & Applications, Website Essentials
- Insights: Visitors & Reports
- System: CMS Data Pipeline and Settings

The Settings group remains a click-to-expand nested group. It no longer opens or closes on hover, so the submenu does not disappear while the pointer moves between controls.

## Interaction and accessibility

- The sidebar collapse control changes between panel-close and panel-open icons and exposes its state using `aria-expanded`.
- Navigation links expose the current route using `aria-current="page"`.
- The Settings disclosure exposes `aria-expanded` and `aria-controls`; in collapsed mode it reports itself as closed because its children are not visible.
- On desktop, the sidebar can be collapsed manually. Tablet widths preserve visible labels rather than forcing an unexplained icon-only rail.
- On mobile, the sidebar becomes a drawer with a scrim, close control, Escape-key support and background scroll lock. Even when the user last collapsed the desktop sidebar, opening the mobile drawer reveals the full labelled navigation and sign-out action.
- The current CMS route is shown in the workspace header. The site logo and organization name are presented in the sidebar only.

## Styling

The sidebar, active states, header, footer, controls and focus indicators use the existing single-theme admin tokens (`--admin-surface`, `--admin-border`, `--admin-ink`, `--admin-muted`, `--admin-primary`, `--admin-soft`, typography and radius tokens). No additional theme selector or Scarlet-branded colour treatment is introduced.

## Validation

The sidebar UX contract tests cover branding, section labels, route state, disclosure state, collapse icons, theme token use and responsive label visibility. The full JavaScript test suite is run with `node --test tests/*.test.mjs`.
