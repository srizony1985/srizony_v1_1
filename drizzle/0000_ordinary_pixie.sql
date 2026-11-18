CREATE TABLE IF NOT EXISTS "cms_documents" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"type" varchar(40) NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "donations" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" varchar(64) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"donor" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donations_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
-- A previous runtime bootstrap may already have created donations before the
-- Drizzle migration ledger existed. Accept it only when its base contract matches.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'donations'
      AND column_name = 'id' AND data_type = 'integer' AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'donations'
      AND column_name = 'transaction_id' AND data_type = 'character varying'
      AND character_maximum_length = 64 AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'donations'
      AND column_name = 'amount' AND data_type = 'numeric'
      AND numeric_precision = 12 AND numeric_scale = 2 AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'donations'
      AND column_name = 'status' AND data_type = 'character varying'
      AND character_maximum_length = 24 AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'donations'
      AND column_name = 'donor' AND data_type = 'jsonb'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'donations'
      AND column_name = 'created_at' AND data_type = 'timestamp with time zone'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Existing public.donations table is incompatible with migration 0000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.donations'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
  ) THEN
    RAISE EXCEPTION 'Existing public.donations table must have PRIMARY KEY (id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.donations'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (transaction_id)'
  ) THEN
    RAISE EXCEPTION 'Existing public.donations table must have UNIQUE (transaction_id)';
  END IF;
END $$;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "site_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(24) NOT NULL,
	"name" text,
	"email" text,
	"phone" text,
	"message" text,
	"payload" jsonb,
	"status" varchar(24) DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
