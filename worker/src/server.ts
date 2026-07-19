import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { ZodError } from "zod";
import { AiService, type StoryboardProposal } from "./ai.js";
import { AnalyticsService } from "./analytics.js";
import { DevelopmentLicenseProvider, NoopUpdateProvider } from "./commercial.js";
import { config } from "./config.js";
import { AppDatabase } from "./db.js";
import { listModels, type ProviderKind } from "./providers.js";
import { ProjectStore } from "./project-store.js";
import { RenderService } from "./render-service.js";
import { TtsService } from "./tts.js";
import {
  appSettingsSchema,
  generationRequestSchema,
  projectSchema,
  renderRequestSchema,
  sceneRegenerationSchema,
} from "./schemas.js";
import { MacKeychainSecretStore } from "./secrets.js";

const database = new AppDatabase();
const projects = new ProjectStore(database);
const secrets = new MacKeychainSecretStore();
const analytics = new AnalyticsService(database);
const ai = new AiService(database, projects, secrets);
const renders = new RenderService(database, projects);
const licenses = new DevelopmentLicenseProvider();
const tts = new TtsService(database, projects, secrets);

const server = createServer(async (request, response) => {
  setCors(request, response);
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  const url = new URL(request.url ?? "/", `http://${config.host}:${config.port}`);
  if (url.pathname === "/health") {
    json(response, 200, { status: "ok", version: "0.1.0" });
    return;
  }
  if (!authorized(request, url)) {
    json(response, 401, { error: "unauthorized" });
    return;
  }

  try {
    await route(request, response, url);
  } catch (error) {
    analytics.captureException(error, `${request.method} ${url.pathname}`);
    if (error instanceof ZodError) {
      console.error("[Zod Validation Error] Detailed validation issues:", JSON.stringify(error.issues, null, 2));
      json(response, 400, { error: "invalid_request", issues: error.issues });
      return;
    }
    const code = error instanceof Error ? error.message : "internal_error";
    const status = code.endsWith("_not_found") ? 404 : 500;
    json(response, status, { error: status === 500 ? "operation_failed" : code });
  }
});

