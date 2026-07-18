import { homedir } from "node:os";
import { join, resolve } from "node:path";

const defaultDataDir = join(
  homedir(),
  "Library",
  "Application Support",
  "App Demo Studio",
);

function arg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
}

export const config = {
  host: "127.0.0.1",
  port: Number(arg("port") ?? process.env.APP_DEMO_WORKER_PORT ?? 4817),
  token: arg("token") ?? process.env.APP_DEMO_WORKER_TOKEN ?? "dev-local",
  dataDir: resolve(arg("data-dir") ?? process.env.APP_DEMO_DATA_DIR ?? defaultDataDir),
  projectRoot: resolve(
    arg("projects-dir") ??
      process.env.APP_DEMO_PROJECTS_DIR ??
      join(arg("data-dir") ?? process.env.APP_DEMO_DATA_DIR ?? defaultDataDir, "Projects"),
  ),
  outputRoot: resolve(
    arg("output-dir") ??
      process.env.APP_DEMO_OUTPUT_DIR ??
      join(arg("data-dir") ?? process.env.APP_DEMO_DATA_DIR ?? defaultDataDir, "Exports"),
  ),
  renderEntry: arg("render-entry"),
  frontendOrigin: process.env.APP_DEMO_FRONTEND_ORIGIN ?? "http://127.0.0.1:5173",
};
