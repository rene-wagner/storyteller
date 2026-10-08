-- Drizzle does not model FK deferrability. Defer this NO ACTION check until
-- the statement/transaction finishes so project cascades can remove both
-- characters and their cue points; direct character deletion still fails at commit.
ALTER TABLE "cue_points" ALTER CONSTRAINT "cue_points_character_id_characters_id_fk" DEFERRABLE INITIALLY DEFERRED;
