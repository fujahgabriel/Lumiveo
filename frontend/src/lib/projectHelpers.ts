import type { Project, Scene } from "../types";

export function updateSceneCopy(
  updateScene: (updater: (scene: Scene) => Scene) => void,
  scene: Scene,
  locale: string,
  field: "caption" | "narration",
  value: string,
) {
  const fallback =
    scene.copy[locale] ??
    scene.copy[Object.keys(scene.copy)[0]] ?? {
      caption: "",
      narration: "",
      manuallyEdited: false,
      stale: false,
    };
  updateScene((current) => ({
    ...current,
    copy: {
      ...current.copy,
      [locale]: { ...fallback, [field]: value, manuallyEdited: true, stale: false },
    },
  }));
}

export function addScene(
  project: Project,
  updateProject: (updater: (current: Project) => Project) => void,
  select: (id: string) => void,
) {
  const id = crypto.randomUUID();
  const locale = project.activeLocale;
  const scene: Scene = {
    id,
    name: `Scene ${project.scenes.length + 1}`,
    assetId: null,
    durationInFrames: project.fps * 3,
    transition: "fade",
    layout: "device",
    background: "#171714",
    accent: "#e6ff5c",
    copy: {
      [locale]: {
        caption: "Describe the next product moment.",
        narration: "Explain what the user can accomplish here.",
        manuallyEdited: false,
        stale: false,
      },
    },
    textColor: "#f7f7f2",
    fontFamily: "Inter",
    fontSize: 40,
    fontWeight: "bold",
    fontStyle: "normal",
    mediaFit: "cover",
    mediaX: 50,
    mediaY: 50,
    devicePreset: "iphone-6.7",
    voiceId: null,
    textTransition: "fade",
    textTransitionDuration: 24,
    textTransitionDirection: "from-bottom",
  };
  updateProject((current) => ({ ...current, scenes: [...current.scenes, scene] }));
  select(id);
}

export function normalizeDialogPaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return [value];
  if (value && typeof value === "object" && "paths" in value && Array.isArray((value as { paths: unknown }).paths)) {
    return (value as { paths: unknown[] }).paths.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export function mimeFromPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "heic"].includes(extension ?? "")) {
    return `image/${extension === "jpg" ? "jpeg" : extension}`;
  }
  if (extension === "gif") return "image/gif";
  if (["mp4", "mov", "webm", "m4v"].includes(extension ?? "")) {
    return extension === "mov" ? "video/quicktime" : `video/${extension}`;
  }
  if (["mp3", "wav", "m4a", "aac"].includes(extension ?? "")) return `audio/${extension}`;
  return "application/octet-stream";
}