async function route(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === "/v1/settings") {
    json(response, 200, database.getSettings());
    return;
  }
  if (request.method === "PUT" && url.pathname === "/v1/settings") {
    const current = database.getSettings();
    const input = await readJson(request);
    const next = appSettingsSchema.parse({ ...current, ...input, ai: current.ai, tts: current.tts });
    database.setSettings(next);
    json(response, 200, next);
    return;
  }
  if (request.method === "PUT" && url.pathname === "/v1/settings/ai") {
    json(response, 200, await ai.configure((await readJson(request)) as Parameters<typeof ai.configure>[0]));
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/settings/ai/test") {
    json(response, 200, await ai.test());
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/providers/models") {
    const kind = (url.searchParams.get("provider") ?? "local") as ProviderKind;
    if (!["local", "openai", "anthropic", "google", "custom"].includes(kind)) {
      json(response, 400, { error: "unknown_provider" });
      return;
    }
    const settings = database.getSettings();
    const endpoint = url.searchParams.get("endpoint") ?? settings.ai.endpoint;
    const credential =
      url.searchParams.get("credential") || (await secrets.get(`ai:${kind}`));
    json(response, 200, { models: await listModels(kind, credential, endpoint ?? "") });
    return;
  }
  if (request.method === "PUT" && url.pathname === "/v1/settings/tts") {
    const input = (await readJson(request)) as {
      provider: "none" | "elevenlabs";
      voiceId?: string;
      credential?: string;
      speed?: number;
      stability?: number;
      similarityBoost?: number;
    };
    if (input.credential?.trim()) await secrets.set(`tts:${input.provider}`, input.credential.trim());
    const current = database.getSettings();
    const next = appSettingsSchema.parse({
      ...current,
      tts: {
        provider: input.provider,
        voiceId: input.voiceId?.trim() ?? "",
        hasCredential:
          input.provider === "none" || Boolean(await secrets.get(`tts:${input.provider}`)),
        speed: input.speed ?? current.tts.speed ?? 1.0,
        stability: input.stability ?? current.tts.stability ?? 0.75,
        similarityBoost: input.similarityBoost ?? current.tts.similarityBoost ?? 0.75,
      },
    });
    database.setSettings(next);
    json(response, 200, next);
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/projects") {
    json(response, 200, projects.list());
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/projects") {
    const input = await readJson(request);
    const project = await projects.create(
      typeof input.title === "string" ? input.title.slice(0, 160) : undefined,
    );
    analytics.track("project_created");
    json(response, 201, project);
    return;
  }
  if (request.method === "PATCH" && url.pathname.startsWith("/v1/projects/")) {
    const projectId = url.pathname.split("/")[3];
    const input = (await readJson(request)) as { title: string };
    json(response, 200, await projects.rename(projectId, input.title));
    return;
  }
  if (request.method === "DELETE" && url.pathname.startsWith("/v1/projects/")) {
    const projectId = url.pathname.split("/")[3];
    json(response, 200, await projects.delete(projectId));
    return;
  }
  if (request.method === "DELETE" && url.pathname === "/v1/projects") {
    const result = await projects.deleteAll();
    analytics.track("projects_cleared", { count: result.deleted });
    json(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/projects/export") {
    const input = (await readJson(request)) as { projectId?: string; targetPath?: string };
    if (!input.projectId || !input.targetPath) throw new Error("invalid_request");
    json(response, 200, await projects.exportProject(input.projectId, input.targetPath));
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/projects/import") {
    const input = (await readJson(request)) as { sourcePath?: string };
    if (!input.sourcePath) throw new Error("invalid_request");
    json(response, 200, await projects.importProject(input.sourcePath));
    return;
  }

  const projectMatch = url.pathname.match(/^\/v1\/projects\/([0-9a-f-]+)$/i);
  if (projectMatch && request.method === "GET") {
    const project = await projects.get(projectMatch[1]);
    if (!project) throw new Error("project_not_found");
    analytics.track("project_opened");
    json(response, 200, project);
    return;
  }
  if (projectMatch && request.method === "PUT") {
    const project = await projects.save(projectSchema.parse(await readJson(request)));
    json(response, 200, project);
    return;
  }

  const versionsMatch = url.pathname.match(/^\/v1\/projects\/([0-9a-f-]+)\/versions$/i);
  if (versionsMatch && request.method === "GET") {
    json(response, 200, { versions: await projects.listVersions(versionsMatch[1]) });
    return;
  }

  const restoreMatch = url.pathname.match(/^\/v1\/projects\/([0-9a-f-]+)\/versions\/([0-9]+)\/restore$/i);
  if (restoreMatch && request.method === "POST") {
    json(response, 200, await projects.restoreVersion(restoreMatch[1], restoreMatch[2]));
    return;
  }

  const importMatch = url.pathname.match(/^\/v1\/projects\/([0-9a-f-]+)\/assets$/i);
  if (importMatch && request.method === "POST") {
    const name = decodeURIComponent(String(request.headers["x-file-name"] ?? "asset"));
    const mime = String(request.headers["content-type"] ?? "application/octet-stream");
    const size = Number(request.headers["content-length"] ?? 0);
    const result = await projects.importStream(importMatch[1], name, mime, size, request);
    analytics.track("media_imported", { mediaType: result.asset.mediaType });
    json(response, 201, result);
    return;
  }

  const importPathMatch = url.pathname.match(
    /^\/v1\/projects\/([0-9a-f-]+)\/assets\/import-path$/i,
  );
  if (importPathMatch && request.method === "POST") {
    const input = (await readJson(request)) as { path?: string; mimeType?: string };
    if (!input.path) throw new Error("asset_path_required");
    const result = await projects.importPath(
      importPathMatch[1],
      input.path,
      input.mimeType ?? "application/octet-stream",
    );
    analytics.track("media_imported", { mediaType: result.asset.mediaType });
    json(response, 201, result);
    return;
  }

  const assetMatch = url.pathname.match(
    /^\/v1\/projects\/([0-9a-f-]+)\/assets\/([0-9a-f-]+)$/i,
  );
  if (assetMatch && request.method === "GET") {
    const info = await projects.assetInfo(assetMatch[1], assetMatch[2]);
    if (!info) throw new Error("asset_not_found");
    await streamFile(request, response, info.path, info.asset.mimeType);
    return;
  }
  if (assetMatch && request.method === "DELETE") {
    const result = await projects.removeAsset(assetMatch[1], assetMatch[2]);
    analytics.track("media_deleted");
    json(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/generations") {
    const input = generationRequestSchema.parse(await readJson(request));
    analytics.track("generation_requested", {
      provider: database.getSettings().ai.provider,
      operation: input.operation,
      locale: input.locale ?? "source",
    });
    try {
      const proposal = await ai.generate(input);
      analytics.track("generation_completed", {
        provider: proposal.provider,
        operation: proposal.operation,
        locale: proposal.locale,
      });
      json(response, 201, proposal);
    } catch (error) {
      analytics.track("generation_failed", {
        provider: database.getSettings().ai.provider,
        operation: input.operation,
      });
      throw error;
    }
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/generations/scene") {
    const input = sceneRegenerationSchema.parse(await readJson(request));
    const result = await ai.regenerateScene(input.projectId, input.sceneId, input.fields);
    analytics.track("scene_regenerated", { fields: input.fields.join(",") });
    json(response, 200, result);
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/generations/apply") {
    const input = (await readJson(request)) as {
      projectId: string;
      proposal: StoryboardProposal;
    };
    json(response, 200, await ai.apply(input.projectId, input.proposal));
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/renders") {
    const input = renderRequestSchema.parse(await readJson(request));
    analytics.track("render_started", {
      format: input.format,
      preset: input.preset,
      locale: input.locale,
    });
    json(response, 202, renders.start(input));
    return;
  }
  const renderMatch = url.pathname.match(/^\/v1\/renders\/([0-9a-f-]+)$/i);
  if (renderMatch && request.method === "GET") {
    const job = renders.get(renderMatch[1]);
    if (!job) throw new Error("render_not_found");
    json(response, 200, job);
    return;
  }
  if (renderMatch && request.method === "DELETE") {
    json(response, 200, renders.cancel(renderMatch[1]));
    return;
  }
  const projectRenders = url.pathname.match(/^\/v1\/projects\/([0-9a-f-]+)\/renders$/i);
  if (projectRenders && request.method === "GET") {
    json(response, 200, renders.list(projectRenders[1]));
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/analytics/events") {
    const input = (await readJson(request)) as { name?: string; properties?: Record<string, unknown> };
    if (input.name) analytics.track(input.name, input.properties);
    response.writeHead(204).end();
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/license") {
    json(response, 200, await licenses.status());
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/cache-size") {
    try {
      const { readdir, stat } = await import("node:fs/promises");
      let totalSize = 0;
      const getDirSize = async (dir: string) => {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const res = join(dir, entry.name);
          if (entry.isDirectory()) {
            await getDirSize(res);
          } else if (entry.isFile()) {
            const stats = await stat(res);
            totalSize += stats.size;
          }
        }
      };
      await getDirSize(config.dataDir);
      // Format as MB or KB
      const mb = (totalSize / (1024 * 1024)).toFixed(2);
      json(response, 200, {
        sizeString: `${mb} MB`,
        bytes: totalSize,
        dataDir: config.dataDir,
        projectRoot: config.projectRoot,
        outputRoot: config.outputRoot,
      });
    } catch (e: any) {
      json(response, 500, { error: e?.message || "failed_to_calculate_cache_size" });
    }
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/license/activate") {
    const input = (await readJson(request)) as { key?: string };
    json(response, 200, await licenses.activate(input.key ?? ""));
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/tts/generate") {
    const input = (await readJson(request)) as { projectId: string; sceneId: string; narration: string };
    json(response, 201, await tts.generate(input.projectId, input.sceneId, input.narration));
    return;
  }
  if (request.method === "POST" && url.pathname === "/v1/tts/test") {
    await tts.testConnection();
    json(response, 200, { ok: true });
    return;
  }
  if (request.method === "GET" && url.pathname === "/v1/tts/voices") {
    try {
      const voices = await tts.listVoices();
      json(response, 200, { voices });
    } catch (e: any) {
      json(response, 500, { error: e?.message || "failed_to_list_voices" });
    }
    return;
  }

  json(response, 404, { error: "not_found" });
}

