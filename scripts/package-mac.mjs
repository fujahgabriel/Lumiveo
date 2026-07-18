#!/usr/bin/env node
/**
 * Full macOS package pipeline:
 *   1. build frontend assets and worker
 *   2. stage the worker runtime (scripts/prepare-macos-runtime.mjs)
 *   3. build + package the native shell (unsigned)
 *   4. inject the worker runtime into Contents/Resources/worker
 *   5. ad-hoc re-sign the bundle (use --identity "Developer ID ..." for release)
 */
import { cpSync, existsSync, globSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const identity = process.argv.find((arg, i) => process.argv[i - 1] === "--identity");

const run = (cmd, args, options = {}) =>
  execFileSync(cmd, args, { cwd: root, stdio: "inherit", ...options });

run("npm", ["--prefix", "frontend", "run", "build"]);
run("npm", ["--prefix", "worker", "run", "build"]);
run("node", ["scripts/prepare-macos-runtime.mjs"]);
run("npx", ["native", "build", ".", "--yes"]);

const packaged = globSync(join(root, "zig-out", "package", "*.app")).sort().pop();
if (!packaged) {
  console.error("No .app produced by `native package`.");
  process.exit(1);
}

// Runtime already injected into frontend/dist/worker/ (which is part of the package assets)
const signArgs = identity
  ? ["--force", "--deep", "--sign", identity, packaged]
  : ["--force", "--deep", "--sign", "-", packaged];
run("codesign", signArgs);

console.log(`Packaged: ${packaged}`);
if (!identity) {
  console.log("Ad-hoc signed. For distribution, rerun with --identity \"Developer ID Application: …\" and notarize.");
}
