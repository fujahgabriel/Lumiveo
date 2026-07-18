import type {
  AppSettings,
  ExportFormat,
  ExportPreset,
  Project,
  ProjectListItem,
  RenderJob,
  StoryboardProposal,
} from "./types";

export let workerUrl = import.meta.env.VITE_WORKER_URL ?? "http://127.0.0.1:4817";
export let workerToken = import.meta.env.VITE_WORKER_TOKEN ?? "dev-local";

/**
 * Packaged builds discover the worker endpoint from the native shell, which
 * generates a per-launch token. Dev builds fall back to Vite env/defaults.
 */
export async function resolveWorkerEndpoint() {
  const bridge = window.zero;
  if (!bridge) {
    console.log("resolveWorkerEndpoint: bridge window.zero is unavailable. Keeping default values:", workerUrl, workerToken);
    return;
  }
  // In development, the concurrently-spawned local dev worker uses "dev-local".
  // The native bridge window.zero reports a newly-generated token, but that token
  // is only valid for the production bundled-worker spawned by main.zig.
  // In dev environments, we force workerToken to match the dev worker: "dev-local".
  if (import.meta.env.DEV) {
    console.log("resolveWorkerEndpoint: DEV mode detected. Keeping local dev token:", workerToken);
    return;
  }
  try {
    const info = (await bridge.invoke("app.workerInfo", {})) as {
      url?: string;
      token?: string;
    };
    console.log("resolveWorkerEndpoint: bridge returned", info);
    if (info?.url && info?.token) {
      workerUrl = info.url;
      workerToken = info.token;
    }
  } catch (err) {
    console.error("resolveWorkerEndpoint: bridge invocation failed", err);
    // Bridge unavailable or command rejected: keep development defaults.
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const targetUrl = `${workerUrl}${path}`;
  console.log(`[API Request] Fetching: ${targetUrl} (method: ${init?.method ?? 'GET'})`);
  try {
    const response = await fetch(targetUrl, {
      ...init,
      headers: {
        "x-app-token": workerToken,
        ...(init?.body && !(init.body instanceof Blob) ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    console.log(`[API Response] Received status ${response.status} from ${targetUrl}`);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      const errMessage = body.error ?? `request_failed_${response.status}`;
      console.error(`[API Error] Request failed on ${targetUrl}:`, errMessage);
      throw new Error(errMessage);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  } catch (err) {
    console.error(`[API Network Error] Connection to ${targetUrl} failed:`, err);
    throw err;
  }
}

export const api = {
  health: () => request<{ status: string; version: string }>("/health"),
  settings: () => request<AppSettings>("/v1/settings"),
  saveSettings: (settings: AppSettings) =>
    request<AppSettings>("/v1/settings", { method: "PUT", body: JSON.stringify(settings) }),
  configureAi: (input: {
    provider: AppSettings["ai"]["provider"];
    model: string;
    endpoint: string;
    credential?: string;
  }) => request<AppSettings>("/v1/settings/ai", { method: "PUT", body: JSON.stringify(input) }),
  generateVoiceover: (projectId: string, sceneId: string, narration: string) =>
    request<{ asset: any }>("/v1/tts/generate", {
      method: "POST",
      body: JSON.stringify({ projectId, sceneId, narration }),
    }),
  listModels: (provider: string, options?: { endpoint?: string; credential?: string }) => {
    const params = new URLSearchParams({ provider });
    if (options?.endpoint) params.set("endpoint", options.endpoint);
    if (options?.credential) params.set("credential", options.credential);
    return request<{
      models: Array<{ id: string; label: string; openWeights: boolean; source: "live" | "curated" }>;
    }>(`/v1/providers/models?${params}`);
  },
  configureTts: (input: {
    provider: AppSettings["tts"]["provider"];
    voiceId: string;
    credential?: string;
  }) => request<AppSettings>("/v1/settings/tts", { method: "PUT", body: JSON.stringify(input) }),
  projects: () => request<ProjectListItem[]>("/v1/projects"),
  createProject: (title?: string) =>
    request<Project>("/v1/projects", { method: "POST", body: JSON.stringify({ title }) }),
  project: (id: string) => request<Project>(`/v1/projects/${id}`),
  saveProject: (project: Project) =>
    request<Project>(`/v1/projects/${project.id}`, {
      method: "PUT",
      body: JSON.stringify(project),
    }),
  importFile: async (projectId: string, file: File) => {
    const response = await fetch(`${workerUrl}/v1/projects/${projectId}/assets`, {
      method: "POST",
      headers: {
        "x-app-token": workerToken,
        "x-file-name": encodeURIComponent(file.name),
        "content-type": file.type || "application/octet-stream",
        "content-length": String(file.size),
      },
      body: file,
    });
    if (!response.ok) throw new Error("media_import_failed");
    return response.json() as Promise<{ project: Project }>;
  },
  importPath: (projectId: string, path: string, mimeType: string) =>
    request<{ project: Project }>(`/v1/projects/${projectId}/assets/import-path`, {
      method: "POST",
      body: JSON.stringify({ path, mimeType }),
    }),
  generate: (input: {
    projectId: string;
    operation: "storyboard" | "translation";
    locale?: string;
  }) =>
    request<StoryboardProposal>("/v1/generations", {
      method: "POST",
      body: JSON.stringify({ ...input, regenerateSceneIds: [] }),
    }),
  applyProposal: (projectId: string, proposal: StoryboardProposal) =>
    request<Project>("/v1/generations/apply", {
      method: "POST",
      body: JSON.stringify({ projectId, proposal }),
    }),
  startRender: (input: {
    projectId: string;
    locale: string;
    preset: ExportPreset;
    format: ExportFormat;
  }) => request<RenderJob>("/v1/renders", { method: "POST", body: JSON.stringify(input) }),
  render: (id: string) => request<RenderJob>(`/v1/renders/${id}`),
  cancelRender: (id: string) => request<RenderJob>(`/v1/renders/${id}`, { method: "DELETE" }),
  track: (name: string, properties?: Record<string, unknown>) =>
    request<void>("/v1/analytics/events", {
      method: "POST",
      body: JSON.stringify({ name, properties }),
    }).catch(() => undefined),
};

export function assetUrl(projectId: string, assetId: string) {
  return `${workerUrl}/v1/projects/${projectId}/assets/${assetId}?token=${encodeURIComponent(workerToken)}`;
}
