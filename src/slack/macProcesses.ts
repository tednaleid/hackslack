// ABOUTME: macOS process control for the Slack app: find it, list it, quit it, and find its debugger URL.
// ABOUTME: Runs only pgrep, lsof and osascript, and never touches Slack.app's files.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Log } from "../core/log";

export const SLACK_BUNDLE_ID = "com.tinyspeck.slackmacgap";
const BINARY_IN_BUNDLE = "Slack.app/Contents/MacOS/Slack";

export function findSlackBinary(): string {
  const candidates = [join("/Applications", BINARY_IN_BUNDLE), join(homedir(), "Applications", BINARY_IN_BUNDLE)];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error(`Slack not found; looked in ${candidates.join(" and ")}`);
  return found;
}

export function runningSlackPids(): number[] {
  const result = spawnSync("pgrep", ["-x", "Slack"], { encoding: "utf8" });
  return result.stdout.split("\n").filter(Boolean).map(Number);
}

export function runningLauncherPids(): number[] {
  const result = spawnSync("pgrep", ["-f", "src/cli/main.ts run"], { encoding: "utf8" });
  return result.stdout.split("\n").filter(Boolean).map(Number);
}

export function listeningPorts(pid: number): number[] {
  const result = spawnSync("lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-a", "-p", String(pid)], { encoding: "utf8" });
  return [...result.stdout.matchAll(/:(\d+) \(LISTEN\)/g)].map((match) => Number(match[1]));
}

export async function waitUntil(check: () => boolean, timeoutMs: number, intervalMs = 200): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await Bun.sleep(intervalMs);
  }
  return check();
}

export async function quitRunningSlack(log: Log): Promise<void> {
  const stopped = () => runningSlackPids().length === 0;
  if (stopped()) return;
  log("asking the running Slack to quit");
  spawnSync("osascript", ["-e", `tell application id "${SLACK_BUNDLE_ID}" to quit`]);
  if (await waitUntil(stopped, 10_000)) return;
  log("Slack did not quit; sending SIGTERM");
  signalSlack("SIGTERM");
  if (await waitUntil(stopped, 5_000)) return;
  log("Slack did not exit; sending SIGKILL");
  signalSlack("SIGKILL");
  if (!(await waitUntil(stopped, 2_000))) throw new Error("could not stop the running Slack");
}

function signalSlack(signal: NodeJS.Signals): void {
  for (const pid of runningSlackPids()) {
    try {
      process.kill(pid, signal);
    } catch {
      // The process exited between pgrep and kill.
    }
  }
}

export function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

export async function waitForDebuggerUrl(port: number, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      const body = (await response.json()) as { webSocketDebuggerUrl?: string };
      if (body.webSocketDebuggerUrl) return body.webSocketDebuggerUrl;
    } catch {
      // Slack has not opened the port yet.
    }
    await Bun.sleep(250);
  }
  throw new Error(`Slack did not open its debugging port ${port} within ${timeoutMs}ms`);
}
