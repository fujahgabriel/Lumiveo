import { mkdir } from "node:fs/promises";
import { cpus } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  makeCancelSignal,
  renderFrames,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import { config } from "./config.js";
import type { AppDatabase } from "./db.js";
import type { ProjectStore } from "./project-store.js";
import type { RenderRequest } from "./schemas.js";

interface RenderJobRow {
  id: string;
  project_id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  request_json: string;
  progress: number;
  output_path: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const renderEntry = config.renderEntry
  ? resolve(config.renderEntry)
  : resolve(sourceRoot, "../../frontend/src/video/render-entry.tsx");

export class RenderService {
  private bundlePromise: Promise<string> | null = null;
  private readonly cancellations = new Map<string, () => void>();
  private readonly queue: Array<{ id: string; request: RenderRequest }> = [];
  private running = false;

  constructor(
    private readonly database: AppDatabase,
    private readonly projects: ProjectStore,
  ) {
    this.database.db
      .prepare(
        "UPDATE render_jobs SET status = 'failed', error_code = 'worker_restarted', updated_at = ? WHERE status IN ('queued','running')",
      )
      .run(new Date().toISOString());
  }

  start(request: RenderRequest) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.database.db
      .prepare(
        `INSERT INTO render_jobs
         (id, project_id, status, request_json, progress, created_at, updated_at)
         VALUES (?, ?, 'queued', ?, 0, ?, ?)`,
      )
      .run(id, request.projectId, JSON.stringify(request), now, now);
    this.queue.push({ id, request });
    void this.process();
    return this.get(id);
  }

  private async process() {
    if (this.running || this.queue.length === 0) return;
    this.running = true;
    const { id, request } = this.queue.shift()!;
    await this.run(id, request);
    this.running = false;
    void this.process();
  }

  get(id: string) {
    return this.database.db
      .prepare(
        "SELECT id, project_id, status, request_json, progress, output_path, error_code, created_at, updated_at FROM render_jobs WHERE id = ?",
      )
      .get(id) as RenderJobRow | undefined;
  }

  list(projectId: string) {
    return this.database.db
      .prepare(
        "SELECT id, project_id, status, request_json, progress, output_path, error_code, created_at, updated_at FROM render_jobs WHERE project_id = ? ORDER BY created_at DESC LIMIT 20",
      )
      .all(projectId) as unknown as RenderJobRow[];
  }

  cancel(id: string) {
    this.cancellations.get(id)?.();
    const now = new Date().toISOString();
    this.database.db
      .prepare(
        "UPDATE render_jobs SET status = 'cancelled', error_code = NULL, updated_at = ? WHERE id = ? AND status IN ('queued','running')",
      )
      .run(now, id);
    return this.get(id);
  }

  private async run(id: string, request: RenderRequest) {
    const { cancelSignal, cancel } = makeCancelSignal();
    this.cancellations.set(id, cancel);
    let progress = 0;
    let lastSync = Date.now();
    
    const syncProgress = (p: number) => {
      progress = p;
      if (Date.now() - lastSync > 500) {
        this.update(id, "running", progress);
        lastSync = Date.now();
      }
    };

    try {
      await ensureBrowser();
      this.update(id, "running", 0.01);
      const project = await this.projects.get(request.projectId);
      if (!project) throw new Error("project_not_found");
      const serveUrl = await this.getBundle();
      const inputProps = {
        project,
        locale: request.locale,
        preset: request.preset,
        assetBaseUrl: `http://${config.host}:${config.port}/v1/projects/${project.id}/assets`,
        workerToken: config.token,
      };
      const composition = await selectComposition({
        serveUrl,
        id: "AppDemo",
        inputProps,
      });
      await mkdir(config.outputRoot, { recursive: true });
      const baseName = safeName(`${project.title}-${request.locale}-${request.preset}`);

      const concurrency = Math.min(cpus().length, 4);

      if (request.format === "png-sequence") {
        const outputDir = join(config.outputRoot, `${baseName}-${id}`);
        await mkdir(outputDir, { recursive: true });
        await renderFrames({
          serveUrl,
          composition,
          inputProps,
          outputDir,
          imageFormat: "png",
          cancelSignal,
          scale: request.scale ?? 1,
          concurrency,
          chromiumOptions: { gl: "angle" },
          onStart: () => undefined,
          onFrameUpdate: (framesRendered) =>
            syncProgress(framesRendered / composition.durationInFrames),
        });
        this.complete(id, outputDir);
        return;
      }

      const extension = request.format === "gif" ? "gif" : "mp4";
      const output = join(config.outputRoot, `${baseName}-${id}.${extension}`);
      const isVideo = request.format === "mp4";
      await renderMedia({
        serveUrl,
        composition,
        inputProps,
        outputLocation: output,
        codec: isVideo ? "h264" : "gif",
        overwrite: true,
        cancelSignal,
        scale: request.scale ?? 1,
        concurrency,
        chromiumOptions: { gl: "angle" },
        ...(isVideo && request.crf ? { crf: request.crf } : {}),
        ...(isVideo ? { pixelFormat: "yuv444p" } : {}),
        enforceAudioTrack: true,
        timeoutInMilliseconds: 600_000,
        onBrowserDownload: () => ({
          onProgress: (progress) => {
            if (!progress.alreadyAvailable) {
              console.log(`[Render] Downloading browser: ${Math.round(progress.percent * 100)}%`);
            }
          },
          version: null,
        }),
        onProgress: ({ progress: p }) => syncProgress(p),
      });
      this.complete(id, output);
    } catch (error) {
      if (this.get(id)?.status === "cancelled") {
        this.update(id, "cancelled", progress);
      } else {
        const code = error instanceof Error ? error.message.slice(0, 120) : "render_failed";
        this.database.db
          .prepare(
            "UPDATE render_jobs SET status = 'failed', error_code = ?, updated_at = ? WHERE id = ?",
          )
          .run(code, new Date().toISOString(), id);
      }
    } finally {
      this.cancellations.delete(id);
    }
  }

  private async getBundle() {
    this.bundlePromise ??= bundle({
      entryPoint: renderEntry,
      onProgress: () => undefined,
      webpackOverride: (config) => ({
        ...config,
        optimization: {
          ...config.optimization,
          minimize: true,
          usedExports: true,
          sideEffects: true,
        },
      }),
    }).catch((error) => {
      this.bundlePromise = null;
      throw error;
    });
    return this.bundlePromise;
  }

  private update(id: string, status: RenderJobRow["status"], progress: number) {
    this.database.db
      .prepare("UPDATE render_jobs SET status = ?, progress = ?, updated_at = ? WHERE id = ?")
      .run(status, Math.max(0, Math.min(1, progress)), new Date().toISOString(), id);
  }

  private complete(id: string, outputPath: string) {
    this.database.db
      .prepare(
        "UPDATE render_jobs SET status = 'completed', progress = 1, output_path = ?, error_code = NULL, updated_at = ? WHERE id = ?",
      )
      .run(outputPath, new Date().toISOString(), id);
  }
}

function safeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "app-demo";
}
