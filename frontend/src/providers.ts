import type { AppSettings } from "./types";

export type ProviderKind = AppSettings["ai"]["provider"];

export interface ProviderMeta {
  label: string;
  tagline: string;
  /** Console page where the user creates/copies an API key. */
  keyUrl?: string;
  keyLabel?: string;
  needsKey: boolean;
  keyOptional?: boolean;
  needsEndpoint?: boolean;
  endpointPlaceholder?: string;
  modelPlaceholder: string;
  note?: string;
}

export const providerMeta: Record<ProviderKind, ProviderMeta> = {
  local: {
    label: "Local draft",
    tagline: "No key required",
    needsKey: false,
    modelPlaceholder: "Deterministic offline drafts",
  },
  openai: {
    label: "OpenAI",
    tagline: "Bring your own key",
    keyUrl: "https://platform.openai.com/api-keys",
    keyLabel: "platform.openai.com/api-keys",
    needsKey: true,
    modelPlaceholder: "gpt-5.5",
  },
  anthropic: {
    label: "Anthropic",
    tagline: "Bring your own key",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyLabel: "console.anthropic.com/settings/keys",
    needsKey: true,
    modelPlaceholder: "claude-opus-4-8",
  },
  google: {
    label: "Google",
    tagline: "Bring your own key",
    keyUrl: "https://aistudio.google.com/apikey",
    keyLabel: "aistudio.google.com/apikey",
    needsKey: true,
    modelPlaceholder: "gemini-2.5-flash",
  },
  custom: {
    label: "Custom endpoint",
    tagline: "Any OpenAI-compatible API",
    needsKey: true,
    keyOptional: true,
    needsEndpoint: true,
    endpointPlaceholder: "http://127.0.0.1:11434/v1",
    modelPlaceholder: "Model id served by your endpoint",
    note: "Works with Ollama, LM Studio, OpenRouter, Groq, Together, or opencode-style gateways.",
  },
};

export const ttsKeyUrl = "https://elevenlabs.io/app/settings/api-keys";

export const providerOrder: ProviderKind[] = [
  "local",
  "openai",
  "anthropic",
  "google",
  "custom",
];
