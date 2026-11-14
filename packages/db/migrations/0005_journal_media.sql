CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_id" uuid,
	"kind" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"duration_ms" integer,
	"recorded_at" timestamp with time zone,
	"device" jsonb,
	"upload_state" text DEFAULT 'uploading' NOT NULL,
	"upload_id" text,
	"transcript_status" text DEFAULT 'waiting' NOT NULL,
	"transcript_error" text,
	"transcript_attempts" integer DEFAULT 0 NOT NULL,
	"transcript_started_at" timestamp with time zone,
	"language" text,
	"segments" jsonb,
	"content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_user_created_idx" ON "media" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_source_idx" ON "media" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "media_user_hash_idx" ON "media" USING btree ("user_id","content_hash");--> statement-breakpoint
CREATE INDEX "media_transcript_idx" ON "media" USING btree ("upload_state","transcript_status");