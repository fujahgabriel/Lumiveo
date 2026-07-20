export type MediaType = "image" | "video" | "audio" | "gif";
export type ExportPreset = "portrait" | "landscape" | "square";
export type ExportFormat = "mp4" | "gif" | "png-sequence";
export type ExportQuality = "draft" | "normal" | "high";

export interface LocaleTrack {
  code: string;
  label: string;
  direction: "ltr" | "rtl";
}

export interface Asset {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  mediaType: MediaType;
  size: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  createdAt: string;
}

export interface SceneCopy {
  caption: string;
  narration: string;
  manuallyEdited: boolean;
  stale: boolean;
}

export interface Scene {
  id: string;
  name: string;
  assetId: string | null;
  durationInFrames: number;
  transition: "none" | "fade" | "slide" | "scale";
  layout: "device" | "full" | "split" | "minimal" | "gradient" | "highlight";
  background: string;
  accent: string;
  copy: Record<string, SceneCopy>;
  showLogo?: boolean;
  logoAssetId?: string | null;
  logoWidth?: number;
  logoHeight?: number;
  logoRadius?: number;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  mediaFit?: "cover" | "contain" | "fill" | "none";
  mediaX?: number;
  mediaY?: number;
  devicePreset?: string;
  voiceId?: string | null;
  textTransition?: "fade" | "typewriter" | "slide" | "bounce" | "breathe";
  textTransitionDuration?: number;
  textTransitionDirection?: "from-bottom" | "from-top" | "from-left" | "from-right";
}

export interface Project {
  schemaVersion: 1;
  id: string;
  title: string;
  productName: string;
  productDescription: string;
  createdAt: string;
  updatedAt: string;
  fps: number;
  sourceLocale: string;
  activeLocale: string;
  locales: LocaleTrack[];
  assets: Asset[];
  scenes: Scene[];
  generationHistory: Array<{
    id: string;
    createdAt: string;
    provider: string;
    model: string;
    operation: "storyboard" | "scene" | "translation" | "voiceover";
    locale?: string;
    sceneIds: string[];
    accepted: boolean;
  }>;
  backgroundAudioId?: string | null;
  backgroundAudioUrl?: string | null;
  backgroundAudioVolume?: number;
  backgroundAudioFadeIn?: number;
  backgroundAudioFadeOut?: number;
}

export interface AppSettings {
  onboardingComplete: boolean;
  uiLocale: string;
  notificationsEnabled: boolean;
  analyticsEnabled: boolean;
  analyticsProvider: "none" | "posthog" | "firebase";
  ai: {
    provider: "local" | "openai" | "anthropic" | "google" | "custom";
    model: string;
    endpoint: string;
    hasCredential: boolean;
  };
  tts: {
    provider: "none" | "elevenlabs";
    voiceId: string;
    hasCredential: boolean;
    speed?: number;
    stability?: number;
    similarityBoost?: number;
  };
}

export interface ProjectListItem {
  id: string;
  title: string;
  path: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
}

export interface RenderJob {
  id: string;
  project_id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  request_json: string;
  progress: number;
  output_path: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoryboardProposal {
  id: string;
  provider: string;
  model: string;
  locale: string;
  operation: "storyboard" | "translation";
  summary: string;
  scenes: Array<{
    sourceSceneId: string | null;
    assetId: string | null;
    name: string;
    caption: string;
    narration: string;
    durationSeconds: number;
    layout: "device" | "full" | "split" | "minimal" | "gradient" | "highlight";
    transition: "none" | "fade" | "slide" | "scale";
    background: string;
    accent: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    fontStyle: string;
    textColor: string;
    textTransition: "fade" | "typewriter" | "slide" | "bounce" | "breathe";
    textTransitionDuration: number;
    textTransitionDirection: "from-bottom" | "from-top" | "from-left" | "from-right";
    devicePreset: string;
  }>;
}

export interface VideoProps extends Record<string, unknown> {
  project: Project;
  locale: string;
  preset: ExportPreset;
  assetBaseUrl: string;
  workerToken: string;
}
