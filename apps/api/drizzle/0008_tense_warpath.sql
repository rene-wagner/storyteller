CREATE TABLE "media_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"file_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_items_type_check" CHECK ("media_items"."type" IN ('background_music', 'sound_effect')),
	CONSTRAINT "media_items_file_size_nonnegative" CHECK ("media_items"."file_size" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "media_items_storage_key_unique" ON "media_items" USING btree ("storage_key");