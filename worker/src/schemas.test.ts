import { describe, expect, it } from "vitest";
import { appSettingsSchema, createProject, defaultSettings, projectSchema } from "./schemas.js";

describe("project schema", () => {
  it("creates a valid default project", () => {
    const project = createProject("Demo");
    expect(projectSchema.parse(project)).toEqual(project);
    expect(project.scenes).toHaveLength(1);
    expect(project.locales[0].code).toBe("en");
    expect(project.scenes[0].durationInFrames).toBe(90);
  });

  it("rejects scenes with out-of-range durations", () => {
    const project = createProject();
    project.scenes[0].durationInFrames = 5;
    expect(() => projectSchema.parse(project)).toThrow();
  });

  it("rejects invalid background colors", () => {
    const project = createProject();
    project.scenes[0].background = "red";
    expect(() => projectSchema.parse(project)).toThrow();
  });
});

describe("app settings schema", () => {
  it("parses safe defaults from an empty object", () => {
    expect(defaultSettings.onboardingComplete).toBe(false);
    expect(defaultSettings.analyticsEnabled).toBe(false);
    expect(defaultSettings.ai.provider).toBe("local");
  });

  it("rejects unknown analytics providers", () => {
    expect(() =>
      appSettingsSchema.parse({ ...defaultSettings, analyticsProvider: "mixpanel" }),
    ).toThrow();
  });
});
