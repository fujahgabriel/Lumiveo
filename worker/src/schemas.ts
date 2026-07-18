import { z } from "zod";

export const localeSchema = z.object({
  code: z.string().min(2).max(35),
  label: z.string().min(1).max(80),
  direction: z.enum(["ltr", "rtl"]).default("ltr"),
});

export const assetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  mediaType: z.enum(["image", "video", "audio", "gif"]),
  size: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().nonnegative().optional(),
  createdAt: z.string().datetime(),
});

export const localizedCopySchema = z.record(
  z.string(),
  z.object({
    caption: z.string().max(500),
    narration: z.string().max(2_000),
    manuallyEdited: z.boolean().default(false),
    stale: z.boolean().default(false),
  }),
);

export const sceneSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  assetId: z.string().uuid().nullable(),
  durationInFrames: z.number().int().min(15).max(18_000),
  transition: z.enum(["none", "fade", "slide", "scale"]).default("fade"),
  layout: z.enum(["device", "full", "split"]).default("device"),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  copy: localizedCopySchema,
});

export const generationRecordSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  provider: z.string().min(1),
  model: z.string().min(1),
  operation: z.enum(["storyboard", "scene", "translation", "voiceover"]),
  locale: z.string().optional(),
  sceneIds: z.array(z.string().uuid()),
  accepted: z.boolean().default(false),
});

export const projectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  title: z.string().min(1).max(160),
  productName: z.string().max(160),
  productDescription: z.string().max(5_000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  fps: z.number().int().min(12).max(60),
  sourceLocale: z.string().min(2).max(35),
  activeLocale: z.string().min(2).max(35),
  locales: z.array(localeSchema).min(1),
  assets: z.array(assetSchema),
  scenes: z.array(sceneSchema).min(1).max(200),
  generationHistory: z.array(generationRecordSchema).default([]),
});

export const appSettingsSchema = z.object({
  onboardingComplete: z.boolean().default(false),
  uiLocale: z.string().default("en"),
  analyticsEnabled: z.boolean().default(false),
  analyticsProvider: z.enum(["none", "posthog", "firebase"]).default("none"),
  ai: z
    .object({
      provider: z.enum(["local", "eve", "openai", "anthropic", "google", "custom"]).default("local"),
      model: z.string().max(160).default(""),
      endpoint: z.string().url().or(z.literal("")).default(""),
      hasCredential: z.boolean().default(false),
    })
    .prefault({}),
  tts: z
    .object({
      provider: z.enum(["none", "elevenlabs"]).default("none"),
      voiceId: z.string().max(160).default(""),
      hasCredential: z.boolean().default(false),
    })
    .prefault({}),
});

export const renderRequestSchema = z.object({
  projectId: z.string().uuid(),
  locale: z.string().min(2).max(35),
  preset: z.enum(["portrait", "landscape", "square"]),
  format: z.enum(["mp4", "gif", "png-sequence"]),
});

export const generationRequestSchema = z.object({
  projectId: z.string().uuid(),
  operation: z.enum(["storyboard", "translation"]),
  locale: z.string().min(2).max(35).optional(),
  regenerateSceneIds: z.array(z.string().uuid()).default([]),
});

export type Project = z.infer<typeof projectSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type RenderRequest = z.infer<typeof renderRequestSchema>;
export type GenerationRequest = z.infer<typeof generationRequestSchema>;

export const defaultSettings: AppSettings = appSettingsSchema.parse({});

export function createProject(title = "Untitled demo"): Project {
  const now = new Date().toISOString();
  return projectSchema.parse({
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title,
    productName: "",
    productDescription: "",
    createdAt: now,
    updatedAt: now,
    fps: 30,
    sourceLocale: "en",
    activeLocale: "en",
    locales: [{ code: "en", label: "English", direction: "ltr" }],
    assets: [],
    scenes: [
      {
        id: crypto.randomUUID(),
        name: "Opening",
        assetId: null,
        durationInFrames: 90,
        transition: "fade",
        layout: "device",
        background: "#171714",
        accent: "#e6ff5c",
        copy: {
          en: {
            caption: "Make your product impossible to miss.",
            narration: "Turn your app into a polished story.",
            manuallyEdited: false,
            stale: false,
          },
        },
      },
    ],
    generationHistory: [],
  });
}
