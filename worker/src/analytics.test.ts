import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.APP_DEMO_DATA_DIR = mkdtempSync(join(tmpdir(), "appdemo-analytics-"));

const { AppDatabase } = await import("./db.js");
const { AnalyticsService } = await import("./analytics.js");
const { defaultSettings } = await import("./schemas.js");

describe("AnalyticsService privacy gates", () => {
  let database: InstanceType<typeof AppDatabase>;
  let analytics: InstanceType<typeof AnalyticsService>;

  const queued = () =>
    database.db.prepare("SELECT name, properties_json FROM analytics_events").all() as unknown as Array<{
      name: string;
      properties_json: string;
    }>;

  beforeEach(() => {
    database = new AppDatabase(join(process.env.APP_DEMO_DATA_DIR!, `t-${crypto.randomUUID()}.db`));
    analytics = new AnalyticsService(database);
  });

  afterEach(() => database.close());

  it("drops everything while consent is off", () => {
    analytics.track("project_created");
    expect(queued()).toHaveLength(0);
  });

  it("queues only allowlisted events when consent is on", () => {
    database.setSettings({ ...defaultSettings, analyticsEnabled: true });
    analytics.track("project_created");
    analytics.track("prompt_content_leak");
    const rows = queued();
    expect(rows.map((row) => row.name)).toEqual(["project_created"]);
  });

  it("strips non-allowlisted properties", () => {
    database.setSettings({ ...defaultSettings, analyticsEnabled: true });
    analytics.track("media_imported", {
      mediaType: "image",
      filePath: "/Users/secret/shot.png",
      prompt: "do not collect",
    });
    const properties = JSON.parse(queued()[0].properties_json);
    expect(properties).toEqual({ mediaType: "image" });
  });

  it("sanitizes paths out of exception codes", () => {
    database.setSettings({ ...defaultSettings, analyticsEnabled: true });
    analytics.captureException(new Error("open /Users/fujah/private/file.json failed"), "render");
    const properties = JSON.parse(queued()[0].properties_json);
    expect(properties.errorCode).not.toContain("/Users");
    expect(properties.operation).toBe("render");
  });
});
