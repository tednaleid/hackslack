// ABOUTME: The long-running Launcher: starts Slack, keeps the Stylesheets applied, and records its state.
// ABOUTME: In Normal mode Slack exits when this process does, because the debugging pipe closes.
import { errorMessage, type Log } from "../core/log";
import type { Mode } from "../core/ports";
import { StyleKeeper } from "../core/styleKeeper";
import { CdpSlackApp } from "../slack/cdpSlackApp";
import { MacSlackProcess } from "../slack/macSlackProcess";
import { FsStylesheets } from "../stylesheets/fsStylesheets";
import { type LauncherState, STYLES_DIR, writeState } from "./state";

export async function runLauncher(mode: Mode): Promise<number> {
  const log: Log = (message) => console.log(`${new Date().toISOString()} ${message}`);
  let state: LauncherState = {
    launcherPid: process.pid,
    mode,
    slackPid: null,
    port: null,
    startedAt: new Date().toISOString(),
    injectCount: 0,
    lastInjectAt: null,
    pageCount: 0,
    exitReason: null,
  };
  const update = (changes: Partial<LauncherState>) => {
    state = { ...state, ...changes };
    writeState(state);
  };
  update({});

  const slack = new CdpSlackApp(new MacSlackProcess(log), log);
  const keeper = new StyleKeeper(slack, new FsStylesheets(STYLES_DIR), log, (stats) => update(stats));
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, async () => {
      log(`received ${signal}; releasing Slack`);
      update({ exitReason: `Launcher stopped by ${signal}` });
      await slack.close();
      process.exit(0);
    });
  }

  try {
    const info = await keeper.start(mode);
    update({ slackPid: info.slackPid, port: info.port });
    log(`Slack pid=${info.slackPid} running in ${mode} mode${info.port ? ` with debugging port ${info.port}` : ""}`);
  } catch (error) {
    log(`could not start Slack: ${errorMessage(error)}`);
    update({ exitReason: `could not start Slack: ${errorMessage(error)}` });
    return 1;
  }

  const reason = await keeper.exited;
  log(`Slack exited: ${reason}`);
  update({ slackPid: null, exitReason: reason });
  return 0;
}
