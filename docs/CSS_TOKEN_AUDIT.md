# CSS Token Audit and Corrections

## Why this change was made

The current project has a shared semantic theme (`--sf-*`) and a separate admin palette. Some CSS referenced convenience aliases (`--sf-display`, `--sf-body`, `--sf-radius`, `--sf-container`) that were present in `site-components.css` but not in the core `globals.css` token contract. A shared base layer now declares safe aliases, allowing Resources, Management Staff, location map and legacy sections to retain design tokens even if styles are refactored or loaded differently.

## Changes applied

- Added core aliases for display/body font, radius, container width, strong border, and theme-radius fallback to `app/globals.css`.
- Added local default preview variables to the public theme preview and scoped admin preview defaults to the admin palette, while preserving per-preview overrides.
- Changed public icon/link foreground declarations from `--sf-primary` to the semantic `--sf-link` token. In dark mode `--sf-primary` is the deep navy brand fill, so using it as small text/icon foreground on dark cards has weak contrast; `--sf-link` resolves to a contrast-friendly brand tint in dark mode and the primary color in light mode.
- Added regression contracts to `tests/functional-contract.test.ts` for the alias tokens, admin preview defaults and theme-aware link/icon usage.

## Files touched

- `app/globals.css`
- `app/site-components.css`
- `app/site-polish.css`
- `app/css_extra/*.module.css`
- `app/admin/Admin.css`
- `tests/functional-contract.test.ts`

## Verification scope

Static checks should confirm the expected aliases and semantic usage in source. Full visual verification still requires running the app in a browser in both light and dark modes, at desktop/tablet/mobile widths. Also run `npm run test:functional`, `npm run lint` and `npm run build` after installing dependencies.
