#!/usr/bin/env node
/**
 * Stages the render worker runtime for injection into the macOS bundle.
 *
 * Layout produced under runtime/macos/worker (mirrors
 * Contents/Resources/worker inside the .app):
 *   node            — the Node binary used at build time
 *   dist/           — compiled worker (npm --prefix worker run build)
 *   render-src/     — Remotion entry + types copied from frontend/src
 *   node_modules/   — worker production dependencies
 *   package.json    — worker manifest (production deps only)
 */
import { cpSync, copyFileSync, mkdirSync, rmSync, chmodSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerRuntimeDir = join(root, "runtime", "macos", "worker");
const workerTargetDir = join(root, "frontend", "dist", "worker");

if (!existsSync(join(root, "worker", "dist", "server.js"))) {
  console.error("worker/dist/server.js missing — run `npm --prefix worker run build` first.");
  process.exit(1);
}

rmSync(workerRuntimeDir, { recursive: true, force: true });
mkdirSync(workerRuntimeDir, { recursive: true });

// Stage the runtime
copyFileSync(process.execPath, join(workerRuntimeDir, "node"));
chmodSync(join(workerRuntimeDir, "node"), 0o755);
cpSync(join(root, "worker", "dist"), join(workerRuntimeDir, "dist"), { recursive: true });
cpSync(join(root, "frontend", "src", "video"), join(workerRuntimeDir, "render-src"), { recursive: true });
copyFileSync(join(root, "frontend", "src", "types.ts"), join(workerRuntimeDir, "render-src", "types.ts"));
copyFileSync(join(root, "worker", "package.json"), join(workerRuntimeDir, "package.json"));
copyFileSync(join(root, "worker", "package-lock.json"), join(workerRuntimeDir, "package-lock.json"));

execFileSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], {
  cwd: workerRuntimeDir,
  stdio: "inherit",
});

// Inject into frontend assets
if (existsSync(workerTargetDir)) rmSync(workerTargetDir, { recursive: true, force: true });
cpSync(workerRuntimeDir, workerTargetDir, { recursive: true });

console.log(`Staged macOS worker runtime at ${workerRuntimeDir} and ${workerTargetDir}`);
