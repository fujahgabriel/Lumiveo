import type { AppSettings } from "../types";

export const defaultSettings: AppSettings = {
  onboardingComplete: false,
  uiLocale: "en",
  notificationsEnabled: true,
  analyticsEnabled: false,
  analyticsProvider: "none",
  ai: { provider: "local", model: "", endpoint: "", hasCredential: true },
  tts: { provider: "none", voiceId: "", hasCredential: false },
};
