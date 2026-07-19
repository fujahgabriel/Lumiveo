import { createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile, unlink } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { IncomingMessage } from "node:http";
import { pipeline } from "node:stream/promises";
import type { AppDatabase } from "./db.js";
import { config } from "./config.js";
import { createProject, projectSchema, type Project } from "./schemas.js";

interface ProjectRow {
  id: string;
  title: string;
  path: string;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
}

const mediaByMime: Record<string, "image" | "video" | "audio" | "gif"> = {
  "image/gif": "gif",
};

export class ProjectStore {
  constructor(private readonly database: AppDatabase) {}

  async create(title?: string) {
    const project = createProject(title);
    const path = join(config.projectRoot, `${project.id}.lumiveo`);
    await mkdir(join(path, "assets"), { recursive: true });
    await mkdir(join(path, "generated"), { recursive: true });
    await this.writeManifest(path, project);
    this.upsertIndex(project, path);
    return project;
  }

  list() {
    return this.database.db
      .prepare(
        "SELECT id, title, path, created_at, updated_at, last_opened_at FROM projects ORDER BY last_opened_at DESC",
      )
      .all() as unknown as ProjectRow[];
  }

  async get(id: string) {
    const row = this.getRow(id);
    if (!row) return null;
    const raw = await readFile(join(row.path, "project.json"), "utf8");
    const project = projectSchema.parse(JSON.parse(raw));
    this.database.db
      .prepare("UPDATE projects SET last_opened_at = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
    return project;
  }

  async save(input: unknown) {
    const project = projectSchema.parse(input);
    const row = this.getRow(project.id);
    if (!row) throw new Error("project_not_found");
    const updated = { ...project, updatedAt: new Date().toISOString() };
    await this.writeManifest(row.path, updated);
    this.upsertIndex(updated, row.path);
    return updated;
  }

  async importPath(projectId: string, sourcePath: string, mimeType: string) {
    const row = this.requireRow(projectId);
    const source = await stat(sourcePath);
    if (!source.isFile()) throw new Error("asset_not_file");
    const asset = this.newAsset(basename(sourcePath), mimeType, source.size);
    const target = join(row.path, "assets", asset.fileName);
    await copyFile(sourcePath, target);
    return this.appendAsset(projectId, asset);
  }

  async importStream(
    projectId: string,
    name: string,
    mimeType: string,
    size: number,
    stream: IncomingMessage,
  ) {
    const row = this.requireRow(projectId);
    const asset = this.newAsset(name, mimeType, size);
    const target = join(row.path, "assets", asset.fileName);
    const temporary = `${target}.part`;
    await pipeline(stream, createWriteStream(temporary, { flags: "wx" }));
    const saved = await stat(temporary);
    if (size > 0 && saved.size !== size) {
      throw new Error("asset_size_mismatch");
    }
    await rename(temporary, target);
    return this.appendAsset(projectId, { ...asset, size: saved.size });
  }

  assetInfo(projectId: string, assetId: string) {
    const row = this.requireRow(projectId);
    return this.get(projectId).then((project) => {
      const asset = project?.assets.find((entry) => entry.id === assetId);
      if (!asset) return null;
      return {
        asset,
        path: join(row.path, "assets", asset.fileName),
      };
    });
  }

  projectPath(projectId: string) {
    return this.requireRow(projectId).path;
  }

  async rename(projectId: string, title: string) {
    const project = await this.get(projectId);
    if (!project) throw new Error("project_not_found");
    const updated = await this.save({ ...project, title });
    return updated;
  }

  async delete(projectId: string) {
    const row = this.requireRow(projectId);
    await rm(row.path, { recursive: true, force: true });
    this.database.db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
    return { deleted: true };
  }

  async deleteAll() {
    const rows = this.database.db
      .prepare("SELECT id, path FROM projects")
      .all() as unknown as ProjectRow[];
    for (const row of rows) {
      await rm(row.path, { recursive: true, force: true });
    }
    this.database.db.prepare("DELETE FROM projects").run();
    return { deleted: rows.length };
  }

  async exportProject(projectId: string, targetDir: string) {
    const row = this.requireRow(projectId);
    await mkdir(targetDir, { recursive: true });
    await copyFile(join(row.path, "project.json"), join(targetDir, "project.json"));
    const assetsDir = join(row.path, "assets");
    const assets = await readdir(assetsDir).catch(() => [] as string[]);
    if (assets.length > 0) {
      await mkdir(join(targetDir, "assets"), { recursive: true });
      for (const file of assets) {
        await copyFile(join(assetsDir, file), join(targetDir, "assets", file));
      }
    }
    return { path: targetDir };
  }

  async importProject(sourceDir: string) {
    const raw = await readFile(join(sourceDir, "project.json"), "utf8");
    const project = projectSchema.parse(JSON.parse(raw));
    const targetPath = join(config.projectRoot, `${project.id}.lumiveo`);
    await mkdir(targetPath, { recursive: true });
    await copyFile(join(sourceDir, "project.json"), join(targetPath, "project.json"));
    const sourceAssets = join(sourceDir, "assets");
    const files = await readdir(sourceAssets).catch(() => [] as string[]);
    if (files.length > 0) {
      await mkdir(join(targetPath, "assets"), { recursive: true });
      for (const file of files) {
        await copyFile(join(sourceAssets, file), join(targetPath, "assets", file));
      }
    }
    this.upsertIndex(project, targetPath);
    return project;
  }

  async removeAsset(projectId: string, assetId: string) {
    const row = this.requireRow(projectId);
    const project = await this.get(projectId);
    if (!project) throw new Error("project_not_found");
    const asset = project.assets.find((a) => a.id === assetId);
    if (!asset) throw new Error("asset_not_found");
    const filePath = join(row.path, "assets", asset.fileName);
    await unlink(filePath).catch(() => {});
    const updated = await this.save({
      ...project,
      assets: project.assets.filter((a) => a.id !== assetId),
    });
    return { project: updated };
  }

  private async appendAsset(projectId: string, asset: Project["assets"][number]) {
    const project = await this.get(projectId);
    if (!project) throw new Error("project_not_found");
    const updated = await this.save({ ...project, assets: [...project.assets, asset] });
    return { project: updated, asset };
  }

  private newAsset(name: string, mimeType: string, size: number): Project["assets"][number] {
    const id = crypto.randomUUID();
    const extension = extname(name).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 10);
    const normalizedMime = mimeType.toLowerCase();
    const mediaType =
      mediaByMime[normalizedMime] ??
      (normalizedMime.startsWith("video/")
        ? "video"
        : normalizedMime.startsWith("audio/")
          ? "audio"
          : "image");
    return {
      id,
      name: basename(name).slice(0, 255),
      fileName: `${id}${extension}`,
      mimeType: normalizedMime || "application/octet-stream",
      mediaType,
      size,
      createdAt: new Date().toISOString(),
    };
  }

