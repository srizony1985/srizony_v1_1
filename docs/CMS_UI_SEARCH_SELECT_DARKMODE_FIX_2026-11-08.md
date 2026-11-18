# Historical note: admin search/select dark-mode issue (2026-11-08)

This note records the earlier native-select portal and dark-mode issue. The former bespoke CMS styles and `app/admin/Admin.css` have since been retired. The current admin controls are sourced from `components/ui`, with their semantic shadcn tokens scoped by `.admin-theme-root` in `app/globals.css`.

For current implementation rules, see `CMS_COMPONENT_ARCHITECTURE.md` and `CMS_TAILWIND_CLASS_SYNC.md`.
