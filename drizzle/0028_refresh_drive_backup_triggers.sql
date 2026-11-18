-- Re-run the Drive mirror trigger installer after later migrations have created
-- or repaired tables. Migration 0019 only saw tables that existed at that time.
DO $$
BEGIN
  IF to_regprocedure('public.refresh_drive_backup_triggers()') IS NULL THEN
    RAISE EXCEPTION
      'Drive backup trigger installer is missing; verify migration 0019 before continuing';
  END IF;
END;
$$;
--> statement-breakpoint
SELECT public.refresh_drive_backup_triggers();
