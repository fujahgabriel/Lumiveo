import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.APP_DEMO_DATA_DIR = mkdtempSync(join(tmpdir(), "appdemo-db-"));

const { AppDatabase } = await import("./db.js");
const { defaultSettings } = await import("./schemas.js");

describe("AppDatabase", () => {
  let database: InstanceType<typeof AppDatabase>;

  beforeEach(() => {
    database = new AppDatabase(
      join(process.env.APP_DEMO_DATA_DIR!, `test-${crypto.randomUUID()}.db`),
    );
  });

  afterEach(() => {
    database.close();
  });

  it("returns defaults before any write", () => {
    expect(database.getSettings()).toEqual(defaultSettings);
  });

  it("persists settings across instances", () => {
    const path = join(process.env.APP_DEMO_DATA_DIR!, `persist-${crypto.randomUUID()}.db`);
    const first = new AppDatabase(path);
    first.setSettings({ ...defaultSettings, uiLocale: "fr", onboardingComplete: true });
    first.close();
    const reopened = new AppDatabase(path);
    expect(reopened.getSettings().uiLocale).toBe("fr");
    reopened.close();
  });

  it("round-trips settings with provider config", () => {
    const next = {
      ...defaultSettings,
      analyticsEnabled: true,
      analyticsProvider: "posthog" as const,
      ai: { provider: "eve" as const, model: "anthropic/claude-sonnet-5", endpoint: "http://127.0.0.1:2000", hasCredential: false },
    };
    database.setSettings(next);
    expect(database.getSettings()).toEqual(next);
  });

  it("creates the analytics queue table", () => {
    database.db
      .prepare(
        "INSERT INTO analytics_events (id, name, properties_json, attempts, created_at) VALUES (?, ?, ?, 0, ?)",
      )
      .run(crypto.randomUUID(), "project_created", "{}", new Date().toISOString());
    const rows = database.db.prepare("SELECT name FROM analytics_events").all();
    expect(rows).toHaveLength(1);
  });
});
