import { Client } from "eve/client";
import { z } from "zod";
import type { AppDatabase } from "./db.js";
import type { ProjectStore } from "./project-store.js";
import type { SecretStore } from "./secrets.js";
import type { GenerationRequest, Project } from "./schemas.js";

const proposedSceneSchema = z.object({
  sourceSceneId: z.string().nullable(),
  assetId: z.string().nullable(),
  name: z.string().min(1).max(120),
  caption: z.string().min(1).max(500),
  narration: z.string().min(1).max(2_000),
  durationSeconds: z.number().min(1).max(60),
  layout: z.enum(["device", "full", "split"]),
  transition: z.enum(["none", "fade", "slide", "scale"]),
});

const storyboardSchema = z.object({
  summary: z.string().max(500),
  scenes: z.array(proposedSceneSchema).min(1).max(40),
});

export type StoryboardProposal = z.infer<typeof storyboardSchema> & {
  id: string;
  provider: string;
  model: string;
  locale: string;
  operation: GenerationRequest["operation"];
};

interface AiProvider {
  generate(project: Project, request: GenerationRequest): Promise<z.infer<typeof storyboardSchema>>;
  test(): Promise<void>;
}

export class AiService {
  constructor(
    private readonly database: AppDatabase,
    private readonly projects: ProjectStore,
    private readonly secrets: SecretStore,
  ) {}

  async configure(input: {
    provider: "local" | "eve" | "openai" | "anthropic" | "google";
    model: string;
    endpoint: string;
    credential?: string;
  }) {
    const settings = this.database.getSettings();
    const account = `ai:${input.provider}`;
    if (input.credential?.trim()) await this.secrets.set(account, input.credential.trim());
    const hasCredential = input.provider === "local" || Boolean(await this.secrets.get(account));
    const updated = {
      ...settings,
      ai: {
        provider: input.provider,
        model: input.model.trim(),
        endpoint: input.endpoint.trim(),
        hasCredential,
      },
    };
    this.database.setSettings(updated);
    return updated;
  }

  async test() {
    const settings = this.database.getSettings();
    const provider = await this.provider(settings.ai.provider);
    await provider.test();
    return { ok: true };
  }

