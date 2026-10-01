// ABOUTME: Paths used by the CLI and the Launcher's state file in .state/launcher.json.
// ABOUTME: The running Launcher writes the state; `just status`, `just start` and `just attach` read it.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Mode } from "../core/ports";

export const REPO_ROOT = join(import.meta.dir, "..", "..");
export const STYLES_DIR = join(REPO_ROOT, "styles");
export const STATE_DIR = join(REPO_ROOT, ".state");
export const STATE_PATH = join(STATE_DIR, "launcher.json");
export const LOG_PATH = join(STATE_DIR, "launcher.log");
export const MAIN_PATH = join(REPO_ROOT, "src", "cli", "main.ts");

export interface LauncherState {
  launcherPid: number;
  mode: Mode;
  slackPid: number | null;
  port: number | null;
  startedAt: string;
  injectCount: number;
  lastInjectAt: string | null;
  pageCount: number;
  exitReason: string | null;
}

export function readState(path = STATE_PATH): LauncherState | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LauncherState;
  } catch {
    return null;
  }
}

export function writeState(state: LauncherState, path = STATE_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(state, null, 2));
  renameSync(temporary, path);
}
