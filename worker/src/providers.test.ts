import { describe, expect, it } from "vitest";
import {
  isOpenWeights,
  listModels,
  parseAnthropicModelList,
  parseGatewayModelList,
  parseGoogleModelList,
  parseOpenAiModelList,
} from "./providers.js";

describe("model list parsers", () => {
  it("parses OpenAI-shaped lists and keeps chat models only", () => {
    const models = parseOpenAiModelList({
      data: [
        { id: "gpt-5.5" },
        { id: "whisper-1" },
        { id: "o4-mini" },
        { id: "text-embedding-3-large" },
      ],
    });
    expect(models.map((model) => model.id)).toEqual(["gpt-5.5", "o4-mini"]);
    expect(models[0].source).toBe("live");
  });

  it("parses Anthropic lists with display names", () => {
    const models = parseAnthropicModelList({
      data: [{ id: "claude-opus-4-8", display_name: "Claude Opus 4.8" }],
    });
    expect(models[0]).toMatchObject({ id: "claude-opus-4-8", label: "Claude Opus 4.8" });
  });

  it("parses Google lists and strips the models/ prefix", () => {
    const models = parseGoogleModelList({
      models: [
        { name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
        { name: "models/text-embedding-004" },
      ],
    });
    expect(models).toHaveLength(1);
    expect(models[0].id).toBe("gemini-2.5-flash");
  });

  it("flags open-weight gateway models", () => {
    const models = parseGatewayModelList({
      data: [
        { id: "moonshotai/kimi-k2" },
        { id: "anthropic/claude-sonnet-5" },
        { id: "openai/gpt-oss-120b" },
      ],
    });
    expect(models.find((model) => model.id === "moonshotai/kimi-k2")?.openWeights).toBe(true);
    expect(models.find((model) => model.id === "openai/gpt-oss-120b")?.openWeights).toBe(true);
    expect(models.find((model) => model.id === "anthropic/claude-sonnet-5")?.openWeights).toBe(false);
  });
});

describe("listModels fallback", () => {
  it("curated list includes claude models", async () => {
    // Unreachable endpoint forces the curated fallback deterministically.
    const models = await listModels("anthropic", null, "http://127.0.0.1:9/unreachable");
    expect(models.some((model) => model.id.startsWith("claude"))).toBe(true);
  });

  it("falls back to curated lists for unreachable providers", async () => {
    const models = await listModels("openai", "invalid", "http://127.0.0.1:9/unreachable");
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((model) => model.source === "curated")).toBe(true);
  });

  it("marks known open-weight prefixes", () => {
    expect(isOpenWeights("deepseek/deepseek-v3.2")).toBe(true);
    expect(isOpenWeights("alibaba/qwen3-235b-a22b")).toBe(true);
    expect(isOpenWeights("openai/gpt-5.5")).toBe(false);
  });
});
