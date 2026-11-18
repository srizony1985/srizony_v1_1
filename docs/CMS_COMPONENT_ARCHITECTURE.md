# CMS component architecture

The authenticated admin is built from the project's local shadcn/ui component source. shadcn/ui is not consumed as a pre-built component library: the source lives in `components/ui`, can be inspected and maintained in this repository, and follows the configured `new-york` / Radix component style. Admin routes compose these primitives and Tailwind utilities; no separate admin stylesheet or third-party admin UI framework is used.

## UI foundation

- `components.json` is the shadcn configuration. It points to `app/globals.css` and maps the `@/components/ui` and `@/lib/utils` aliases.
- `components/ui` contains the shared shadcn-style `Button`, `Badge`, `Card`, `Input`, `Textarea`, `Label`, `Select`, `Checkbox`, `Separator`, `Skeleton` and `Table` components.
- `lib/utils.ts` provides the shared `cn` helper (`clsx` + `tailwind-merge`). Use it to compose variant classes without creating a second styling system.
- `app/globals.css` holds the standard shadcn semantic token bridge. The token values are scoped by `.admin-theme-root`, so the public website's `--sf-*` theme remains independent.
- `AdminThemeShell` only handles the admin appearance preference and toast host. It does not load an admin CSS file or apply a separate database-backed typography system to admin controls.

## Application shell

- `AdminAppShell` provides the fixed application frame and responsive navigation region.
- `AdminWorkspaceHeader` uses shadcn `Button` and `Badge` primitives for route context, save/reload, appearance mode and provider status.
- `AdminNavigation` uses the shared shadcn `Button` variants for group toggles and Tailwind token classes for active state; links remain Next.js links.
- `AdminViewportGrid` contains the route viewport and the execution status line.
- `AdminProviderFooter` displays the live provider state using semantic status tokens.

## Data and editing components

- `AdminToolbar` composes `Button`, `Badge` and `Input` for contextual actions, counters, search and filters.
- `AdminDataContainer` provides a bounded content region with fixed header/footer slots using shadcn semantic tokens.
- `AdminTabs` uses the shared `Button` component and implements the tab keyboard interaction contract.
- `AdminTable` uses the shared shadcn `Table` family plus `Checkbox` and `Button`. It preserves sorting, selection, CSV export/import, sticky headings and stable row identity.
- Route-specific editors keep their domain validation and data workflows, but must use the shared `components/ui` controls instead of bespoke control markup or another UI library.

## Development rules

1. Do not create or reintroduce `app/admin/Admin.css`, admin-specific CSS modules, or global selectors for admin route markup.
2. Build admin controls from `components/ui`. Add a shadcn-style source component under `components/ui` when a reusable primitive is missing.
3. Use `cn()` to merge standard Tailwind classes. Do not invent `ui-*` CSS hooks or add a parallel admin token namespace.
4. Keep shared semantic colors (`bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `bg-destructive`, and `ring-ring`) consistent across admin screens.
5. Keep public-site styles and tokens in `app/globals.css` independent of `.admin-theme-root`.
6. Add regression coverage to `tests/admin-shadcn-contract.test.mjs` when changing the admin component foundation.

The admin may still have domain-specific layout wrappers, tables, navigation state and editor workflows. These wrappers must compose the shadcn primitives and Tailwind utilities; they are not a separate UI kit.
