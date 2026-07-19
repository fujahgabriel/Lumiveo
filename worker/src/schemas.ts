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
  layout: z.enum(["device", "full", "split", "minimal", "gradient", "highlight"]).default("device"),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  copy: localizedCopySchema,
  showLogo: z.boolean().default(false),
  logoAssetId: z.string().uuid().nullable().default(null),
  logoWidth: z.number().int().min(20).max(1000).default(120),
  logoHeight: z.number().int().min(20).max(1000).default(120),
  logoRadius: z.number().int().min(0).max(500).default(20),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f7f7f2"),
  fontFamily: z.string().default("Inter"),
  fontSize: z.number().int().min(12).max(120).default(40),
  fontWeight: z.string().default("bold"),
  fontStyle: z.string().default("normal"),
  mediaFit: z.enum(["cover", "contain", "fill", "none"]).default("cover"),
  mediaX: z.number().int().min(0).max(100).default(50),
  mediaY: z.number().int().min(0).max(100).default(50),
  devicePreset: z.string().default("iphone-6.7"),
  voiceId: z.string().nullable().default(null),
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
  notificationsEnabled: z.boolean().default(true),
  analyticsEnabled: z.boolean().default(false),
  analyticsProvider: z.enum(["none", "posthog", "firebase"]).default("none"),
  ai: z
    .object({
      provider: z.enum(["local", "openai", "anthropic", "google", "custom"]).default("local"),
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
      speed: z.number().min(0.5).max(2.0).default(1.0),
      stability: z.number().min(0.0).max(1.0).default(0.75),
      similarityBoost: z.number().min(0.0).max(1.0).default(0.75),
    })
    .prefault({}),
});

export const renderRequestSchema = z.object({
  projectId: z.string().uuid(),
  locale: z.string().min(2).max(35),
  preset: z.enum(["portrait", "landscape", "square"]),
  format: z.enum(["mp4", "gif", "png-sequence"]),
  scale: z.number().min(0.1).max(10).default(1),
});

export const generationRequestSchema = z.object({
  projectId: z.string().uuid(),
  operation: z.enum(["storyboard", "translation", "scene"]),
  locale: z.string().min(2).max(35).optional(),
  regenerateSceneIds: z.array(z.string().uuid()).default([]),
  fields: z.array(z.enum(["caption", "narration", "name", "layout"])).optional(),
});

export const sceneRegenerationSchema = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().uuid(),
  fields: z.array(z.enum(["caption", "narration", "name", "layout"])),
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
