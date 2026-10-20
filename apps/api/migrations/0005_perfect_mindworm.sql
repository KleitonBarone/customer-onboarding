CREATE TABLE "demo_clocks" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"now" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_inbox" (
	"outbox_id" text PRIMARY KEY NOT NULL,
	"delivered_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"onboarding_id" text NOT NULL,
	"kind" text NOT NULL,
	"window" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	CONSTRAINT "notification_outbox_onboarding_id_kind_window_unique" UNIQUE("onboarding_id","kind","window")
);
--> statement-breakpoint
ALTER TABLE "demo_clocks" ADD CONSTRAINT "demo_clocks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_inbox" ADD CONSTRAINT "notification_inbox_outbox_id_notification_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."notification_outbox"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_onboarding_id_onboardings_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."onboardings"("id") ON DELETE no action ON UPDATE no action;