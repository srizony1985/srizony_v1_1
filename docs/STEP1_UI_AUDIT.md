# Srizony v1.1 — UI audit and theme corrections

## Applied changes

- **Midnight is the public default:** the server-rendered first paint and client theme runtime now use the Midnight palette. A saved explicit light-mode choice is respected; otherwise dark mode is the default.
- **Soft component shape:** public pages use the shared `soft` shape token, including cards, page wrappers, navigation controls, form controls and donate actions.
- **Removed public customise button:** the appearance customizer was removed from the public header and its unused navigation customizer stylesheet was deleted. Old per-browser palette overrides are cleared to prevent them from overriding Midnight.
- **Header theme tokens:** navigation, active states, language toggle, burger/drawer controls, icon-only dark-mode switch, desktop Donate action and mobile drawer Donate action use shared theme/shape tokens. The dark-mode switch has no visible label or border, while retaining an accessible screen-reader label and visible keyboard focus.
- **Donation button contrast:** accent buttons use the `--sf-accent` / `--sf-on-accent` token pair. Foreground selection now chooses the stronger contrast between dark and light text, including the gold accent in Midnight.
- **Missing component styles:** added the missing `sf-btn--outline`, `sf-btn--animated`, page-container, donation-copy, and page-section modifier styles used by public JSX. Gallery, feed/news cards, growth stats, diagram variants and mobile drawer wrappers have explicit token-backed rules.
- **Undefined token references:** replaced `--ui-primary` / `--ui-accent` in illustrations with defined `--sf-*` tokens and added the missing `--sf-surface-alt` alias. A reference audit found no unresolved `--sf-*` tokens.
- **Map reuse and styling:** the contact page continues to reuse `LocationMaps`; its district shapes and map accents now follow the Midnight palette and map loading uses the branded logo loader with an accessible status announcement.
- **Animated logo loader:** `LogoLoader` is used for route-level loading, content-page loading, donation submission, newsletter submission, and map loading. Its reduced-motion behavior remains enabled.
- **Responsive and accessibility polish:** focus-visible styling, reduced-motion handling, narrow-screen controls, overflow protection and token-based hero overlays were retained or improved.
- **Theme API:** `PUT /api/admin/theme` accepts the complete palette structure but persists only editable six-digit hexadecimal color values, avoiding the previous nested `label` / `typography` validation issue.

## Verification performed

- TypeScript/TSX parser pass: **179 source files checked, 0 syntax diagnostics**.
- CSS top-level parse: **9 stylesheets checked, 0 top-level parse errors**.
- Public `sf-*` class audit: **247 class names scanned**; the only two class prefixes without an exact selector are intentionally dynamic (`sf-home--layout-*` and `sf-hero--tone-*`). Their explicit supported values are covered by CSS, while the default `standard` layout inherits base styles.
- Shared `--sf-*` token audit: **0 potentially undefined referenced tokens**.
- A full TypeScript type check, Next production build and browser visual-regression test were **not completed** because dependencies are not installed in this working copy. These should be run after installing the lockfile dependencies.

## Database-provider note

The Step 2 database/provider work remains in the combined project. The provider selector controls the provider-neutral JSON-document store; existing relational CMS repositories still use Neon until each repository is migrated and integrity-checked. Do not treat the selector alone as a completed migration of every relational query.
