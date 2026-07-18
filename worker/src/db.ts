import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";
import { appSettingsSchema, defaultSettings, type AppSettings } from "./schemas.js";

export class AppDatabase {
  readonly db: DatabaseSync;

  constructor(path = join(config.dataDir, "app.db")) {
    mkdirSync(config.dataDir, { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.migrate();
  }

  close() {
    this.db.close();
  }

  getSettings(): AppSettings {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key = 'app'")
      .get() as { value?: string } | undefined;
    if (!row?.value) return defaultSettings;
    return appSettingsSchema.parse(JSON.parse(row.value));
  }

  setSettings(settings: AppSettings) {
    const value = JSON.stringify(appSettingsSchema.parse(settings));
    this.db
      .prepare(
        "INSERT INTO settings (key, value, updated_at) VALUES ('app', ?, ?) " +
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
      )
      .run(value, new Date().toISOString());
  }

  private migrate() {
    const version = this.db.prepare("PRAGMA user_version").get() as { user_version: number };
    if (version.user_version >= 1) return;

    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.exec(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          path TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_opened_at TEXT NOT NULL
        );
        CREATE TABLE render_jobs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed','cancelled')),
          request_json TEXT NOT NULL,
          progress REAL NOT NULL DEFAULT 0,
          output_path TEXT,
          error_code TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE TABLE generation_history (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          operation TEXT NOT NULL,
          locale TEXT,
          scene_ids_json TEXT NOT NULL,
          accepted INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE TABLE analytics_events (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          properties_json TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE INDEX projects_last_opened_idx ON projects(last_opened_at DESC);
        CREATE INDEX render_jobs_status_idx ON render_jobs(status, created_at);
        CREATE INDEX analytics_events_created_idx ON analytics_events(created_at);
        PRAGMA user_version = 1;
      `);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
