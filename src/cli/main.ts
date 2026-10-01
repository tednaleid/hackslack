// ABOUTME: Command-line entry point used by the justfile recipes.
// ABOUTME: Commands: run <mode>, start <mode>, status, port.
import type { Mode } from "../core/ports";
import { isProcessAlive } from "../slack/macProcesses";
import { runLauncher } from "./run";
import { startInBackground } from "./start";
import { readState } from "./state";
import { describeStatus, observeProcesses } from "./status";

function parseMode(value: string | undefined): Mode {
  if (value === "normal" || value === "inspect") return value;
  console.error(`mode must be "normal" or "inspect", got "${value ?? ""}"`);
  process.exit(2);
}

const [command, modeArgument] = process.argv.slice(2);

switch (command) {
  case "run":
    process.exit(await runLauncher(parseMode(modeArgument)));
  case "start":
    process.exit(await startInBackground(parseMode(modeArgument)));
  case "status": {
    const state = readState();
    for (const line of describeStatus(state, observeProcesses(state))) console.log(line);
    break;
  }
  case "port": {
    const state = readState();
    if (state?.mode !== "inspect" || state.port === null || !isProcessAlive(state.launcherPid)) {
      console.error("Slack is not in Inspect mode. Run `just inspect` first.");
      process.exit(1);
    }
    console.log(state.port);
    break;
  }
  default:
    console.error("usage: main.ts run <normal|inspect> | start <normal|inspect> | status | port");
    process.exit(2);
}
