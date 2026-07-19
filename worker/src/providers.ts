/**
 * Provider model registry. Lists models live from each provider's public
 * model-list API when a credential/endpoint is available, and falls back to a
 * curated list otherwise. Curated gateway entries are approximations — the
 * live catalog response always wins.
 */

export type ProviderKind = "local" | "openai" | "anthropic" | "google" | "custom";

export interface ProviderModel {
  id: string;
  label: string;
  openWeights: boolean;
  source: "live" | "curated";
}

const OPEN_WEIGHT_PREFIXES = [
  "moonshotai/",
  "deepseek/",
  "meta/",
  "alibaba/",
  "zai/",
  "minimax/",
  "mistral/",
  "xiaomi/",
  "openai/gpt-oss",
  "google/gemma",
];

export function isOpenWeights(id: string) {
  return OPEN_WEIGHT_PREFIXES.some((prefix) => id.startsWith(prefix));
}

const curated: Record<Exclude<ProviderKind, "local" | "custom">, ProviderModel[]> = {
  openai: ["gpt-5.5", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini", "o4-mini"].map(curate),
  anthropic: ["claude-opus-4-8", "claude-sonnet-4-5", "claude-haiku-4-5"].map(curate),
  google: ["gemini-3-pro", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"].map(curate),
};

function curate(id: string): ProviderModel {
  return { id, label: id, openWeights: isOpenWeights(id), source: "curated" };
}

function live(id: string, label?: string): ProviderModel {
  return { id, label: label?.trim() || id, openWeights: isOpenWeights(id), source: "live" };
}

export function parseOpenAiModelList(payload: unknown): ProviderModel[] {
  const data = (payload as { data?: Array<{ id?: string }> }).data ?? [];
  return data
    .map((entry) => entry.id ?? "")
    .filter((id) => /^(gpt|o\d|chatgpt)/i.test(id))
    .sort()
    .map((id) => live(id));
}

export function parseAnthropicModelList(payload: unknown): ProviderModel[] {
  const data = (payload as { data?: Array<{ id?: string; display_name?: string }> }).data ?? [];
  return data
    .filter((entry) => entry.id)
    .map((entry) => live(entry.id!, entry.display_name))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function parseGoogleModelList(payload: unknown): ProviderModel[] {
  const models = (payload as { models?: Array<{ name?: string; displayName?: string }> }).models ?? [];
  return models
    .map((entry) => ({
      id: (entry.name ?? "").replace(/^models\//, ""),
      label: entry.displayName,
    }))
    .filter((entry) => entry.id.includes("gemini"))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => live(entry.id, entry.label));
}

export function parseGatewayModelList(payload: unknown): ProviderModel[] {
  const data = (payload as { data?: Array<{ id?: string; name?: string }> }).data ?? [];
  return data
    .filter((entry) => entry.id)
    .map((entry) => live(entry.id!, entry.name))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function listModels(
  kind: ProviderKind,
  credential: string | null,
  endpoint: string,
): Promise<ProviderModel[]> {
  if (kind === "local") return [curate("deterministic-local")];
  try {
    const models = await fetchLive(kind, credential, endpoint);
    if (models.length > 0) return models;
  } catch {
    // Fall through to curated defaults: listing must never block onboarding.
  }
  if (kind === "custom") return [];
  return curated[kind];
}

async function fetchLive(
  kind: ProviderKind,
  credential: string | null,
  endpoint: string,
): Promise<ProviderModel[]> {
  const signal = AbortSignal.timeout(8_000);
  if (kind === "openai") {
    const response = await fetch(`${base(endpoint, "https://api.openai.com")}/v1/models`, {
      headers: { authorization: `Bearer ${credential}` },
      signal,
    });
    return parseOpenAiModelList(await okJson(response));
  }
  if (kind === "anthropic") {
    const response = await fetch(`${base(endpoint, "https://api.anthropic.com")}/v1/models`, {
      headers: { "x-api-key": credential ?? "", "anthropic-version": "2023-06-01" },
      signal,
    });
    return parseAnthropicModelList(await okJson(response));
  }
  if (kind === "google") {
    const url = `${base(endpoint, "https://generativelanguage.googleapis.com")}/v1beta/models?key=${encodeURIComponent(credential ?? "")}`;
    return parseGoogleModelList(await okJson(await fetch(url, { signal })));
  }
  // custom: any OpenAI-compatible endpoint (OpenRouter, Groq, opencode-style
  // gateways, Ollama at http://127.0.0.1:11434/v1, LM Studio, ...).
  const root = endpoint.replace(/\/$/, "");
  const url = root.endsWith("/models") ? root : `${root}/models`;
  const response = await fetch(url, {
    headers: credential ? { authorization: `Bearer ${credential}` } : {},
    signal,
  });
  return parseGatewayModelList(await okJson(response));
}

function base(endpoint: string, fallback: string) {
  return (endpoint || fallback).replace(/\/$/, "");
}

async function okJson(response: Response) {
  if (!response.ok) throw new Error(`models_http_${response.status}`);
  return response.json();
}
