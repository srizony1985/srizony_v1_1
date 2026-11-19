# CMS Admin UI component architecture

All navigated CMS screens should compose the shared components in this package. Route components own domain data and domain-specific operations; they should not recreate application chrome, data-table behavior, or layout/overflow primitives.

## 1. Usability

- `AdminToolbar`: the sticky, context-specific action area. It composes search, filter groups, status/count badges, contextual actions, and optional tabs.
- `AdminToolbarAction`: typed action variants (`primary`, `secondary`, `danger`, `quiet`) mapped to the shared shadcn Button variants.
- `AdminToolbarSearch` and `AdminToolbarFilterGroup`: reusable discovery/filter controls with explicit labels.
- `AdminTabs`: grouped task navigation with selected-state styling, counts, disabled states, and arrow/Home/End keyboard navigation.

Keep the current task's most frequent actions visible. Use tabs for related modes of the same workflow, not as a substitute for primary navigation between unrelated CMS domains.

## 2. Execution and interaction

- `AdminAppShell`: fixed `100dvh` application frame; the browser document is not the admin scroll surface.
- `AdminWorkspaceHeader`: current route, account identity, provider state, save/reload, and appearance controls.
- `AdminNavigationSidebar` + `AdminNavigation*`: persistent collapsible navigation; only the navigation list scrolls inside the sidebar.
- `AdminProviderFooter`: provider identity/recovery state and CMS attribution outside the route viewport.
- `AdminWorkspaceGrid`: route-level one-column by default; opt-in responsive split layouts for paired editor/dataset workflows. The split stacks below 1120px. `AdminGrid` remains the content grid for metric cards and other grouped tiles.
- `AdminDataGroup`: semantic grouping of a dataset/editor domain, description, count, and local actions.
- `AdminDataContainer`: fixed-height three-row frame. Header and footer are outside the middle scroll region; footer supports operational status, instructions, and actions.
- `AdminTable`: three-row data frame with an action strip, one scrollable table viewport, sticky column headings, and a persistent summary footer. Sorting and CSV export default on; row selection defaults off; import defaults off and only appears when both `exportImportable` and a real `onImportFile` handler are supplied.

### Workspace layout contract

Use the shared `AdminWorkspaceGrid` for route-level composition. Keep all admin workspaces in the default one-column layout unless the screen is one of the explicit paired workflows: Job Applications (selected applicant left, register right), Site Content (record editor left, records right), Page Builder (page selector left, page editor right), and CMS Users (create-user form left, user directory right). These four use a 2-column split from 1120px upward and stack vertically below that width. The editor/detail pane comes before its dataset/list pane in DOM order, so keyboard and mobile reading order remain meaningful. Job Applications uses the shared `AdminTable` in the right pane (sortable columns, fixed export action strip, one scroll viewport, sticky headings, and persistent row-count summary); the applicant profile and recruitment actions stay in the fixed-height left pane. Site Content pairs the record editor with its records table, Page Builder pairs its page selector with the page editor, and CMS Users pairs account creation with the user directory.

## Overflow contract

For a table placed inside `AdminDataContainer`, set `bodyScroll="hidden"`. The outer data container then keeps its own header/footer fixed while `AdminTable` owns the only table scroll viewport. Do not add another `overflow-auto` wrapper around `AdminTable`. For non-table editor content, use `bodyScroll="auto"` when the data-container body should own scrolling.

The shared table keys selection by the supplied stable `getRowId`, sorts the displayed dataset, exports the current sorted dataset, and guards CSV cells against spreadsheet formula injection. An import action must be implemented and validated by the domain editor; the common table deliberately does not guess a data schema.

## 3. CSS tokens and scoped typography

`AdminThemeShell` reads the persisted `cms-theme-typography` setting through the authenticated admin API, merges Global defaults with the CMS scope, and applies the resulting values to the admin theme root. Shared components consume semantic Tailwind/shadcn colors plus these scoped tokens:

- `--cms-sidebar-font-size`
- `--cms-toolbar-font-size`
- `--cms-table-font-size`
- `--cms-control-font-size`
- `--cms-header-font-size`
- `--cms-data-heading-font-size`
- `--cms-footer-font-size`

The Settings → Theme Typography → Admin interface scope exposes validated size controls for each token. Updates are saved through the existing database-backed typography API and trigger a shared-shell refresh. The public site's theme scope remains independent.

## Shared component rules

- Use components from `@/components/ui` for primitive buttons, cards, inputs, labels, badges, checkboxes, native selects, textareas, skeletons, and tables.
- Use Lucide icons from `lucide-react` and semantic theme tokens (`background`, `foreground`, `card`, `muted`, `border`, `ring`, `primary`, `destructive`, `sidebar-*`).
- Keep domain-specific values, options, and operation handlers in the route/domain layer; shared components own behavior and presentation.
- No admin-only stylesheet is required. Admin component styling is defined next to the components with Tailwind utility classes and semantic tokens; the global CSS only scopes root typography and common token application to `.admin-theme-root`.
