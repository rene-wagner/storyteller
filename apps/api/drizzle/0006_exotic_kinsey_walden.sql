ALTER TABLE "cue_points" DROP CONSTRAINT "cue_points_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "cue_points" ADD CONSTRAINT "cue_points_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;