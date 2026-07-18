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

    const client = new ElevenLabsClient({ apiKey: credential });
    
    const audioStream = await client.textToSpeech.convert(settings.tts.voiceId, {
      text: narration,
      modelId: "eleven_multilingual_v2",
      outputFormat: "mp3_44100_128",
    });

    const project = await this.projects.get(projectId);
    if (!project) throw new Error("project_not_found");
    
    const fileName = `${sceneId}.mp3`;
    const targetPath = join(this.projects.projectPath(projectId), "assets", fileName);
    
    await pipeline(audioStream, createWriteStream(targetPath));

    // Import as asset
    return await this.projects.importPath(projectId, targetPath, "audio/mpeg");
  }
}