  private getRow(id: string) {
    return this.database.db
      .prepare(
        "SELECT id, title, path, created_at, updated_at, last_opened_at FROM projects WHERE id = ?",
      )
      .get(id) as ProjectRow | undefined;
  }

  private requireRow(id: string) {
    const row = this.getRow(id);
    if (!row) throw new Error("project_not_found");
    return row;
  }

  private upsertIndex(project: Project, path: string) {
    this.database.db
      .prepare(
        `INSERT INTO projects (id, title, path, created_at, updated_at, last_opened_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           path = excluded.path,
           updated_at = excluded.updated_at,
           last_opened_at = excluded.last_opened_at`,
      )
      .run(
        project.id,
        project.title,
        path,
        project.createdAt,
        project.updatedAt,
        new Date().toISOString(),
      );
  }

  async listVersions(projectId: string) {
    const row = this.requireRow(projectId);
    const versionsDir = join(row.path, "versions");
    const files = await readdir(versionsDir).catch(() => [] as string[]);
    const list = [];
    for (const file of files) {
      if (!file.startsWith("project-") || !file.endsWith(".json")) continue;
      const id = file.slice("project-".length, -".json".length);
      const timestamp = new Date(Number(id)).toISOString();
      const stats = await stat(join(versionsDir, file)).catch(() => null);
      list.push({
        id,
        timestamp,
        size: stats?.size ?? 0,
      });
    }
    // Sort descending by timestamp (newest first)
    return list.sort((a, b) => b.id.localeCompare(a.id));
  }

  async restoreVersion(projectId: string, versionId: string) {
    const row = this.requireRow(projectId);
    const source = join(row.path, "versions", `project-${versionId}.json`);
    const target = join(row.path, "project.json");
    await copyFile(source, target);
    const restored = await this.get(projectId);
    if (!restored) throw new Error("failed_to_load_restored_project");
    return restored;
  }

  private async writeManifest(path: string, project: Project) {
    const target = join(path, "project.json");
    const temporary = `${target}.tmp`;
    const content = `${JSON.stringify(projectSchema.parse(project), null, 2)}\n`;
    await writeFile(temporary, content, {
      mode: 0o600,
    });
    await rename(temporary, target);

    // Save version history snapshot
    const versionsDir = join(path, "versions");
    await mkdir(versionsDir, { recursive: true }).catch(() => {});
    const timestamp = Date.now();
    const versionFile = join(versionsDir, `project-${timestamp}.json`);
    await writeFile(versionFile, content, { mode: 0o600 }).catch(() => {});

    // Prune to keep only the last 30 versions
    const files = await readdir(versionsDir).catch(() => [] as string[]);
    const projectVersions = files
      .filter((file) => file.startsWith("project-") && file.endsWith(".json"))
      .sort(); // ascending order of timestamps
    if (projectVersions.length > 30) {
      const toDelete = projectVersions.slice(0, projectVersions.length - 30);
      for (const file of toDelete) {
        await unlink(join(versionsDir, file)).catch(() => {});
      }
    }
  }
}
