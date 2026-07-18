import { createWriteStream } from "node:fs";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
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
    const path = join(config.projectRoot, `${project.id}.appdemo`);
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

  private async writeManifest(path: string, project: Project) {
    const target = join(path, "project.json");
    const temporary = `${target}.tmp`;
    await writeFile(temporary, `${JSON.stringify(projectSchema.parse(project), null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporary, target);
  }
}
