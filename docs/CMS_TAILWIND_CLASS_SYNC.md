# Admin UI styling contract (shadcn/ui)

The admin no longer has a dedicated `Admin.css` file or custom `ui-*` selector contract. The dashboard uses local shadcn/ui source components from `components/ui`, configured by the root `components.json` file.

## Source of truth

- Component source: `components/ui/*.tsx`
- Theme tokens and Tailwind v4 entry: `app/globals.css`
- Class composition: `lib/utils.ts` (`cn`)
- Admin light/dark preference wrapper: `app/admin/AdminThemeShell.tsx`

## Rules

- Use `Button`, `Badge`, `Card`, `Input`, `Textarea`, `Label`, `Select`, `Checkbox`, `Separator`, `Skeleton` and `Table` from `@/components/ui`.
- Use the shadcn semantic token classes such as `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `bg-muted`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-destructive` and `ring-ring`.
- Compose styles with Tailwind utilities and `cn()`. Avoid bespoke admin selector names, inline `<style>` blocks, and separate admin CSS files.
- Keep the public `--sf-*` theme and public site typography controls separate from the authenticated admin design tokens.
- Add or update component source under `components/ui` when a reusable control is needed. Do not add a second UI framework to the admin.

The admin's `components.json` uses the `new-york` style with the Radix base and Lucide icons. The components are source-owned by this repository rather than imported from a prebuilt UI package.
