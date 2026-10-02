// ABOUTME: Tests for the Launcher's lifecycle: what it records when Slack exits or when it is told to stop.
// ABOUTME: Runs runLauncher with FakeSlackApp and FakeStylesheets in place of Slack and the styles directory.
import { expect, test } from "bun:test";
import { runLauncher } from "../../src/cli/run";
import type { LauncherState } from "../../src/cli/state";
import { FakeSlackApp } from "../fakes/fakeSlackApp";
import { FakeStylesheets } from "../fakes/fakeStylesheets";
import { eventually } from "../helpers";

function launch() {
  const slack = new FakeSlackApp();
  const states: LauncherState[] = [];
  const logs: string[] = [];
  let stop: (signal: string) => Promise<void> = async () => {};
  const result = runLauncher("normal", {
    slack,
    stylesheets: new FakeStylesheets(".a {}"),
    log: (message) => logs.push(message),
    writeState: (state) => states.push(state),
    onStopSignal: (handler) => {
      stop = handler;
    },
  });
  const latest = () => states.at(-1)!;
  return { slack, states, logs, result, latest, stop: (signal: string) => stop(signal) };
}

test("records why Slack exited", async () => {
  const { slack, result, latest } = launch();
  await eventually(() => latest().injectCount === 1);
  slack.exit("pipe closed by Slack");
  expect(await result).toBe(0);
  expect(latest().slackPid).toBeNull();
  expect(latest().exitReason).toBe("pipe closed by Slack");
});

test("records a stop signal as the exit reason and does not claim Slack exited", async () => {
  const { logs, result, latest, stop } = launch();
  await eventually(() => latest().injectCount === 1);
  await stop("SIGTERM");
  expect(await result).toBe(0);
  expect(latest().exitReason).toBe("Launcher stopped by SIGTERM");
  expect(logs.some((line) => line.startsWith("Slack exited"))).toBe(false);
});
