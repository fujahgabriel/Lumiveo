# AI App Demo Video Generator — Plan

## Goal

Build a **desktop app** that lets users turn imported media (app screenshots, images, audio, video, gif) into polished app demo/promo videos. The app uses an integrated AI agent to assist with scriptwriting, scene ordering, and voiceover, supports **localisation** out of the box, and exports in **multiple frame sizes and formats**.

## Reference

Prior art lives at `clearone-monorepo/apps/mobile/promo-video`. Key patterns to reuse:

- Remotion `Composition` driven by JSON props (`videos.json`) — scene list of `{ src, text, mode }`
- `Scene` component: `AppScreen` (image in a device mockup) + `Title` (animated caption) + optional `Audio`
- Multiple compositions for frame sizes: `TikTokPromo` (1080×1920) and `YouTubeLandscape` (1920×1080)
- ElevenLabs `eleven_multilingual_v2` for voiceover — already multi-language capable
- `scripts/generate-audio.ts` + `scripts/batch-render.ts` (`npx remotion render <comp> --props=...`)

We graduate this from a CLI/script workflow into a real desktop product with a UI, AI assistance, and broader media support.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Desktop App Shell  (vercel-labs/native)     │
│  - window, menus, file import, preview        │
└───────────────┬─────────────────────────────┘
                │ project state (scenes, media, locale, export settings)
┌───────────────┴─────────────────────────────┐
│  Eve AI Agent  (vercel/eve skill)            │
│  - generate script/captions from app context │
│  - suggest scene order, timing, voice/locale │
│  - translate/localise text per locale        │
└───────────────┬─────────────────────────────┘
                │ props
┌───────────────┴─────────────────────────────┐
│  Remotion Render Layer                       │
│  - compositions per frame size               │
│  - audio + video + gif + image sequencing    │
│  - export MP4 / GIF / frames                 │
└─────────────────────────────────────────────┘
```

## Stack

| Layer        | Choice                                            |
|--------------|---------------------------------------------------|
| Video        | **Remotion** (React programmatic video)           |
| AI agent     | **`npx skills add vercel/eve`** (Eve, Vercel)     |
| Desktop UI   | **`npx skills add vercel-labs/native`**            |
| Voiceover    | ElevenLabs `eleven_multilingual_v2` (reuse)       |
| Database     | **SQLite** for app state, jobs, settings and event queue |
| Analytics    | Provider adapter: PostHog, Firebase or no-op       |
| Styling      | Tailwind v4 (`@remotion/tailwind-v4`, reuse)      |

## Features

### 1. Media import & management
- Import **images/screenshots, audio, video, gif** into a project
- Per-scene media binding (drag-and-drop ordering)
- Local media storage under project dir (reuse `public/` static-file pattern)

### 2. AI-assisted authoring (Eve)
- From a short app description + imported screenshots → generate scene-by-scene script/captions
- Suggest timing, transitions, light/dark `mode` per scene
- Pick voice and propose per-locale variants

### 3. Localisation
- Per-locale text tracks (`videos.json` already does `en`, `zh`)
- Eve translates/generates locale variants; ElevenLabs renders per-locale voiceover
- Same scene media, different narration/audio per locale

### 4. Multi-frame & multi-format export
- **Frames:** vertical (1080×1920), landscape (1920×1080), square (1080×1080) — compositions per size (reuse pattern)
- **Formats:** MP4 (H.264), GIF (for short clips), image-sequence/frames where useful
- Batch export across locales × frame sizes (reuse `batch-render.ts`)

### 5. AI provider onboarding & settings
- On first launch, let users choose and configure their AI provider; onboarding can be skipped
- Use a provider-neutral AI interface for vision, scripting, translation and regeneration
- Allow provider/model changes later in Settings and record the provider/model used for each generation
- Validate credentials with a lightweight connection test before saving
- Store API keys in macOS Keychain; SQLite stores only provider configuration and Keychain references
- Keep TTS configuration separate because users may choose different providers for text generation and voiceover

### 6. Analytics & exception reporting
- Define a small internal client: `track(event, properties)`, `captureException(error, context)` and `setEnabled(enabled)`
- Implement PostHog, Firebase and no-op adapters without exposing provider SDKs to feature code
- Track only an explicit allowlist of product events: onboarding completed, project created/opened, media imported by type, generation requested/completed/failed, render started/completed/failed/cancelled, locale added and app updated
- Never collect prompts, generated scripts, media, file paths, project names, API keys or voiceover content
- Queue events locally in SQLite and flush asynchronously; analytics must never block launch, editing or rendering
- Provide a clear onboarding choice and Settings toggle, with analytics disabled when consent is not granted
- Attach only bounded technical context to exceptions: app version, macOS version, operation, provider name and sanitized error code

### 7. SQLite persistence
- Use SQLite for preferences, recent projects, provider configuration, render jobs, generation history, schema migrations and the pending analytics queue
- Keep imported media and rendered files on disk rather than as database blobs
- Keep projects portable through a versioned project manifest plus an assets directory; SQLite is the local app index, not the sole copy of project data
- Enable foreign keys and transactions; use WAL mode where supported and run migrations before opening the main window

## Milestones

1. **Scaffold** — init repo, add Remotion + `@remotion/tailwind-v4`, add `vercel/eve` and `vercel-labs/native` skills
2. **Desktop shell** — window, project open/save, media import UI (images/audio/video/gif)
3. **Remotion core** — `Scene`/`Composition` supporting image, video, and gif sources (extend `AppScreen` beyond `Img`)
4. **Frame variants** — vertical / landscape / square compositions + export settings UI
5. **Persistence** — SQLite schema/migrations, portable project format, autosave and recovery
6. **AI onboarding** — provider adapter, first-launch selection, Keychain credentials and connection testing
7. **Eve integration** — script generation, scene suggestions, localisation and non-destructive regeneration
8. **Voiceover pipeline** — selectable TTS provider with ElevenLabs per-scene/per-locale audio first
9. **Batch export** — locale × frame-size export (reuse `batch-render.ts`) + progress UI
10. **Production services** — provider-agnostic analytics, exception capture, licensing and signed updates
11. **Polish** — launch experience, micro-interactions, transitions, accessibility, captions and templates

## Desktop UI — Native SDK (vercel-labs/native)

Target platform is **macOS**. `vercel-labs/native` is the **Native SDK**, not Electron/Tauri/Capacitor. It builds genuinely native macOS apps from declarative `.native` markup views driven by a typed `Model`/`Msg`/`update` loop (the `UiApp` loop), with a JavaScript bridge to the frontend/webview and permissions/windows/dialogs primitives. Agent guidance is delivered as skills (`npx skills add vercel-labs/native`, then `native skills get native-ui` etc.) so the agent reads version-matched docs from the installed CLI.

Implications for this app:
- UI shell (windows, media file dialogs, preview surface, export settings) authored in `.native` views + a TypeScript/JS app core
- The Remotion render layer still runs via Node (`npx remotion render` / bundled server); the Native app core shells out to or embeds that process and surfaces progress through the JS bridge
- Verify the running window with `native automate` (snapshots, readiness waits, assertions, bridge round-trips)
- `native init` does not copy skills — deliver `native-ui`/`core` explicitly into the agent skills dir

## Open Questions

- Is Eve used at author time only, or also to orchestrate the full render pipeline?
- Should the Remotion render run as a spawned child process from the Native app core, or a bundled/local server the UI talks to?
- Preferred default locales / voice IDs for first release?
- Offline vs cloud rendering (Remotion Lambda) for export?
- Which AI and TTS providers ship in the first release, beyond the provider-neutral interfaces?
