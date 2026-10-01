// ABOUTME: Builds the text `just status` prints, warning first whenever Slack has a debugging port open.
// ABOUTME: describeStatus is pure; observeProcesses gathers the facts it needs from the system.
import { isProcessAlive, listeningPorts, runningSlackPids } from "../slack/macProcesses";
import type { LauncherState } from "./state";

export interface ObservedProcesses {
  launcherAlive: boolean;
  slackPids: number[];
  listeningPorts: number[];
}

export function describeStatus(state: LauncherState | null, seen: ObservedProcesses): string[] {
  const lines: string[] = [];
  if (seen.listeningPorts.length > 0) {
    const ports = seen.listeningPorts.map((port) => `127.0.0.1:${port}`).join(", ");
    lines.push(
      `WARNING: Slack has a debugging port open on ${ports}. Any local process can control your Slack session. Run \`just start\` to return to Normal mode.`,
    );
  }
  if (seen.slackPids.length === 0) {
    lines.push("Slack is not running.");
    if (state?.exitReason) lines.push(`Last exit: ${state.exitReason}`);
    return lines;
  }
  const managed =
    state !== null && seen.launcherAlive && state.slackPid !== null && seen.slackPids.includes(state.slackPid);
  if (!managed || state === null) {
    lines.push("Slack is running without the Launcher, so the Stylesheets are not applied. Run `just start`.");
    return lines;
  }
  lines.push(`Mode: ${state.mode === "normal" ? "Normal" : "Inspect"}`);
  lines.push(`Slack pid ${state.slackPid}, Launcher pid ${state.launcherPid}`);
  lines.push(
    `Stylesheets applied ${state.injectCount} time(s) across ${state.pageCount} page(s); last at ${state.lastInjectAt ?? "never"}`,
  );
  return lines;
}

export function observeProcesses(state: LauncherState | null): ObservedProcesses {
  const slackPids = runningSlackPids();
  return {
    launcherAlive: state !== null && isProcessAlive(state.launcherPid),
    slackPids,
    listeningPorts: slackPids.flatMap(listeningPorts),
  };
}
