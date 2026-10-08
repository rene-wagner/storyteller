CREATE TABLE "cue_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"spoken_text" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cue_points_position_nonnegative" CHECK ("cue_points"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "cue_points" ADD CONSTRAINT "cue_points_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cue_points" ADD CONSTRAINT "cue_points_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cue_points_scene_id_position_idx" ON "cue_points" USING btree ("scene_id","position");