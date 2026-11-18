# CMS footer and single-theme UI styling

## Footer settings

Footer configuration is stored in `site_settings` under `cms-footer-layout`. The editor is available at **Settings → Footer** and supports:

- enabling or hiding the complete footer;
- showing or hiding the organization identity, logo, tagline, summary, social links and copyright line;
- adding, removing, hiding, ordering and renaming up to eight sections;
- navigation-generated, custom-link and contact sections;
- English and Bengali section/link labels;
- one to four link columns per section, with evenly balanced link distribution;
- independent contact visibility for address, phone numbers and email.

The public footer derives its outer column count from the number of enabled areas and the selected maximum. Tablet and mobile breakpoints reduce multi-column layouts without forcing a one-column desktop setting into an empty multi-column grid. Link columns are balanced as evenly as possible and do not render empty columns.

## Single theme typography and CMS controls

This project has one fixed visual theme. Light/dark are appearance modes, not separate palette themes. The Typography settings save one site-wide typography record and apply its variables across headings, body copy, navigation, footer and the CMS theme bridge.

`AdminThemeShell` maps the active site tokens to `--admin-*` variables. Native `select`, `option` and `optgroup` controls are explicitly styled inside `.admin-shell` with the CMS font, control size, foreground/background colors and inherited `color-scheme` (subject to browser support for native option styling). CMS error, warning and success feedback plus Sonner notifications use semantic theme tokens. Shared cards, form panels, buttons, badges and focus states use theme-derived surface, text, border, radius, shadow and primary-action tokens. Responsive development-area and CMS statistics grids use explicit `data-columns` values; this avoids invalid CSS `repeat(min(...))` repeat counts at tablet widths.
