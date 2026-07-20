import type { ExportPreset, Project } from "../types";

export const presetDimensions: Record<ExportPreset, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
};

const TRANSITION_FRAMES = 12;

export function durationFor(project: Pick<Project, "scenes">) {
  const total = project.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
  const overlaps = project.scenes
    .slice(0, -1)
    .filter((s) => s.transition !== "none")
    .length * TRANSITION_FRAMES;
  return total - overlaps;
}
