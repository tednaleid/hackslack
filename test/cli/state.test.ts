// ABOUTME: Tests for reading and writing the Launcher's state file.
// ABOUTME: Uses a temporary path so the real .state directory is untouched.
import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type LauncherState, readState, rotateLog, writeState } from "../../src/cli/state";

const STATE: LauncherState = {
  launcherPid: 100,
  mode: "normal",
  slackPid: 200,
  port: null,
  startedAt: "2026-10-01T12:00:00.000Z",
  injectCount: 1,
  lastInjectAt: "2026-10-01T12:00:01.000Z",
  pageCount: 1,
  exitReason: null,
};

test("round-trips the state, creating the directory", () => {
  const path = join(mkdtempSync(join(tmpdir(), "hackslack-state-")), "nested", "launcher.json");
  writeState(STATE, path);
  expect(readState(path)).toEqual(STATE);
});

test("reads null when the file is missing or unreadable", () => {
  const dir = mkdtempSync(join(tmpdir(), "hackslack-state-"));
  expect(readState(join(dir, "missing.json"))).toBeNull();
  writeFileSync(join(dir, "corrupt.json"), "{ not json");
  expect(readState(join(dir, "corrupt.json"))).toBeNull();
});

test("rotateLog moves a log past the size limit aside, replacing the previous one", () => {
  const log = join(mkdtempSync(join(tmpdir(), "hackslack-log-")), "launcher.log");
  writeFileSync(`${log}.1`, "oldest");
  writeFileSync(log, "x".repeat(20));
  rotateLog(log, 10);
  expect(existsSync(log)).toBe(false);
  expect(readFileSync(`${log}.1`, "utf8")).toBe("x".repeat(20));
});

test("rotateLog leaves a small or missing log alone", () => {
  const dir = mkdtempSync(join(tmpdir(), "hackslack-log-"));
  const log = join(dir, "launcher.log");
  rotateLog(log, 10);
  writeFileSync(log, "short");
  rotateLog(log, 10);
  expect(readFileSync(log, "utf8")).toBe("short");
  expect(existsSync(`${log}.1`)).toBe(false);
});
