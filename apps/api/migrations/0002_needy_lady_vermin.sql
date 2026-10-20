ALTER TABLE "revisions" ADD COLUMN "number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "revisions" ADD COLUMN "storage_id" text;--> statement-breakpoint
ALTER TABLE "revisions" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "revisions" ADD COLUMN "media_type" text;--> statement-breakpoint
ALTER TABLE "revisions" ADD COLUMN "size" integer;