-- Low-overhead change journal for incremental JSON snapshots to a user-owned
-- Google Drive folder. High-volume analytics/security tables are snapshotted only
-- during a full run so every page view does not contend on one queue row.
CREATE TABLE IF NOT EXISTS public.drive_sync_state (
  table_name TEXT PRIMARY KEY,
  revision BIGINT NOT NULL DEFAULT 0,
  synced_revision BIGINT NOT NULL DEFAULT 0,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.mark_drive_table_dirty()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.drive_sync_state (table_name, revision, synced_revision, changed_at)
  VALUES (TG_TABLE_NAME, 1, 0, clock_timestamp())
  ON CONFLICT (table_name) DO UPDATE
    SET revision = public.drive_sync_state.revision + 1,
        changed_at = clock_timestamp();
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.refresh_drive_backup_triggers()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  item RECORD;
  trigger_count INTEGER := 0;
  trigger_name TEXT;
  table_key TEXT;
BEGIN
  FOR item IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'drive_sync_state'
      AND tablename NOT IN ('visitor_events', 'site_visitors', 'public_api_rate_limits', 'admin_login_attempts', 'job_public_rate_limits', 'enquiry_daily_limits')
    ORDER BY tablename
  LOOP
    table_key := item.tablename;
    INSERT INTO public.drive_sync_state (table_name, revision, synced_revision, changed_at)
    VALUES (table_key, 1, 0, clock_timestamp())
    ON CONFLICT (table_name) DO NOTHING;
    trigger_name := 'drive_mirror_' || substr(md5(table_key), 1, 20);
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = to_regclass(format('%I.%I', item.schemaname, item.tablename))
        AND tgname = trigger_name AND NOT tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION public.mark_drive_table_dirty()',
        trigger_name, item.schemaname, item.tablename
      );
      trigger_count := trigger_count + 1;
    END IF;
  END LOOP;
  RETURN trigger_count;
END;
$$;
--> statement-breakpoint
SELECT public.refresh_drive_backup_triggers();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS drive_sync_state_pending_idx
  ON public.drive_sync_state (changed_at ASC, table_name ASC)
  WHERE revision > synced_revision;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS visitor_events_created_path_idx
  ON public.visitor_events (created_at DESC, path);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS visitor_events_created_referrer_idx
  ON public.visitor_events (created_at DESC, referrer);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS donations_created_at_status_idx
  ON public.donations (created_at DESC, status);
