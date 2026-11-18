# Local data ZIP recovery report

Source: uploaded `drive-data.zip` (dated 2026-11-09).

## Summary

- Original archive: 46 table JSON documents, 980 source rows, no `backup-manifest.json`.
- All table documents use legacy `srizony-postgresql-table-v1`.
- 1,990 numeric placeholders (`__SF_LOSSLESS_...__`) are present. The source ZIP does not contain the original `numericTokens` mapping; exact recovery of those numeric values is impossible.
- The safe import set contains 10 tables and 740 rows.
- CMS content status after safety filtering: 80 published, 31 draft, 1 hidden. Thirty published records with explicit demo slugs were moved to draft.
- PostgreSQL will generate fresh surrogate IDs where source IDs were lost. Foreign keys are remapped only where the relationship is unambiguous.

## Prepared import set

| Table | Rows | Treatment | Notes |
|---|---:|---|---|
| `cms_content_items` | 112 | RESTORE_WITH_PUBLISH_SAFETY | Canonical CMS content; regenerated IDs/order; 30 published demo records moved to draft. |
| `media_items` | 111 | RECONSTRUCT | Built from CMS image_src URL/title metadata; no source image binaries were present. |
| `hero_slides` | 12 | RESTORE_WITH_REMAP | Image FK rebuilt from exact href match to canonical CMS item. |
| `contact_info` | 1 | RESTORE | Singleton contact record normalized to id=1. |
| `contact_phones` | 3 | RESTORE_WITH_REMAP | Child contact relation remapped to contact_info.id=1. |
| `contact_socials` | 1 | RESTORE_WITH_REMAP | Child contact relation remapped to contact_info.id=1. |
| `contact_footprint` | 14 | RESTORE_WITH_REMAP | Child contact relation remapped to contact_info.id=1. |
| `hero_data` | 1 | RESTORE_WITH_DEFAULT | Hero copy retained; unavailable autoplay interval set NULL. |
| `hero_stats` | 5 | RESTORE_WITH_DEFAULT | String IDs retained; sort order reindexed. |
| `admin_audit_log` | 480 | RESTORE_WITH_LOSS | Audit history retained; numeric metadata placeholders set to JSON null. |

## Deliberately quarantined (not imported)

| Source table/file | Rows | Reason |
|---|---:|---|
| `admin_users` | 0 | Legacy table name absent from current schema; empty. |
| `business_profile` | 0 | Legacy table name absent from current schema; empty. |
| `contact_submissions` | 0 | Legacy table name absent from current schema; empty; current table is submissions. |
| `jobs` | 0 | Legacy table name absent from current schema; empty; current job records belong in cms_content_items. |
| `cms_pipeline_runs` | 38 | No matching physical table in the current schema. |
| `cms_users` | 2 | Credentials/roles from a historical snapshot are not trusted for authentication; provision administrator separately. |
| `admin_login_attempts` | 10 | Transient security lockout state; intentionally reset. |
| `auth_email_challenges` | 2 | One-time verification challenges are expired/unsafe to restore. |
| `job_public_rate_limits` | 8 | Transient abuse/rate-limit state; intentionally reset. |
| `job_applications` | 7 | Required job_id values are irrecoverable and must reference regenerated cms_content_items IDs; retained in quarantine. |
| `job_resume_uploads` | 7 | Required media_id values are irrecoverable and source has no media snapshot; retained in quarantine. |
| `hero_images` | 6 | Legacy table; image_url values are empty. |
| `contact_locations` | 15 | Legacy rows depend on missing sections/section IDs. The 14 footprint locations are already represented in contact_footprint; the head-office record is preserved in contact_info. |
| `contact_sections` | 1 | Requires a missing sections parent. Main address/email and phone values are already preserved in contact_info and contact_phones. |
| `hero_slides image refs` | 12 | Recovered separately by matching exact slide href to cms_content_items image_src. |
| `content_entries / content_entry_bodies / content_entry_tags` | 124 | Legacy duplicate content model; content_entry_id/image_id links are unrecoverable. 53 of 54 legacy slugs overlap with cms_content_items, which is imported. |
| `sections and section child datasets` | — | The ZIP has no sections.json, pages.json, nav_items.json, nav_groups.json or media_items.json. Child tables requiring section_id or media references are retained in quarantine. |
| `empty operational snapshots` | 0 | Empty tables are not in the manifest and therefore will not delete or overwrite newly initialized tables. |

## Structural recovery decisions

- `cms_content_items`: generated fresh IDs; `site_id=1`; route parent taken from `attributes.routeParent` (component fallback if absent); sort order reindexed within each route in source order. All 31 explicit `-demo` records are retained; the 30 that were marked published are changed to draft (the one already hidden remains hidden).
- `media_items`: synthesized 111 catalog rows from the 111 unique nonempty `cms_content_items.image_src` URLs. These rows preserve URLs and alt text; no image bytes were included. Of the source URLs, 103 point to Unsplash and 8 to a historical Neon storage host, whose availability must be checked separately.
- `hero_slides`: old image FKs are remapped by exact `href` match to a canonical CMS content item; restore script resolves the newly generated media ID during import.
- `contact_info`: its singleton ID is normalized to 1; phone/social/footprint foreign keys map to this single contact row.
- `hero_data`: singleton ID normalized to 1; missing numeric `autoplay_interval` set to NULL.
- `hero_stats` and contact sort positions are reindexed using source snapshot order.
- `admin_audit_log`: generated fresh IDs; only lost numeric values inside `metadata` are set to JSON null. Historical actor email/IP data is preserved.

## Restore safety

- The original uploaded archive and all 46 original files are preserved under `drive-data/legacy-quarantine/`.
- The root `backup-manifest.json` lists only the curated, structurally importable snapshots.
- The updated restore command validates file checksums, schema digests, row counts, required/unknown columns and leftover lossless markers before changing data.
- By default, restore refuses to replace a nonempty target table. Use `--replace-existing` only after taking a separate backup.
- No Neon data has been changed by preparing this recovery pack.

## After restoring

1. Run `npm run db:restore:local` against the already migrated database.
2. Run `npm run db:seed:registry` to populate CMS component/field definitions only (no page/content seeding).
3. Configure a new verified admin account; do not reuse a historical hash from `cms_users.json`.
4. Verify content feeds, hero, media library and contact information in the CMS.
5. Keep the quarantined legacy files until the remaining section/body/job records can be manually mapped from a better source.
