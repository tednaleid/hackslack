// ABOUTME: Tests for the text `just status` prints for each combination of state and running processes.
// ABOUTME: describeStatus is pure; the processes it is given are made up here.
import { describe, expect, test } from "bun:test";
import type { LauncherState } from "../../src/cli/state";
import { describeStatus, isLauncherRunning, isSlackManaged } from "../../src/cli/status";

const NORMAL: LauncherState = {
  launcherPid: 100,
  mode: "normal",
  slackPid: 200,
  port: null,
  startedAt: "2026-10-01T12:00:00.000Z",
  injectCount: 3,
  lastInjectAt: "2026-10-01T12:05:00.000Z",
  pageCount: 1,
  exitReason: null,
};
const INSPECT: LauncherState = { ...NORMAL, mode: "inspect", port: 51234 };

test("says Slack is not running when nothing is running", () => {
  expect(describeStatus(null, { launcherAlive: false, slackPids: [], listeningPorts: [] })).toEqual([
    "Slack is not running.",
  ]);
});

test("includes why Slack last exited", () => {
  const state = { ...NORMAL, slackPid: null, exitReason: "pipe closed by Slack" };
  expect(describeStatus(state, { launcherAlive: false, slackPids: [], listeningPorts: [] })).toEqual([
    "Slack is not running.",
    "Last exit: pipe closed by Slack",
  ]);
});

test("describes Normal mode with no warning", () => {
  const lines = describeStatus(NORMAL, { launcherAlive: true, slackPids: [200], listeningPorts: [] });
  expect(lines[0]).toBe("Mode: Normal");
  expect(lines.join("\n")).toContain("applied 3 time(s) across 1 page(s)");
  expect(lines.join("\n")).not.toContain("WARNING");
});

test("warns first when Inspect mode has a port open", () => {
  const lines = describeStatus(INSPECT, { launcherAlive: true, slackPids: [200], listeningPorts: [51234] });
  expect(lines[0]).toStartWith("WARNING: Slack has a debugging port open on 127.0.0.1:51234");
  expect(lines).toContain("Mode: Inspect");
});

test("says the Stylesheets are not applied when Slack runs without the Launcher", () => {
  const lines = describeStatus(NORMAL, { launcherAlive: false, slackPids: [300], listeningPorts: [] });
  expect(lines).toEqual(["Slack is running without the Launcher, so the Stylesheets are not applied. Run `just start`."]);
});

test("warns about an open port even when Slack is not under the Launcher", () => {
  const lines = describeStatus(INSPECT, { launcherAlive: false, slackPids: [200], listeningPorts: [51234] });
  expect(lines[0]).toStartWith("WARNING");
  expect(lines[1]).toContain("running without the Launcher");
});

describe("isLauncherRunning", () => {
  test("is true only when the recorded pid is one of the running Launcher processes", () => {
    expect(isLauncherRunning(NORMAL, [100])).toBe(true);
    expect(isLauncherRunning(NORMAL, [555])).toBe(false);
    expect(isLauncherRunning(null, [100])).toBe(false);
  });

  test("is false once the Launcher recorded an exit, even if its pid was reused by another Launcher", () => {
    expect(isLauncherRunning({ ...NORMAL, exitReason: "pipe closed by Slack" }, [100])).toBe(false);
  });
});

describe("isSlackManaged", () => {
  test("is true when the running Launcher's Slack is running", () => {
    expect(isSlackManaged(NORMAL, { launcherAlive: true, slackPids: [200], listeningPorts: [] })).toBe(true);
  });

  test("is false when Slack is quit, unmanaged, or the Launcher is gone", () => {
    expect(isSlackManaged(NORMAL, { launcherAlive: true, slackPids: [], listeningPorts: [] })).toBe(false);
    expect(isSlackManaged(NORMAL, { launcherAlive: true, slackPids: [300], listeningPorts: [] })).toBe(false);
    expect(isSlackManaged(NORMAL, { launcherAlive: false, slackPids: [200], listeningPorts: [] })).toBe(false);
    expect(isSlackManaged(null, { launcherAlive: false, slackPids: [200], listeningPorts: [] })).toBe(false);
  });
});
