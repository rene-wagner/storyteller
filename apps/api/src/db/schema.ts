import type { CharacterType, MediaType } from "@storyteller/shared";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  genre: text("genre").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const episodes = pgTable(
  "episodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("episodes_position_nonnegative", sql`${table.position} >= 0`),
    index("episodes_project_id_position_idx").on(
      table.projectId,
      table.position,
    ),
  ],
);

export const scenes = pgTable(
  "scenes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    backgroundMusicId: uuid("background_music_id"),
    backgroundMusicType: text("background_music_type")
      .$type<"background_music">()
      .default("background_music")
      .notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("scenes_position_nonnegative", sql`${table.position} >= 0`),
    check(
      "scenes_background_music_type_check",
      sql`${table.backgroundMusicType} = 'background_music'`,
    ),
    foreignKey({
      columns: [table.backgroundMusicId, table.backgroundMusicType],
      foreignColumns: [mediaItems.id, mediaItems.type],
    }).onDelete("no action"),
    index("scenes_episode_id_position_idx").on(table.episodeId, table.position),
    index("scenes_background_music_id_idx").on(table.backgroundMusicId),
  ],
);

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").$type<CharacterType>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "characters_type_check",
      sql`${table.type} IN ('main', 'supporting')`,
    ),
  ],
);

export const mediaItems = pgTable(
  "media_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    type: text("type").$type<MediaType>().notNull(),
    fileName: text("file_name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: bigint("file_size", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "media_items_type_check",
      sql`${table.type} IN ('background_music', 'sound_effect')`,
    ),
    check("media_items_file_size_nonnegative", sql`${table.fileSize} >= 0`),
    uniqueIndex("media_items_storage_key_unique").on(table.storageKey),
    // Composite media FKs require a unique (id, type) target for type-specific links.
    uniqueIndex("media_items_id_type_unique").on(table.id, table.type),
  ],
);

export const cuePoints = pgTable(
  "cue_points",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    // Migration 0007 makes this FK initially deferred; Drizzle cannot model deferrability.
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "no action" }),
    spokenText: text("spoken_text").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("cue_points_position_nonnegative", sql`${table.position} >= 0`),
    index("cue_points_scene_id_position_idx").on(table.sceneId, table.position),
  ],
);

export const cuePointSoundEffects = pgTable(
  "cue_point_sound_effects",
  {
    cuePointId: uuid("cue_point_id")
      .notNull()
      .references(() => cuePoints.id, { onDelete: "cascade" }),
    mediaItemId: uuid("media_item_id").notNull(),
    mediaType: text("media_type")
      .$type<"sound_effect">()
      .default("sound_effect")
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.cuePointId, table.mediaItemId] }),
    check(
      "cue_point_sound_effects_media_type_check",
      sql`${table.mediaType} = 'sound_effect'`,
    ),
    foreignKey({
      columns: [table.mediaItemId, table.mediaType],
      foreignColumns: [mediaItems.id, mediaItems.type],
    }).onDelete("no action"),
    index("cue_point_sound_effects_media_item_id_idx").on(table.mediaItemId),
  ],
);