function authorized(request: IncomingMessage, url: URL) {
  const header = request.headers["x-app-token"];
  return header === config.token || url.searchParams.get("token") === config.token;
}

function setCors(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  const allowed = origin === config.frontendOrigin || origin === "zero://app" || origin?.startsWith("http://localhost:");
  if (origin && allowed) response.setHeader("access-control-allow-origin", origin);
  response.setHeader("vary", "Origin");
  response.setHeader("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
  response.setHeader(
    "access-control-allow-headers",
    "content-type,content-length,x-app-token,x-file-name,range",
  );
  response.setHeader("access-control-expose-headers", "content-range,accept-ranges,content-length");
}

async function readJson(request: IncomingMessage, maxBytes = 2_000_000) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error("request_too_large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function json(response: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  response.end(payload);
}

async function streamFile(
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  contentType: string,
) {
  const info = await stat(path);
  const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  response.setHeader("content-type", contentType);
  response.setHeader("accept-ranges", "bytes");
  response.setHeader("cache-control", "private, max-age=3600");
  if (!range) {
    response.writeHead(200, { "content-length": info.size });
    createReadStream(path).pipe(response);
    return;
  }
  const start = range[1] ? Number(range[1]) : 0;
  const end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
  if (start > end || start >= info.size) {
    response.writeHead(416, { "content-range": `bytes */${info.size}` }).end();
    return;
  }
  response.writeHead(206, {
    "content-range": `bytes ${start}-${end}/${info.size}`,
    "content-length": end - start + 1,
  });
  createReadStream(path, { start, end }).pipe(response);
}

const flushTimer = setInterval(() => void analytics.flush(), 30_000);
flushTimer.unref();

server.listen(config.port, config.host, () => {
  console.log(`Lumiveo worker listening on http://${config.host}:${config.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    clearInterval(flushTimer);
    server.close(() => {
      database.close();
      process.exit(0);
    });
  });
}
