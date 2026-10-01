// ABOUTME: Starts the Launcher in the background, replacing any Launcher already running.
// ABOUTME: Waits until the Stylesheets are applied, then prints the status.
import { spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import type { Mode } from "../core/ports";
import { runningLauncherPids, waitUntil } from "../slack/macProcesses";
import { LOG_PATH, MAIN_PATH, readState, REPO_ROOT, STATE_DIR } from "./state";
import { describeStatus, isLauncherRunning, observeProcesses } from "./status";

export async function startInBackground(mode: Mode): Promise<number> {
  await stopRunningLauncher();
  mkdirSync(STATE_DIR, { recursive: true });
  const logFd = openSync(LOG_PATH, "a");
  const child = spawn(process.execPath, [MAIN_PATH, "run", mode], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  console.log(`Launcher started (pid ${child.pid}); restarting Slack in ${mode === "normal" ? "Normal" : "Inspect"} mode`);

  const settled = () => {
    const state = readState();
    return state?.launcherPid === child.pid && (state.injectCount > 0 || state.exitReason !== null);
  };
  const ready = await waitUntil(settled, 45_000, 250);
  const state = readState();
  if (!ready || state === null || state.exitReason !== null) {
    const why = state?.exitReason ? `: ${state.exitReason}` : " within 45s";
    console.error(`The Launcher did not apply the Stylesheets${why}. See \`just logs\`.`);
    return 1;
  }
  for (const line of describeStatus(state, observeProcesses(state))) console.log(line);
  return 0;
}

async function stopRunningLauncher(): Promise<void> {
  const state = readState();
  if (state === null || !isLauncherRunning(state, runningLauncherPids())) return;
  const stillRunning = () => runningLauncherPids().includes(state.launcherPid);
  process.kill(state.launcherPid, "SIGTERM");
  if (!(await waitUntil(() => !stillRunning(), 5_000)) && stillRunning()) {
    process.kill(state.launcherPid, "SIGKILL");
  }
}
