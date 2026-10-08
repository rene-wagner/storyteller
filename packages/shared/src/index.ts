import { z } from "zod";

export const CHARACTER_TYPES = ["main", "supporting"] as const;
export const MEDIA_TYPES = ["background_music", "sound_effect"] as const;

export const characterTypeSchema = z.enum(CHARACTER_TYPES);
export const mediaTypeSchema = z.enum(MEDIA_TYPES);

const idSchema = z.uuid();
const timestampSchema = z.iso.datetime({ offset: true });
const positionSchema = z.number().int().nonnegative();
const responseFields = {
  id: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
};

export const createProjectSchema = z.strictObject({
  title: z.string().min(1),
  genre: z.string().min(1),
  description: z.string(),
});
export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0);
export const projectSchema = z.strictObject({
  ...responseFields,
  ...createProjectSchema.shape,
});

export const createCharacterSchema = z.strictObject({
  name: z.string().min(1),
  type: characterTypeSchema,
});
export const updateCharacterSchema = createCharacterSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0);
export const characterSchema = z.strictObject({
  ...responseFields,
  projectId: idSchema,
  ...createCharacterSchema.shape,
});

export const createEpisodeSchema = z.strictObject({
  title: z.string().min(1),
  description: z.string(),
});
export const updateEpisodeSchema = createEpisodeSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0);
export const episodeSchema = z.strictObject({
  ...responseFields,
  projectId: idSchema,
  position: positionSchema,
  ...createEpisodeSchema.shape,
});
export const reorderEpisodesSchema = z.strictObject({
  episodeIds: z
    .array(idSchema)
    .refine((ids) => new Set(ids).size === ids.length),
});

export const createSceneSchema = z.strictObject({
  title: z.string().min(1),
  backgroundMusicId: idSchema.nullable().optional(),
});
export const updateSceneSchema = createSceneSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0);
export const reorderScenesSchema = z.strictObject({
  sceneIds: z.array(idSchema).refine((ids) => new Set(ids).size === ids.length),
});
export const sceneSchema = z.strictObject({
  ...responseFields,
  episodeId: idSchema,
  title: createSceneSchema.shape.title,
  backgroundMusicId: idSchema.nullable(),
  position: positionSchema,
});

const soundEffectIdsSchema = z
  .array(idSchema)
  .refine((ids) => new Set(ids).size === ids.length);
export const createCuePointSchema = z.strictObject({
  characterId: idSchema,
  spokenText: z.string(),
  soundEffectIds: soundEffectIdsSchema.optional(),
});
export const updateCuePointSchema = createCuePointSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0);
export const reorderCuePointsSchema = z.strictObject({
  cuePointIds: z
    .array(idSchema)
    .refine((ids) => new Set(ids).size === ids.length),
});
export const cuePointSchema = z.strictObject({
  ...responseFields,
  sceneId: idSchema,
  characterId: idSchema,
  spokenText: z.string(),
  soundEffectIds: soundEffectIdsSchema,
  position: positionSchema,
});

// PostgreSQL bigint cannot be represented exactly by every JavaScript number.
export const fileSizeSchema = z.string().regex(/^(0|[1-9]\d*)$/);
export const mediaItemSchema = z.strictObject({
  ...responseFields,
  name: z.string(),
  type: mediaTypeSchema,
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: fileSizeSchema,
});

export type CharacterType = z.infer<typeof characterTypeSchema>;
export type MediaType = z.infer<typeof mediaTypeSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectSchema>;
export type Project = z.infer<typeof projectSchema>;
export type CreateCharacterRequest = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterRequest = z.infer<typeof updateCharacterSchema>;
export type Character = z.infer<typeof characterSchema>;
export type CreateEpisodeRequest = z.infer<typeof createEpisodeSchema>;
export type UpdateEpisodeRequest = z.infer<typeof updateEpisodeSchema>;
export type Episode = z.infer<typeof episodeSchema>;
export type ReorderEpisodesRequest = z.infer<typeof reorderEpisodesSchema>;
export type CreateSceneRequest = z.infer<typeof createSceneSchema>;
export type UpdateSceneRequest = z.infer<typeof updateSceneSchema>;
export type ReorderScenesRequest = z.infer<typeof reorderScenesSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type CreateCuePointRequest = z.infer<typeof createCuePointSchema>;
export type UpdateCuePointRequest = z.infer<typeof updateCuePointSchema>;
export type ReorderCuePointsRequest = z.infer<typeof reorderCuePointsSchema>;
export type CuePoint = z.infer<typeof cuePointSchema>;
export const updateMediaSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(255),
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0);
export const listMediaSchema = z.strictObject({
  type: mediaTypeSchema.optional(),
});
export const uploadMediaSchema = z.strictObject({
  name: z.string().trim().min(1).max(255),
  type: mediaTypeSchema,
});
export type UpdateMediaRequest = z.infer<typeof updateMediaSchema>;
export type UploadMediaRequest = z.infer<typeof uploadMediaSchema>;
export type MediaItem = z.infer<typeof mediaItemSchema>;
