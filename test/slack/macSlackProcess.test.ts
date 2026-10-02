// ABOUTME: Tests for MacSlackProcess using a stand-in executable, never the real Slack app.
// ABOUTME: The stand-in records its pid and never opens a debugging port.
import { expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MacSlackProcess } from "../../src/slack/macSlackProcess";
import { eventually } from "../helpers";

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test("stops Slack when Inspect mode cannot reach its debugging port", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hackslack-fake-slack-"));
  const pidFile = join(dir, "pid");
  const binaryPath = join(dir, "Slack");
  writeFileSync(binaryPath, `#!/bin/sh\necho $$ > "${pidFile}"\nexec sleep 30\n`);
  chmodSync(binaryPath, 0o755);

  const slackProcess = new MacSlackProcess(() => {}, {
    binaryPath,
    debuggerTimeoutMs: 300,
    quitRunningSlack: async () => {},
  });
  await expect(slackProcess.start("inspect")).rejects.toThrow("did not open its debugging port");
  const pid = Number(readFileSync(pidFile, "utf8"));
  await eventually(() => !isRunning(pid), 2000, "the stand-in Slack to stop");
});