  async generate(request: GenerationRequest): Promise<StoryboardProposal> {
    const project = await this.projects.get(request.projectId);
    if (!project) throw new Error("project_not_found");
    const settings = this.database.getSettings();
    const provider = await this.provider(settings.ai.provider);
    const result = storyboardSchema.parse(await provider.generate(project, request));
    const proposal: StoryboardProposal = {
      ...result,
      id: crypto.randomUUID(),
      provider: settings.ai.provider,
      model: settings.ai.model || "deterministic-local",
      locale: request.locale ?? project.sourceLocale,
      operation: request.operation,
    };
    this.database.db
      .prepare(
        `INSERT INTO generation_history
         (id, project_id, provider, model, operation, locale, scene_ids_json, accepted, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      )
      .run(
        proposal.id,
        project.id,
        proposal.provider,
        proposal.model,
        proposal.operation,
        proposal.locale,
        JSON.stringify(proposal.scenes.map((scene) => scene.sourceSceneId).filter(Boolean)),
        new Date().toISOString(),
      );
    return proposal;
  }

  async apply(projectId: string, proposal: StoryboardProposal) {
    const parsed = storyboardSchema.parse(proposal);
    const project = await this.projects.get(projectId);
    if (!project) throw new Error("project_not_found");
    const locale = proposal.locale;
    let scenes: Project["scenes"];
    if (proposal.operation === "translation") {
      const bySource = new Map(
        parsed.scenes.filter((scene) => scene.sourceSceneId).map((scene) => [scene.sourceSceneId, scene]),
      );
      scenes = project.scenes.map((scene) => {
        const translated = bySource.get(scene.id);
        if (!translated) return scene;
        return {
          ...scene,
          copy: {
            ...scene.copy,
            [locale]: {
              caption: translated.caption,
              narration: translated.narration,
              manuallyEdited: false,
              stale: false,
            },
          },
        };
      });
    } else {
      scenes = parsed.scenes.map((scene, index) => ({
        id: scene.sourceSceneId ?? crypto.randomUUID(),
        name: scene.name,
        assetId: scene.assetId,
        durationInFrames: Math.round(scene.durationSeconds * project.fps),
        transition: scene.transition,
        layout: scene.layout,
        background: project.scenes[index]?.background ?? "#171714",
        accent: project.scenes[index]?.accent ?? "#e6ff5c",
        copy: {
          [locale]: {
            caption: scene.caption,
            narration: scene.narration,
            manuallyEdited: false,
            stale: false,
          },
        },
      }));
    }
    const locales = project.locales.some((entry) => entry.code === locale)
      ? project.locales
      : [...project.locales, { code: locale, label: locale, direction: isRtl(locale) ? "rtl" : "ltr" as const }];
    const saved = await this.projects.save({ ...project, scenes, locales, activeLocale: locale });
    this.database.db
      .prepare("UPDATE generation_history SET accepted = 1 WHERE id = ? AND project_id = ?")
      .run(proposal.id, projectId);
    return saved;
  }

  private async provider(kind: "local" | "eve" | "openai" | "anthropic" | "google" | "custom") {
    const settings = this.database.getSettings().ai;
    const credential = await this.secrets.get(`ai:${kind}`);
    if (kind === "eve") return new EveProvider(settings.endpoint || "http://127.0.0.1:2000");
    if (kind === "custom") {
      return new JsonApiProvider(
        "openai",
        settings.model || "default",
        credential,
        settings.endpoint,
        true,
      );
    }
    if (kind === "openai") {
      return new JsonApiProvider("openai", settings.model || "gpt-5-mini", credential, settings.endpoint);
    }
    if (kind === "anthropic") {
      return new JsonApiProvider(
        "anthropic",
        settings.model || "claude-sonnet-4-5",
        credential,
        settings.endpoint,
      );
    }
    if (kind === "google") {
      return new JsonApiProvider("google", settings.model || "gemini-2.5-flash", credential, settings.endpoint);
    }
    return new LocalProvider();
  }
}

class LocalProvider implements AiProvider {
  async test() {}

  async generate(project: Project, request: GenerationRequest) {
    const locale = request.locale ?? project.sourceLocale;
    if (request.operation === "translation") {
      return {
        summary: `Drafted a ${locale} content track. Connect an AI provider for translated copy.`,
        scenes: project.scenes.map((scene) => ({
          sourceSceneId: scene.id,
          assetId: scene.assetId,
          name: scene.name,
          caption: scene.copy[project.sourceLocale]?.caption ?? scene.name,
          narration: scene.copy[project.sourceLocale]?.narration ?? scene.name,
          durationSeconds: scene.durationInFrames / project.fps,
          layout: scene.layout,
          transition: scene.transition,
        })),
      };
    }
    const assets = project.assets.filter((asset) => asset.mediaType !== "audio");
    const source = assets.length > 0 ? assets : [{ id: null, name: project.productName || "Your app" }];
    return {
      summary: "Created a deterministic first draft from the imported media.",
      scenes: source.map((asset, index) => ({
        sourceSceneId: project.scenes[index]?.id ?? null,
        assetId: asset.id,
        name: index === 0 ? "Opening" : `Feature ${index + 1}`,
        caption:
          index === 0
            ? `${project.productName || "Your app"}, shown clearly.`
            : `Show what matters in ${asset.name.replace(/\.[^.]+$/, "")}.`,
        narration:
          index === 0
            ? project.productDescription || "Introduce the product and the outcome it creates."
            : `Walk through ${asset.name.replace(/\.[^.]+$/, "")} and explain the user benefit.`,
        durationSeconds: 3,
        layout: "device" as const,
        transition: "fade" as const,
      })),
    };
  }
}

class EveProvider implements AiProvider {
  constructor(private readonly endpoint: string) {}

  async test() {
    await new Client({ host: this.endpoint }).health();
  }

  async generate(project: Project, request: GenerationRequest) {
    const client = new Client({ host: this.endpoint, redirect: "error" });
    const response = await client.session().send<z.infer<typeof storyboardSchema>>({
      message: promptFor(project, request),
      outputSchema: storyboardSchema,
    });
    const result = await response.result();
    if (result.status === "failed" || !result.data) throw new Error("eve_generation_failed");
    return storyboardSchema.parse(result.data);
  }
}

class JsonApiProvider implements AiProvider {
  constructor(
    private readonly kind: "openai" | "anthropic" | "google",
    private readonly model: string,
    private readonly credential: string | null,
    private readonly endpoint: string,
    private readonly optionalCredential = false,
  ) {}

  async test() {
    if (!this.credential && !this.optionalCredential) {
      throw new Error("missing_provider_credential");
    }
    const response = await fetch(this.testUrl(), { headers: this.headers() });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
  }

  async generate(project: Project, request: GenerationRequest) {
    if (!this.credential && !this.optionalCredential) {
      throw new Error("missing_provider_credential");
    }
    const prompt = `${promptFor(project, request)}\nReturn JSON only, matching this shape: ${JSON.stringify(jsonShape)}.`;
    const response = await fetch(this.generateUrl(), {
      method: "POST",
      headers: { ...this.headers(), "content-type": "application/json" },
      body: JSON.stringify(this.body(prompt)),
    });
    if (!response.ok) throw new Error(`provider_http_${response.status}`);
    const payload = (await response.json()) as Record<string, unknown>;
    return storyboardSchema.parse(parseJson(extractText(this.kind, payload)));
  }

  private testUrl() {
    if (this.kind === "google") {
      return `${this.base()}/v1beta/models?key=${encodeURIComponent(this.credential ?? "")}`;
    }
    return `${this.base()}/v1/models`;
  }

  private generateUrl() {
    if (this.kind === "openai") return `${this.base()}/v1/responses`;
    if (this.kind === "anthropic") return `${this.base()}/v1/messages`;
    return `${this.base()}/v1beta/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.credential ?? "")}`;
  }

  private base() {
    if (this.endpoint) return this.endpoint.replace(/\/$/, "");
    if (this.kind === "openai") return "https://api.openai.com";
    if (this.kind === "anthropic") return "https://api.anthropic.com";
    return "https://generativelanguage.googleapis.com";
  }

  private headers() {
    if (this.kind === "openai") {
      return this.credential ? { authorization: `Bearer ${this.credential}` } : {};
    }
    if (this.kind === "anthropic") {
      return { "x-api-key": this.credential ?? "", "anthropic-version": "2023-06-01" };
    }
    return {};
  }

  private body(prompt: string) {
    if (this.kind === "openai") {
      return { model: this.model, input: prompt };
    }
    if (this.kind === "anthropic") {
      return { model: this.model, max_tokens: 4_096, messages: [{ role: "user", content: prompt }] };
    }
    return { contents: [{ parts: [{ text: prompt }] }] };
  }
}

const jsonShape = {
  summary: "string",
  scenes: [
    {
      sourceSceneId: "string|null",
      assetId: "string|null",
      name: "string",
      caption: "string",
      narration: "string",
      durationSeconds: "number 1-60",
      layout: "device|full|split",
      transition: "none|fade|slide|scale",
    },
  ],
};

function promptFor(project: Project, request: GenerationRequest) {
  const locale = request.locale ?? project.sourceLocale;
  return [
    `Operation: ${request.operation}`,
    `Target locale: ${locale}`,
    `Product: ${project.productName || project.title}`,
    `Description: ${project.productDescription || "Not provided"}`,
    `Assets: ${JSON.stringify(project.assets.map(({ id, name, mediaType }) => ({ id, name, mediaType })))}`,
    `Current scenes: ${JSON.stringify(
      project.scenes.map((scene) => ({
        id: scene.id,
        assetId: scene.assetId,
        caption: scene.copy[project.sourceLocale]?.caption,
        narration: scene.copy[project.sourceLocale]?.narration,
      })),
    )}`,
    "Keep claims grounded in supplied content. Preserve every supplied asset ID exactly or use null.",
  ].join("\n");
}

function extractText(kind: "openai" | "anthropic" | "google", payload: Record<string, unknown>) {
  if (kind === "openai") {
    const output = payload.output as Array<{ content?: Array<{ text?: string }> }> | undefined;
    return output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
  }
  if (kind === "anthropic") {
    const content = payload.content as Array<{ text?: string }> | undefined;
    return content?.map((item) => item.text ?? "").join("") ?? "";
  }
  const candidates = payload.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  return candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}

function parseJson(text: string) {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(normalized);
}

function isRtl(locale: string) {
  return /^(ar|fa|he|ur)(-|$)/i.test(locale);
}
