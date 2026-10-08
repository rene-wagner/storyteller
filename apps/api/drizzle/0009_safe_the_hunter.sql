CREATE TABLE "cue_point_sound_effects" (
	"cue_point_id" uuid NOT NULL,
	"media_item_id" uuid NOT NULL,
	"media_type" text DEFAULT 'sound_effect' NOT NULL,
	CONSTRAINT "cue_point_sound_effects_cue_point_id_media_item_id_pk" PRIMARY KEY("cue_point_id","media_item_id"),
	CONSTRAINT "cue_point_sound_effects_media_type_check" CHECK ("cue_point_sound_effects"."media_type" = 'sound_effect')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "media_items_id_type_unique" ON "media_items" USING btree ("id","type");--> statement-breakpoint
ALTER TABLE "cue_point_sound_effects" ADD CONSTRAINT "cue_point_sound_effects_cue_point_id_cue_points_id_fk" FOREIGN KEY ("cue_point_id") REFERENCES "public"."cue_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cue_point_sound_effects" ADD CONSTRAINT "cue_point_sound_effects_media_item_id_media_type_media_items_id_type_fk" FOREIGN KEY ("media_item_id","media_type") REFERENCES "public"."media_items"("id","type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cue_point_sound_effects_media_item_id_idx" ON "cue_point_sound_effects" USING btree ("media_item_id");
