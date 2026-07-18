import type { AppDatabase } from "./db.js";

export const analyticsEvents = [
  "onboarding_completed",
  "project_created",
  "project_opened",
  "media_imported",
  "generation_requested",
  "generation_completed",
  "generation_failed",
  "render_started",
  "render_completed",
  "render_failed",
  "render_cancelled",
  "locale_added",
  "app_updated",
  "exception",
] as const;

export type AnalyticsEvent = (typeof analyticsEvents)[number];

const allowed = new Set<string>(analyticsEvents);
const allowedProperties = new Set([
  "appVersion",
  "macosVersion",
  "operation",
  "provider",
  "mediaType",
  "format",
  "preset",
  "locale",
  "durationBucket",
  "errorCode",
]);

interface QueuedEvent {
  id: string;
  name: AnalyticsEvent;
  properties: Record<string, string | number | boolean>;
  createdAt: string;
}

interface AnalyticsAdapter {
  send(events: QueuedEvent[]): Promise<void>;
}

class NoopAdapter implements AnalyticsAdapter {
  async send() {}
}

class PostHogAdapter implements AnalyticsAdapter {
  constructor(
    private readonly key: string,
    private readonly host: string,
  ) {}

  async send(events: QueuedEvent[]) {
    await Promise.all(
      events.map((event) =>
        fetch(`${this.host.replace(/\/$/, "")}/capture/`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            api_key: this.key,
            event: event.name,
            properties: { ...event.properties, distinct_id: "anonymous-desktop" },
            timestamp: event.createdAt,
          }),
        }).then(assertOk),
      ),
    );
  }
}

class FirebaseAdapter implements AnalyticsAdapter {
  constructor(
    private readonly measurementId: string,
    private readonly apiSecret: string,
  ) {}

  async send(events: QueuedEvent[]) {
    const url = new URL("https://www.google-analytics.com/mp/collect");
    url.searchParams.set("measurement_id", this.measurementId);
    url.searchParams.set("api_secret", this.apiSecret);
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: "anonymous-desktop",
        events: events.map((event) => ({ name: event.name, params: event.properties })),
      }),
    }).then(assertOk);
  }
}

export class AnalyticsService {
  constructor(private readonly database: AppDatabase) {}

  track(name: string, properties: Record<string, unknown> = {}) {
    const settings = this.database.getSettings();
    if (!settings.analyticsEnabled || !allowed.has(name)) return;
    const sanitized = Object.fromEntries(
      Object.entries(properties)
        .filter(([key, value]) => allowedProperties.has(key) && isScalar(value))
        .map(([key, value]) => [key, value]),
    );
    this.database.db
      .prepare(
        "INSERT INTO analytics_events (id, name, properties_json, attempts, created_at) VALUES (?, ?, ?, 0, ?)",
      )
      .run(crypto.randomUUID(), name, JSON.stringify(sanitized), new Date().toISOString());
  }

  captureException(error: unknown, operation: string) {
    const code =
      error instanceof Error
        ? error.message.replace(/[/\\][^\s]+/g, "[path]").slice(0, 100)
        : "unknown_error";
    this.track("exception", { operation, errorCode: code });
  }

  async flush() {
    const settings = this.database.getSettings();
    if (!settings.analyticsEnabled || settings.analyticsProvider === "none") return;
    const rows = this.database.db
      .prepare(
        "SELECT id, name, properties_json, created_at FROM analytics_events WHERE attempts < 5 ORDER BY created_at LIMIT 50",
      )
      .all() as unknown as Array<{
      id: string;
      name: AnalyticsEvent;
      properties_json: string;
      created_at: string;
    }>;
    if (rows.length === 0) return;
    const events = rows.map((row) => ({
      id: row.id,
      name: row.name,
      properties: JSON.parse(row.properties_json),
      createdAt: row.created_at,
    }));
    try {
      await this.adapter(settings.analyticsProvider).send(events);
      const remove = this.database.db.prepare("DELETE FROM analytics_events WHERE id = ?");
      this.database.db.exec("BEGIN");
      for (const event of events) remove.run(event.id);
      this.database.db.exec("COMMIT");
    } catch {
      const retry = this.database.db.prepare(
        "UPDATE analytics_events SET attempts = attempts + 1 WHERE id = ?",
      );
      for (const event of events) retry.run(event.id);
    }
  }

  private adapter(provider: "none" | "posthog" | "firebase"): AnalyticsAdapter {
    if (provider === "posthog" && process.env.POSTHOG_KEY) {
      return new PostHogAdapter(
        process.env.POSTHOG_KEY,
        process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
      );
    }
    if (
      provider === "firebase" &&
      process.env.FIREBASE_MEASUREMENT_ID &&
      process.env.FIREBASE_API_SECRET
    ) {
      return new FirebaseAdapter(
        process.env.FIREBASE_MEASUREMENT_ID,
        process.env.FIREBASE_API_SECRET,
      );
    }
    return new NoopAdapter();
  }
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

async function assertOk(response: Response) {
  if (!response.ok) throw new Error(`analytics_http_${response.status}`);
}
