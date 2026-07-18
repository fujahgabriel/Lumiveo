# Lumiveo

A local-first macOS desktop app that turns app screenshots, recordings, GIFs and audio into polished, localised demo videos — with an optional AI storyboard agent and provider-agnostic analytics.

Built with the **Native SDK** (Zig native shell + WKWebView), **Remotion** (programmatic video), and **eve** (durable AI agent framework, isolated behind a provider boundary).

## Architecture

| Layer | Tech | Responsibility |
| --- | --- | --- |
| Native shell | Native SDK (`app.zon`, `src/main.zig`) | Window, security policy, bridge commands, native dialogs, worker lifecycle |
| Editor UI | React + Vite (`frontend/`) | Media library, timeline, inspector, Remotion Player preview, onboarding/settings, localisation |
| Local worker | Node 24 (`worker/`) | HTTP API, SQLite (`node:sqlite`), portable project files, Remotion render jobs, AI/TTS adapters, analytics queue, Keychain secrets |
| AI agent | eve (`agent/`) | Storyboard/localisation turns; shell/file/web tools disabled; rendering never depends on it |

```
frontend (zero://app / :5173)  ──HTTP+token──▶  worker (127.0.0.1:4817)
        ▲ window.zero.invoke                      ├── SQLite (settings, jobs, history, analytics queue)
        └── app.workerInfo / native dialogs ◀── native shell (spawns worker in packaged builds)
```

- **Portable projects** live at `~/Library/Application Support/Lumiveo/Projects/<id>.appdemo/` (`project.json` + `assets/`). SQLite is only the app index — user work survives a database wipe.
- **Secrets** are stored in macOS Keychain (`com.lumiveo.providers`); SQLite keeps only provider config.
- **Analytics** is consent-gated, allowlist-only (key events + sanitized exceptions), queued in SQLite, with PostHog / Firebase / no-op adapters.

## Commands

```sh
npm install && npm --prefix frontend install && npm --prefix worker install

npm run dev          # worker (tsx watch) + native shell with Vite dev server
npm run check        # tsc (frontend + worker) + native check
npm test             # vitest suites
npm run build        # frontend dist + worker dist + native ReleaseFast binary
npm run package:mac  # full .app pipeline (scripts/package-mac.mjs), ad-hoc signed
npm run dev:agent    # optional: eve dev server for live AI storyboards
npm run doctor       # native doctor --manifest app.zon --strict
```

`npm run dev` sets `APP_DEMO_WORKER_EXTERNAL=1` implicitly by running the worker separately; the packaged shell spawns `Contents/Resources/worker` itself and hands the frontend a per-launch token via the `app.workerInfo` bridge command.

## AI providers

Onboarding and Settings list models **live** from each provider's model API (with curated offline fallback):

- **Eve / Vercel AI Gateway** — full catalog incl. open-weight `moonshotai/kimi-k2*`, DeepSeek, Qwen, GLM, MiniMax, Llama, gpt-oss
- **OpenAI, Anthropic, Google** — direct provider APIs
- **Custom (OpenAI-compatible)** — Ollama (`http://127.0.0.1:11434/v1`), LM Studio, OpenRouter, Groq, opencode-style gateways
- **Local draft** — deterministic offline storyboards, no key

Each provider row shows where to copy its API key (platform.openai.com, console.anthropic.com, aistudio.google.com, vercel.com/ai-gateway, elevenlabs.io).

## Exports

MP4 (H.264), animated GIF, or PNG sequence — in 9:16 (1080×1920), 16:9 (1920×1080), or 1:1 (1080×1080), per content locale. Render jobs run in the worker with progress, cancellation, and crash recovery (`render_jobs` ledger in SQLite).

## Distribution

`npm run package:mac` → `zig-out/package/*.app` with the worker runtime injected at `Contents/Resources/worker`, ad-hoc signed. For release: `node scripts/package-mac.mjs --identity "Developer ID Application: …"` and notarize with `xcrun notarytool`. Confirm Remotion's commercial license terms before distribution.
