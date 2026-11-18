# CSS Token and Single-Stylesheet Audit

## Stylesheet contract

`app/globals.css` is the only stylesheet in the project. Public, admin, page-specific and former CSS-Module rules are consolidated there in their original cascade order. `tailwindcss` is imported exactly once at the top of this file. Component CSS-Module selectors were migrated to stable, namespaced global class names.

## Theme contract

Public UI styling is derived from semantic `--sf-*` design tokens. The authenticated admin uses the local shadcn/ui token bridge in `app/globals.css`, scoped by `.admin-theme-root`; no separate `--admin-*` token namespace or admin stylesheet is used. Feedback states use semantic success, warning, danger and info token families. Admin JSX should compose `components/ui` primitives and Tailwind utilities.

## JSX policy

- Do not add Tailwind utility classes for component presentation to JSX. Use semantic classes defined in `app/globals.css`.
- Do not add fixed inline colour, background, border, typography, spacing or layout declarations.
- Keep runtime data values (map positions, collection columns, animation delay, selected theme values) as custom properties only.
- Keep `role="alert"`, `role="status"`, and Sonner feedback accessible and themed through semantic feedback tokens.

## Verification

Run `npm run lint`, `npx tsc --noEmit`, `npm run test:functional`, and `npm run build`. Static source checks verify that only `app/globals.css` remains and no component imports secondary stylesheets or CSS Modules. Visual review is still required in both appearance modes and at desktop, tablet and mobile widths.
