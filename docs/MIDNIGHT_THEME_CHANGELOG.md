# Midnight + Soft default theme

## Header and theme behavior

- Removed the public **Customise** control.
- Defaulted the public site to Midnight + Soft + Dark on the first render.
- Added a borderless, icon-only sun/moon control in the public header. Its accessible name and `aria-pressed` state remain available to assistive technology.
- Kept a previously saved Light preference so visitors can switch between Light and Dark without losing their selection after navigation or refresh.
- Wired active navigation and menu states to contrast-aware semantic tokens instead of the dark primary brand color.
- Applied the same shape and foreground/background tokens to desktop and mobile Donate buttons.

## Token and component fixes

- Repaired all reported missing public component variants, including outline/animated buttons and responsive page wrappers.
- Replaced undefined `--ui-primary` / `--ui-accent` references with `--sf-primary` / `--sf-accent`.
- Added `--sf-surface-alt` to the initial CSS token fallback and runtime token map.
- Updated map district fills, map accents, and hero-tone overlays to use the current theme tokens.
- Improved accent button foreground selection by comparing light and dark text contrast ratios.
- Reused `LogoLoader` on route loads, content loads, donation submission, newsletter submission, and map loading.

## Checks

- TypeScript/TSX syntax parse: 179 files, no syntax diagnostics.
- CSS stylesheet top-level parse: 9 files, no parse errors.
- Public `sf-*` class and shared-token audits: 0 unresolved `--sf-*` references. The remaining two prefix matches in class audit are intentional dynamic class names for hero tone and home layout variants.
- Build, type-check and browser visual tests remain pending because `node_modules` is absent from the working copy.
