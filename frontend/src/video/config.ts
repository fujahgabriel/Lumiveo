import type { ExportPreset, Project } from "../types";

export const presetDimensions: Record<ExportPreset, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
};

export function durationFor(project: Pick<Project, "scenes">) {
  return project.scenes.reduce((total, scene) => total + scene.durationInFrames, 0);
}
