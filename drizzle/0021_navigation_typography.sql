-- Per-navigation-item typography override, stored as a validated JSON object.
ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS typography JSONB;
