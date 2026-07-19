import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { AppDatabase } from "./db.js";
import type { ProjectStore } from "./project-store.js";
import type { SecretStore } from "./secrets.js";

export class TtsService {
  constructor(
    private readonly database: AppDatabase,
    private readonly projects: ProjectStore,
    private readonly secrets: SecretStore,
  ) {}

  async generate(projectId: string, sceneId: string, narration: string) {
    const settings = this.database.getSettings();
    if (settings.tts.provider !== "elevenlabs") throw new Error("tts_not_configured");
    
    const credential = await this.secrets.get("tts:elevenlabs");
    if (!credential) throw new Error("missing_tts_credential");

    const project = await this.projects.get(projectId);
    if (!project) throw new Error("project_not_found");

    const scene = project.scenes.find((s) => s.id === sceneId);
    const activeVoiceId = (scene as any)?.voiceId || settings.tts.voiceId;
    if (!activeVoiceId) throw new Error("missing_tts_voice_id");

    const client = new ElevenLabsClient({ apiKey: credential });
    
    const audioStream = await client.textToSpeech.convert(activeVoiceId, {
      text: narration,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
      voiceSettings: {
        stability: settings.tts.stability ?? 0.75,
        similarityBoost: settings.tts.similarityBoost ?? 0.75,
        speed: settings.tts.speed ?? 1.0,
      } as any,
    });
    
    const fileName = `voiceover-${sceneId}.mp3`;
    const targetPath = join(this.projects.projectPath(projectId), "assets", fileName);
    
    await pipeline(audioStream, createWriteStream(targetPath));
    
    // Import as asset
    return await this.projects.importPath(projectId, targetPath, "audio/mpeg");
  }

  async listVoices() {
    const credential = await this.secrets.get("tts:elevenlabs");
    if (!credential) throw new Error("missing_tts_credential");

    const client = new ElevenLabsClient({ apiKey: credential });
    const response = await client.voices.getAll();
    return response.voices.map((v) => ({
      id: v.voiceId,
      name: v.name,
      category: v.category,
      previewUrl: v.previewUrl,
    }));
  }

  async testConnection() {
    const settings = this.database.getSettings();
    if (settings.tts.provider !== "elevenlabs") throw new Error("tts_not_configured");
    
    const credential = await this.secrets.get("tts:elevenlabs");
    if (!credential) throw new Error("missing_tts_credential");

    const client = new ElevenLabsClient({ apiKey: credential });
    
    // Attempt a lightweight request to verify the key
    await client.voices.getAll();
  }
}
